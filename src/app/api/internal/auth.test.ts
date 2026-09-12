import { GET as list, POST as create } from "./conversations/route";
import { GET as detail } from "./conversations/[conversationId]/route";
import { POST as messages } from "./conversations/[conversationId]/messages/route";
import { POST as run } from "./conversations/[conversationId]/run/route";
import { GET as executions } from "./conversations/[conversationId]/executions/route";
import { POST as recover } from "./runtime/recover/route";
import { configureTestAuth } from "@/test/internal-auth";
configureTestAuth();

describe("all internal endpoints require authentication", () => {
  it.each([list, create, detail, messages, run, executions, recover])("rejects anonymous calls before work", async (handler) => {
    const response = await handler(new Request("http://localhost/api/internal/test", { method: "POST" }), { params: Promise.resolve({ conversationId: "missing" }) });
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
  });
  it("denies customer credentials on maintenance endpoint", async () => {
    const token = "test-customer-token-not-for-production";
    vi.stubEnv("INTERNAL_API_TOKENS", JSON.stringify([{ token, role: "customer", customerId: "customer-1" }]));
    const response = await recover(new Request("http://localhost/api/internal/runtime/recover", { method: "POST", headers: { Authorization: `Bearer ${token}` } }));
    expect(response.status).toBe(403);
  });
});
