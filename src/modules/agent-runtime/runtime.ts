import type { ConversationService, Message } from "../conversations";
import type { OrderQueryOutput, Tool, ToolResult } from "../tools";
import type { ExecutionStore } from "./execution-store";

export interface IntentProvider {
  classify(message: string): Promise<"order_query" | "handoff">;
}

export class RuleIntentProvider implements IntentProvider {
  async classify(message: string): Promise<"order_query" | "handoff"> {
    if (/退款|退货|修改|取消|人工|refund|cancel|change|human/i.test(message)) return "handoff";
    return /订单|物流|快递|什么时候到|order|delivery|tracking|shipment/i.test(message)
      ? "order_query" : "handoff";
  }
}

export interface RuntimeTools {
  orderQuery: Tool<OrderQueryOutput>;
}

export interface RuntimeResult {
  status: "open" | "human_handoff";
  reply: Message;
  toolResult: ToolResult<OrderQueryOutput> | null;
}

export interface AgentRuntime {
  run(conversationId: string): Promise<RuntimeResult>;
}

export class RuntimeConflictError extends Error {}

export class CustomerServiceRuntime implements AgentRuntime {
  private readonly running = new Set<string>();

  constructor(
    private readonly conversations: Pick<ConversationService, "get" | "transition" | "appendMessage">,
    private readonly intents: IntentProvider,
    private readonly tools: RuntimeTools,
    private readonly executions: ExecutionStore,
  ) {}

  async run(conversationId: string): Promise<RuntimeResult> {
    const id = conversationId.trim();
    if (this.running.has(id)) throw new RuntimeConflictError("Conversation is already processing.");
    this.running.add(id);
    try {
      const conversation = await this.conversations.get(id);
      const message = conversation.messages.at(-1);
      if (conversation.status !== "open" || message?.role !== "customer") {
        throw new RuntimeConflictError("An open conversation with an unanswered customer message is required.");
      }
      const executionId = await this.executions.begin(id, message.id);
      try {
        const intent = await this.intents.classify(message.content);
        let toolResult: ToolResult<OrderQueryOutput> | null = null;
        let content = "这个问题需要人工客服协助，已转交人工处理。";
        let status: RuntimeResult["status"] = "human_handoff";
        if (intent === "order_query") {
          toolResult = await this.tools.orderQuery.execute({
            callId: message.id,
            arguments: { customer_id: conversation.customerId },
          });
          if (toolResult.ok) {
            content = formatOrders(toolResult.data);
            status = "open";
          } else {
            content = toolResult.error.code === "CUSTOMER_NOT_FOUND"
              ? "未找到客户资料，已转交人工客服核实。"
              : "暂时无法查询订单，已转交人工客服处理。";
          }
        }
        const reply = await this.executions.complete(executionId, content, status, toolResult);
        return { status, reply, toolResult };
      } catch (error) {
        // Persistence errors remain visible to callers; do not leave the session processing.
        await this.executions.fail(executionId);
        throw error;
      }
    } finally {
      this.running.delete(id);
    }
  }
}

function formatOrders(data: OrderQueryOutput): string {
  if (!data.orders.length) return "目前没有查询到您的订单。";
  const labels = {
    not_shipped: "尚未发货", in_transit: "运输中", out_for_delivery: "派送中",
    delivered: "已送达", exception: "物流异常",
  };
  // Bound the response to Conversation's message limit, even with a future ERP provider.
  const lines = data.orders.slice(0, 10).map((order) => {
    const eta = order.logistics.estimatedDeliveryAt;
    return `订单 ${order.id.slice(0, 128)}：${order.status === "cancelled" ? "已取消" : labels[order.logistics.status]}。`
      + (eta && order.status === "shipped" ? `预计送达日期 ${eta.toISOString().slice(0, 10)}。` : "")
      + (order.logistics.trackingNumber ? `物流单号：${order.logistics.trackingNumber.slice(0, 128)}。` : "");
  });
  if (data.orders.length > 10) lines.push("仅展示前 10 个订单，请联系人工客服查询更多订单。");
  return lines.join("\n");
}
