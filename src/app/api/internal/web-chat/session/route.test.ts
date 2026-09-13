// @vitest-environment node
import { POST } from "./route";
import { createCustomerSession } from "@/modules/web-chat/session";
import { AccessError } from "@/modules/internal-auth";
const m = vi.hoisted(() => ({ auth: vi.fn(), customer: vi.fn() }));
vi.mock("@/modules/internal-auth", async importOriginal => ({ ...await importOriginal<typeof import("@/modules/internal-auth")>(), authenticate: m.auth }));
vi.mock("@/modules/customer-context/composition-root", () => ({ getCustomerContextProvider: () => ({ getCustomer: m.customer }) }));
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("WEB_CHAT_SESSION_SECRET", "test-only-session-secret-".repeat(3)); });
afterEach(() => vi.unstubAllEnvs());
const request = () => new Request("http://localhost/api/internal/web-chat/session", { method: "POST", body: JSON.stringify({ customerId: "customer-2" }) });
it("does not allow customer credentials or anonymous requests to provision an identity", async () => {
  m.auth.mockReturnValue({ role: "customer", customerId: "customer-1" });
  expect((await POST(request())).status).toBe(403);
  m.auth.mockImplementation(() => { throw new AccessError(401, "unauthorized"); });
  expect((await POST(request())).status).toBe(401);
  expect(m.customer).not.toHaveBeenCalled();
});
it("validates the customer and issues a protected cookie only for an operator", async () => {
  m.auth.mockReturnValue({ role: "operator" });
  m.customer.mockResolvedValue(null);
  expect((await POST(request())).status).toBe(400);
  m.customer.mockResolvedValue({ id: "customer-2" });
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  expect(response.headers.get("set-cookie")).toContain("SameSite=strict");
  expect(await response.json()).toEqual({ ok: true });
});
it("does not accept a customer session as an internal API credential", async () => {
  m.auth.mockImplementation(() => { throw new AccessError(401, "unauthorized"); });
  const response = await POST(new Request("http://localhost/api/internal/web-chat/session", { method: "POST", headers: { cookie: `customer_session=${createCustomerSession("customer-1")}` } }));
  expect(response.status).toBe(401);
});
