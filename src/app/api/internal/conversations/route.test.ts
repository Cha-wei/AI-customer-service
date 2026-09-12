import { GET, POST } from "./route";
import { configureTestAuth, authHeaders } from "@/test/internal-auth";
configureTestAuth();
const { list } = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/modules/conversations/composition-root", () => ({ getConversationService: () => ({ list }) }));

it("uses the authenticated customer scope for pages and totals", async () => {
  const token = "customer-token-for-pagination-testing-only";
  vi.stubEnv("INTERNAL_API_TOKENS", JSON.stringify([{ role: "customer", customerId: "owner", token }]));
  list.mockResolvedValue({ conversations: [], total: 21, page: 2, pageSize: 20 });
  const response = await GET(new Request("http://localhost/api/internal/conversations?page=2&customerId=other", { headers: { Authorization: `Bearer ${token}` } }));
  expect(list).toHaveBeenCalledWith({ customerId: "owner", page: 2 });
  expect(await response.json()).toEqual({ data: [], total: 21, page: 2, pageSize: 20 });
});

describe("POST /api/internal/conversations", () => {
  it("returns a structured validation error for invalid JSON", async () => {
    const request = new Request("http://localhost/api/internal/conversations", {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders },
      body: "{",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "validation_error",
        message: "Request body must be valid JSON.",
      },
    });
  });
});
