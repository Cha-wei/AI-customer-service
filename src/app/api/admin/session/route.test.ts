import { DELETE, POST } from "./route";
import { loginLimit } from "@/modules/admin-auth/login-limit";

vi.mock("server-only", () => ({}));

describe("admin session API", () => {
  beforeEach(() => {
    loginLimit.reset();
    vi.stubEnv("ADMIN_UI_PASSWORD", "local-admin-password");
    vi.stubEnv("ADMIN_UI_SESSION_SECRET", "local-session-secret-with-32-characters");
  });

  it("sets an HttpOnly cookie after successful login", async () => {
    const body = new FormData();
    body.set("password", "local-admin-password");
    const response = await POST(new Request("http://localhost/api/admin/session", { method: "POST", headers: { origin: "http://localhost" }, body }));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/");
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("admin_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=strict");
    expect(cookie).not.toContain("local-admin-password");
  });

  it("rejects an invalid password without setting a session", async () => {
    const body = new FormData();
    body.set("password", "wrong-password");
    const response = await POST(new Request("http://localhost/api/admin/session", { method: "POST", headers: { origin: "http://localhost" }, body }));
    expect(response.headers.get("location")).toContain("/login?error=invalid");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("expires the session cookie on logout", async () => {
    const response = await DELETE(new Request("http://localhost/api/admin/session", { method: "DELETE", headers: { origin: "http://localhost" } }));
    expect(response.status).toBe(303);
    expect(response.headers.get("set-cookie")).toContain("admin_session=");
    expect(response.headers.get("set-cookie")).toContain("Expires=Thu, 01 Jan 1970");
  });
  it("blocks the sixth attempt even with a different forwarded IP", async () => {
    for (let i = 0; i < 6; i++) {
      const body = new FormData(); body.set("password", "wrong-password");
      const response = await POST(new Request("http://localhost/api/admin/session", {
        method: "POST", headers: { origin: "http://localhost", "x-forwarded-for": String(i) }, body,
      }));
      expect(response.status).toBe(i === 5 ? 429 : 303);
      if (i === 5) expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
    }
  });
  it("rejects cross-origin login and logout", async () => {
    for (const handler of [POST, DELETE]) expect((await handler(new Request("http://localhost/api/admin/session", {
      method: "POST", headers: { origin: "https://foreign.example" },
    }))).status).toBe(403);
  });
});
