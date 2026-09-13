import type { PrismaClient } from "@prisma/client";
import type { CustomerContextProvider } from "../customer-context";
import type { PolicyEngine } from "../policy";
import type { Tool, ToolResult } from "../tools";
import type { RefundOutput } from "../tools/mock-refund-tool";
import { RuntimeConflictError, type RuntimeResult } from "../agent-runtime/runtime";

export class ApprovalService {
  constructor(private readonly client: PrismaClient, private readonly context: CustomerContextProvider,
    private readonly policy: PolicyEngine, private readonly refund: Tool<RefundOutput>) {}

  list(conversationId: string, customerId: string) {
    return this.client.approval.findMany({ where: { conversationId, customerId, conversation: { customerId } }, orderBy: { createdAt: "desc" } });
  }

  async request(executionId: string, message: string): Promise<RuntimeResult> {
    const execution = await this.client.runtimeExecution.findUniqueOrThrow({ where: { id: executionId }, include: { conversation: true } });
    const customerId = execution.conversation.customerId;
    const policy = this.policy.evaluate("refund");
    let orderId: string | undefined;
    let content = "无法核实退款订单，已转交人工客服处理。";
    let status: RuntimeResult["status"] = "human_handoff";
    try {
      const customer = await this.context.getCustomer(customerId);
      const orders = customer ? (await this.context.listOrders(customerId)).filter(o => o.customerId === customerId && o.status !== "cancelled") : [];
      const mentioned = message.match(/order-[a-z0-9-]+/gi) ?? [];
      const candidates = mentioned.length ? orders.filter(o => mentioned.length === 1 && o.id === mentioned[0]) : orders;
      if (policy.decision === "approval" && candidates.length === 1) {
        orderId = candidates[0].id;
        status = "waiting_approval";
        content = `订单 ${orderId} 的退款申请已提交人工审批，尚未执行退款。`;
      } else if (policy.decision === "approval" && !mentioned.length && orders.length > 1) {
        status = "open";
        content = "您有多个订单，请提供需要退款的订单号后重新申请退款。";
      }
    } catch { /* Provider details must never reach messages or audit results. */ }
    return this.client.$transaction(async tx => {
      if (!(await tx.runtimeExecution.updateMany({ where: { id: executionId, status: "running" }, data: { status: "completed", finishedAt: new Date() } })).count) throw new RuntimeConflictError("Execution is no longer active.");
      if (orderId) {
        const duplicate = await tx.approval.findFirst({ where: { customerId, orderId, status: { in: ["pending", "approved", "failed"] } } });
        if (duplicate || await tx.mockRefund.findUnique({ where: { customerId_orderId: { customerId, orderId } } })) {
          status = "human_handoff";
          content = "该订单已有退款申请或退款记录，已转交人工核实，不会重复执行。";
        } else {
          await tx.approval.create({ data: { conversationId: execution.conversationId, executionId, customerId, orderId, reason: policy.reason } });
        }
      }
      if (!(await tx.conversation.updateMany({ where: { id: execution.conversationId, status: "processing", customerId }, data: { status } })).count) throw new RuntimeConflictError("Conversation state changed.");
      const reply = await tx.message.create({ data: { conversationId: execution.conversationId, role: "agent", content } });
      return { status, reply: { ...reply, role: "agent" }, toolResult: null };
    });
  }

  async decide(conversationId: string, approvalId: string, decision: string) {
    if (decision !== "approve" && decision !== "reject") throw new RuntimeConflictError("Invalid decision.");
    // SQLite serializes these transactions. Claim, Mock ledger, audit and reply commit together.
    // A real payment adapter must provide durable idempotency before replacing this Mock.
    return this.client.$transaction(async tx => {
      const approval = await tx.approval.findFirst({ where: { id: approvalId, conversationId, status: "pending" } });
      if (!approval) throw new RuntimeConflictError("Approval is no longer pending.");
      if (!(await tx.conversation.updateMany({ where: { id: conversationId, customerId: approval.customerId, status: "waiting_approval" }, data: { status: "processing" } })).count) throw new RuntimeConflictError("Conversation state changed.");
      if (!(await tx.approval.updateMany({ where: { id: approvalId, status: "pending" }, data: { status: decision === "approve" ? "approved" : "rejected", decidedAt: new Date() } })).count) throw new RuntimeConflictError("Approval already decided.");
      let result: ToolResult<RefundOutput> | null = null;
      let content = "退款申请已被人工拒绝，未执行退款，已转交人工客服跟进。";
      if (decision === "approve") {
        const failure = (code: string): ToolResult<RefundOutput> => ({ ok: false, callId: approvalId, toolName: "refund", error: { code, message: "退款未完成，需人工核实。", retryable: false } });
        if (await tx.mockRefund.findUnique({ where: { customerId_orderId: { customerId: approval.customerId, orderId: approval.orderId } } })) result = failure("ALREADY_REFUNDED");
        else {
          try { result = await this.refund.execute({ callId: approvalId, arguments: { customer_id: approval.customerId, order_id: approval.orderId } }); }
          catch { result = failure("TOOL_FAILED"); }
          if (result.ok && (result.data.customerId !== approval.customerId || result.data.orderId !== approval.orderId || result.callId !== approvalId)) result = failure("INVALID_TOOL_RESULT");
        }
        if (result.ok) {
          await tx.mockRefund.create({ data: { id: result.data.refundId, customerId: approval.customerId, orderId: approval.orderId, approvalId } });
          content = `订单 ${approval.orderId} 已完成 Mock 退款，退款编号 ${result.data.refundId}。`;
        } else content = "退款执行失败，已转交人工客服核实，不会自动重试。";
        await tx.approval.update({ where: { id: approvalId }, data: { status: result.ok ? "approved" : "failed", result: JSON.stringify(result) } });
      }
      await tx.message.create({ data: { conversationId, role: "system", content: decision === "approve" ? "管理员已批准退款申请。" : "管理员已拒绝退款申请。" } });
      await tx.message.create({ data: { conversationId, role: "agent", content } });
      await tx.conversation.update({ where: { id: conversationId }, data: { status: result?.ok ? "resolved" : "human_handoff" } });
      return tx.approval.findUniqueOrThrow({ where: { id: approvalId } });
    });
  }
}
