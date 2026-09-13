// @vitest-environment node
import { POST } from "./route";
const revoke = vi.hoisted(() => vi.fn());
vi.mock("@/modules/web-chat/session", () => ({ CUSTOMER_COOKIE: "customer_session", revokeCustomerSession: revoke }));
beforeEach(() => { vi.resetAllMocks(); });
it("rejects cross-origin logout before revoking", async () => {
  const response = await POST(new Request("http://localhost/api/chat/logout", { method: "POST", headers: { origin: "https://evil.example" } }));
  expect(response.status).toBe(403);
  expect(revoke).not.toHaveBeenCalled();
});
it("revokes the session before deleting the browser cookie", async () => {
  const response = await POST(new Request("http://localhost/api/chat/logout", { method: "POST", headers: { origin: "http://localhost" } }));
  expect(response.status).toBe(200);
  expect(revoke).toHaveBeenCalledOnce();
  expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("does not claim successful logout if durable revocation fails", async () => {
  revoke.mockRejectedValue(new Error("database secret"));
  const response = await POST(new Request("http://localhost/api/chat/logout", { method: "POST", headers: { origin: "http://localhost" } }));
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("database secret");
});
