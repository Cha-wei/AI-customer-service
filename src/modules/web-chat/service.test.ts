// @vitest-environment node
import { sendCustomerMessage } from "./service";
const m = vi.hoisted(() => ({ create: vi.fn(), header: vi.fn(), run: vi.fn(), orders: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: m.transaction } }));
vi.mock("../conversations/composition-root", () => ({ getConversationService: () => ({ create: m.create, getHeader: m.header }) }));
vi.mock("../agent-runtime/composition-root", () => ({ getAgentRuntime: () => ({ run: m.run }) }));
vi.mock("../customer-context/composition-root", () => ({ getCustomerContextProvider: () => ({ listOrders: m.orders }) }));
beforeEach(() => { vi.resetAllMocks(); m.create.mockResolvedValue({ id: "c1" }); m.orders.mockResolvedValue([{ id: "order-1001", customerId: "customer-1", status: "shipped" }]); });
it("requires explicit owned refund selection and uses selection over free text", async () => {
  await expect(sendCustomerMessage("customer-1", { content: "退款" })).rejects.toThrow();
  await expect(sendCustomerMessage("customer-1", { content: "退款", orderId: "foreign" })).rejects.toThrow();
  expect(m.create).not.toHaveBeenCalled();
  await sendCustomerMessage("customer-1", { content: "退款 order-other", orderId: "order-1001" });
  expect(m.create).toHaveBeenCalledWith({ customerId: "customer-1", initialMessage: "申请退款 order-1001" });
  expect(m.run).toHaveBeenCalledWith("c1");
});
it("rejects identity/role injection and foreign conversations before writes", async () => {
  for (const extra of [{ customerId: "customer-2" }, { role: "agent" }]) await expect(sendCustomerMessage("customer-1", { content: "hello", ...extra })).rejects.toThrow();
  m.header.mockResolvedValue({ customerId: "customer-2" });
  await expect(sendCustomerMessage("customer-1", { content: "hello", conversationId: "foreign" })).rejects.toThrow();
  expect(m.transaction).not.toHaveBeenCalled();
});
it("returns the persisted conversation ID on runtime failure without leaking details", async () => {
  m.run.mockRejectedValue(new Error("secret"));
  expect(await sendCustomerMessage("customer-1", { content: "订单" })).toEqual({ id: "c1", warning: expect.not.stringContaining("secret") });
});
it("rejects sending to busy conversations or past an unanswered message", async () => {
  m.header.mockResolvedValue({ customerId: "customer-1" });
  const create = vi.fn();
  for (const count of [0, 1]) {
    m.transaction.mockImplementation(callback => callback({ conversation: { updateMany: async () => ({ count }) }, message: { findFirst: async () => ({ role: "customer" }), create } }));
    await expect(sendCustomerMessage("customer-1", { content: "订单", conversationId: "c1" })).rejects.toThrow();
  }
  expect(create).not.toHaveBeenCalled();
  expect(m.run).not.toHaveBeenCalled();
});

it("persists human-mode messages verbatim without refund routing or AI execution", async () => {
  m.header.mockResolvedValue({ customerId: "customer-1", status: "human_handoff" });
  const create = vi.fn();
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  m.transaction.mockImplementation(callback => callback({ conversation: { updateMany }, message: { findFirst: async () => ({ role: "human" }), create } }));
  expect(await sendCustomerMessage("customer-1", { conversationId: "c1", content: "退款原因是包装损坏" })).toEqual({ id: "c1" });
  expect(create).toHaveBeenCalledWith({ data: { conversationId: "c1", role: "customer", content: "退款原因是包装损坏" } });
  expect(updateMany.mock.calls[0][0]).toMatchObject({ where: { status: "human_handoff", executions: { none: { status: "running" } } } });
  expect(m.orders).not.toHaveBeenCalled();
  expect(m.run).not.toHaveBeenCalled();
});
