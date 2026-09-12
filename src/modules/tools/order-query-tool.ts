import type { Customer, Order } from "../customer-context";
import type { CustomerContextProvider } from "../customer-context";
import type { Tool, ToolCallInput, ToolResult } from "./tool";

export const ORDER_QUERY_TOOL_NAME = "query_customer_orders";

export interface OrderQueryArguments {
  customer_id: string;
}

export interface OrderQueryOutput {
  customer: Customer;
  orders: Order[];
}

export class OrderQueryTool implements Tool<OrderQueryOutput> {
  readonly name = ORDER_QUERY_TOOL_NAME;

  constructor(private readonly customerContext: CustomerContextProvider) {}

  async execute(input: ToolCallInput): Promise<ToolResult<OrderQueryOutput>> {
    const customerId = parseCustomerId(input.arguments);
    if (!customerId) {
      return this.failure(
        input.callId,
        "INVALID_INPUT",
        "customer_id must be a non-empty string.",
        false,
      );
    }

    try {
      const customer = await this.customerContext.getCustomer(customerId);
      if (!customer) {
        return this.failure(
          input.callId,
          "CUSTOMER_NOT_FOUND",
          "Customer " + customerId + " was not found.",
          false,
        );
      }

      const orders = await this.customerContext.listOrders(customerId);
      return {
        ok: true,
        callId: input.callId,
        toolName: this.name,
        data: { customer, orders },
      };
    } catch {
      return this.failure(
        input.callId,
        "PROVIDER_ERROR",
        "Customer context is temporarily unavailable.",
        true,
      );
    }
  }

  private failure(
    callId: string,
    code: string,
    message: string,
    retryable: boolean,
  ): ToolResult<OrderQueryOutput> {
    return {
      ok: false,
      callId,
      toolName: this.name,
      error: { code, message, retryable },
    };
  }
}

function parseCustomerId(value: unknown): string | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const customerId = (value as Record<string, unknown>).customer_id;
  if (typeof customerId !== "string" || customerId.trim().length === 0) {
    return null;
  }

  return customerId.trim();
}
