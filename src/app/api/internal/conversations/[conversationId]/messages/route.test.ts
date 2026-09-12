import { GET } from "./route";

const { listMessages } = vi.hoisted(() => ({ listMessages: vi.fn() }));
vi.mock("@/modules/conversations/composition-root", () => ({ getConversationService: () => ({ listMessages }) }));

it("scopes message pages to the authenticated customer and forwards the cursor", async () => {
  const token = "customer-message-pagination-token-123456";
  vi.stubEnv("INTERNAL_API_TOKENS", JSON.stringify([{ role: "customer", customerId: "owner", token }]));
  listMessages.mockResolvedValue({ messages: [], nextCursor: null });
  const response = await GET(new Request("http://localhost/api/internal/conversations/c-1/messages?before=cursor", { headers: { Authorization: `Bearer ${token}` } }), { params: Promise.resolve({ conversationId: "c-1" }) });
  expect(listMessages).toHaveBeenCalledWith({ conversationId: "c-1", customerId: "owner", before: "cursor" });
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
