// @vitest-environment node
import { createHash } from "node:crypto";
import { GET, POST } from "./route";
import { AccessError } from "@/modules/internal-auth";
import { ConversationNotFoundError } from "@/modules/conversations";
const mocks = vi.hoisted(() => ({ identity: vi.fn(), owned: vi.fn(), send: vi.fn(), list: vi.fn(), messages: vi.fn(), orders: vi.fn() }));
vi.mock("@/modules/web-chat/session", () => ({ customerIdentity: mocks.identity }));
vi.mock("@/modules/web-chat/service", () => ({ ownedConversation: mocks.owned, sendCustomerMessage: mocks.send }));
vi.mock("@/modules/conversations/composition-root", () => ({ getConversationService: () => ({ list: mocks.list, listMessages: mocks.messages }) }));
vi.mock("@/modules/customer-context/composition-root", () => ({ getCustomerContextProvider: () => ({ listOrders: mocks.orders }) }));
beforeEach(() => { vi.resetAllMocks(); mocks.identity.mockResolvedValue("customer-1"); });
const post = (body: unknown, origin = "http://localhost") => new Request("http://localhost/api/chat", { method: "POST", headers: { origin, "x-chat-account": createHash("sha256").update("customer-1").digest("hex") }, body: JSON.stringify(body) });
it("requires a customer session even for reads", async () => {
  mocks.identity.mockRejectedValue(new AccessError(401, "unauthorized"));
  expect((await GET(new Request("http://localhost/api/chat"))).status).toBe(401);
  expect((await POST(post({ content: "hello" }))).status).toBe(401);
  expect(mocks.list).not.toHaveBeenCalled();
});
it("scopes list and orders to the trusted identity, ignoring query impersonation", async () => {
  mocks.list.mockResolvedValue({ conversations: [] });
  mocks.orders.mockResolvedValue([{ id: "foreign", customerId: "customer-2", status: "shipped", items: [] }]);
  const response = await GET(new Request("http://localhost/api/chat?customerId=customer-2"));
  expect(mocks.list).toHaveBeenCalledWith({ customerId: "customer-1", page: 1 });
  expect((await response.json()).orders).toEqual([]);
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("does not load another customer's message history", async () => {
  mocks.owned.mockRejectedValue(new ConversationNotFoundError("foreign"));
  expect((await GET(new Request("http://localhost/api/chat?id=foreign"))).status).toBe(404);
  expect(mocks.messages).not.toHaveBeenCalled();
});
it("rejects cross-origin writes and malformed bodies", async () => {
  expect((await POST(post({}, "https://evil.example"))).status).toBe(403);
  expect((await POST(post([]))).status).toBe(400);
  expect(mocks.send).not.toHaveBeenCalled();
});
it("uses only the trusted identity and sanitizes unexpected failures", async () => {
  mocks.send.mockRejectedValue(new Error("secret-provider-details"));
  const response = await POST(post({ content: "hello" }));
  expect(mocks.send).toHaveBeenCalledWith("customer-1", { content: "hello" });
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("secret-provider-details");
});

it("rejects an old account draft after the cookie switches accounts", async () => {
  mocks.identity.mockResolvedValue("customer-2");
  expect((await POST(post({ content: "退款", orderId: "order-1001" }))).status).toBe(401);
  expect(mocks.send).not.toHaveBeenCalled();
});
