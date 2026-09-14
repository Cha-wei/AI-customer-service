import type { Approval } from "@prisma/client";
import type { ExecutionRecord } from "@/modules/agent-runtime/execution-reader";
import { formatDate } from "./presentation";

export type ActivityStep = { label: string; detail: string; state: "done" | "pending" | "warning" };
export type ActivityApproval = { executionId: string; orderId: string };
function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

// This is a read-only projection of persisted evidence, never a simulated agent workflow.
export function activitySteps(execution: ExecutionRecord, approval?: ActivityApproval): ActivityStep[] {
  const tool = object(execution.toolResult);
  const steps: ActivityStep[] = [];
  if (approval?.executionId === execution.id) steps.push({ label: "提交退款审批", detail: `订单 ${approval.orderId} 的退款申请已提交人工审批`, state: "done" });
  if (tool?.toolName === "query_customer_orders") {
    const data = object(tool.data);
    if (tool.ok === true && Array.isArray(data?.orders)) {
      steps.push({ label: "查询订单", detail: data.orders.length ? `已查询到 ${data.orders.length} 个订单` : "未找到匹配订单", state: data.orders.length ? "done" : "warning" });
    } else if (tool.ok === false) {
      steps.push({ label: "查询订单", detail: "查询未成功，请人工核实", state: "warning" });
    }
  }
  if (execution.errorCode) steps.push({ label: "请求处理异常", detail: "自动处理未能正常完成，请查看上下文中的记录", state: "warning" });
  if (execution.status === "running") steps.push({ label: "处理请求", detail: "执行记录尚未完成，可刷新查看结果", state: "pending" });
  if (execution.status === "completed") steps.push({ label: "生成客户回复", detail: "回复已写入会话记录", state: "done" });
  if (execution.status === "failed") steps.push({ label: "处理失败", detail: "本次执行未完成", state: "warning" });
  return steps;
}

export function AIActivity({ execution, approval }: { execution: ExecutionRecord; approval?: ActivityApproval }) {
  return <details className="ai-activity" aria-label="AI 处理记录">
    <summary><span className="ai-badge">AI</span><strong>查看处理记录</strong><time dateTime={new Date(execution.createdAt).toISOString()}>{formatDate(execution.createdAt)}</time></summary>
    <ActivityTimeline steps={activitySteps(execution, approval)} />
  </details>;
}

export function ActivityTimeline({ steps }: { steps: ActivityStep[] }) {
  return <ol className="execution-timeline">{steps.map((step, index) => <li className={`activity-${step.state}`} key={`${index}-${step.label}`}><span aria-hidden="true">{step.state === "done" ? "✓" : step.state === "pending" ? index + 1 : "!"}</span><div><strong>{step.label}</strong><p>{step.detail}</p></div></li>)}</ol>;
}

export function approvalStep(approval: Pick<Approval, "status" | "orderId">): ActivityStep {
  const states: Record<string, ActivityStep> = {
    pending: { label: "等待人工审批", detail: `订单 ${approval.orderId} 尚未执行退款`, state: "pending" },
    approved: { label: "审批通过并退款", detail: `订单 ${approval.orderId} 的退款执行已成功`, state: "done" },
    rejected: { label: "审批已拒绝", detail: "未执行退款，请由人工继续跟进", state: "warning" },
    failed: { label: "退款执行失败", detail: "审批通过后执行失败，请核实退款结果", state: "warning" },
  };
  return states[approval.status] ?? { label: "审批状态待核实", detail: "请查看审批记录", state: "warning" };
}
