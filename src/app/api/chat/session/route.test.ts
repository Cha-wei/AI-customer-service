// @vitest-environment node
import { POST } from "./route";
const m = vi.hoisted(() => ({ auth: vi.fn(), reserve: vi.fn(), success: vi.fn(), create: vi.fn(), revoke: vi.fn() }));
vi.mock("@/modules/customer-auth/service", () => ({ authenticateCustomer: m.auth }));
vi.mock("@/modules/customer-auth/login-limit", () => ({ customerLoginLimit: { reserve: m.reserve, success: m.success } }));
vi.mock("@/modules/web-chat/session", () => ({ CUSTOMER_COOKIE: "customer_session", createCustomerSession: m.create, revokeCustomerSession: m.revoke }));
beforeEach(() => { vi.resetAllMocks(); m.create.mockReturnValue("test-cookie"); });
const request = (body: unknown = { loginName: "Alice", password: "test-password" }, origin = "http://localhost") => new Request("http://localhost/api/chat/session", { method: "POST", headers: { origin }, body: JSON.stringify(body) });
it("rejects cross-origin login and oversized bodies before verifying passwords", async () => {
  expect((await POST(request({}, "https://evil.example"))).status).toBe(403);
  expect((await POST(request({ password: "x".repeat(5000) }))).status).toBe(413);
  expect(m.auth).not.toHaveBeenCalled();
});
it("uses database identity, ignores browser identity/role and revokes before issuing", async () => {
  m.auth.mockResolvedValue({ id: "a1", customerId: "customer-1", version: 2 });
  const response = await POST(request({ loginName: "Alice", password: "test-password", customerId: "customer-2", role: "operator" }));
  expect(m.auth).toHaveBeenCalledWith("alice", "test-password");
  expect(m.create).toHaveBeenCalledWith("customer-1", expect.any(Number), { id: "a1", version: 2 });
  expect(m.revoke).toHaveBeenCalledOnce();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("returns generic invalid login and does not replace an existing session", async () => {
  m.auth.mockResolvedValue(null);
  const response = await POST(request());
  expect(response.status).toBe(401);
  expect(m.revoke).not.toHaveBeenCalled();
  expect(response.headers.get("set-cookie")).toBeNull();
});
it("throttles before password work and fails closed on revocation storage failure", async () => {
  m.reserve.mockReturnValue(900);
  const blocked = await POST(request());
  expect(blocked.status).toBe(429);
  expect(blocked.headers.get("retry-after")).toBe("900");
  expect(m.auth).not.toHaveBeenCalled();
  m.reserve.mockReturnValue(0);
  m.auth.mockResolvedValue({ id: "a1", customerId: "customer-1", version: 1 });
  m.revoke.mockRejectedValue(new Error("private database error"));
  const failed = await POST(request());
  expect(failed.status).toBe(503);
  expect(failed.headers.get("set-cookie")).toBeNull();
  expect(await failed.text()).not.toContain("private database error");
});
