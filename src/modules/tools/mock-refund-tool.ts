import type { CustomerContextProvider } from "../customer-context";
import type { Tool, ToolCallInput, ToolResult } from "./tool";

export interface RefundOutput { refundId: string; customerId: string; orderId: string; status: "refunded" }

// No external side effect: the approval transaction persists this Mock result and its unique order ledger.
export class MockRefundTool implements Tool<RefundOutput> {
  readonly name = "refund";
  constructor(private readonly context: CustomerContextProvider) {}
  async execute(input: ToolCallInput): Promise<ToolResult<RefundOutput>> {
    const args = input.arguments as { customer_id?: unknown; order_id?: unknown } | null;
    const failure = (code: string): ToolResult<RefundOutput> => ({ ok: false, callId: input.callId, toolName: this.name, error: { code, message: "无法完成退款，请人工核实。", retryable: false } });
    if (!args || typeof args.customer_id !== "string" || typeof args.order_id !== "string") return failure("INVALID_INPUT");
    try {
      const customer = await this.context.getCustomer(args.customer_id);
      const order = customer && (await this.context.listOrders(customer.id)).find(o => o.id === args.order_id && o.customerId === customer.id);
      if (!order || order.status === "cancelled") return failure("ORDER_NOT_REFUNDABLE");
      return { ok: true, callId: input.callId, toolName: this.name, data: { refundId: `mock-${input.callId}`, customerId: customer!.id, orderId: order.id, status: "refunded" } };
    } catch { return failure("PROVIDER_ERROR"); }
  }
}
