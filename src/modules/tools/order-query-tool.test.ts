import type { CustomerContextProvider } from "../customer-context";
import { MockCustomerContextProvider } from "../customer-context";
import { OrderQueryTool } from "./order-query-tool";
import { toolContract } from "./tool.contract";

describe("OrderQueryTool contract", () => {
  toolContract({
    createTool: () => new OrderQueryTool(new MockCustomerContextProvider()),
    validArguments: { customer_id: "customer-1" },
    invalidArguments: {},
  });
});

describe("OrderQueryTool", () => {
  it("normalizes customer_id and returns orders with logistics status", async () => {
    const tool = new OrderQueryTool(new MockCustomerContextProvider());

    const result = await tool.execute({
      callId: "call-1",
      arguments: { customer_id: "  customer-1 " },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.customer.id).toBe("customer-1");
      expect(result.data.orders).toHaveLength(2);
      expect(result.data.orders[0].logistics.status).toBe("in_transit");
    }
  });

  it("returns CUSTOMER_NOT_FOUND without requesting orders", async () => {
    const listOrders = vi.fn(async () => []);
    const provider: CustomerContextProvider = {
      getCustomer: vi.fn(async () => null),
      listOrders,
    };
    const tool = new OrderQueryTool(provider);

    const result = await tool.execute({
      callId: "call-2",
      arguments: { customer_id: "missing" },
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "CUSTOMER_NOT_FOUND", retryable: false },
    });
    expect(listOrders).not.toHaveBeenCalled();
  });

  it("maps provider failures to a retryable Tool failure", async () => {
    const provider: CustomerContextProvider = {
      getCustomer: vi.fn(async () => {
        throw new Error("CRM unavailable");
      }),
      listOrders: vi.fn(async () => []),
    };
    const tool = new OrderQueryTool(provider);

    await expect(
      tool.execute({
        callId: "call-3",
        arguments: { customer_id: "customer-1" },
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "PROVIDER_ERROR", retryable: true },
    });
  });
});
