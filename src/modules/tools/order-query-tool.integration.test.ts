import { MockCustomerContextProvider } from "../customer-context";
import { getOrderQueryTool } from "./composition-root";
import { OrderQueryTool } from "./order-query-tool";

describe("order query integration", () => {
  it("queries the mock customer context through the Tool boundary", async () => {
    const result = await new OrderQueryTool(
      new MockCustomerContextProvider(),
    ).execute({
      callId: "integration-call",
      arguments: { customer_id: "customer-2" },
    });

    expect(result).toEqual({
      ok: true,
      callId: "integration-call",
      toolName: "query_customer_orders",
      data: {
        customer: {
          id: "customer-2",
          name: "Jamie Lin",
          email: "jamie.lin@example.com",
          tier: "standard",
        },
        orders: [],
      },
    });
  });

  it("provides the configured MVP tool without exposing its provider", async () => {
    const result = await getOrderQueryTool().execute({
      callId: "composed-call",
      arguments: { customer_id: "customer-1" },
    });

    expect(result.ok).toBe(true);
  });
});
