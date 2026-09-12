import { DELETE, POST } from "./route";

vi.mock("server-only", () => ({}));

describe("admin session API", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_UI_PASSWORD", "local-admin-password");
    vi.stubEnv("ADMIN_UI_SESSION_SECRET", "local-session-secret-with-32-characters");
  });

  it("sets an HttpOnly cookie after successful login", async () => {
    const body = new FormData();
    body.set("password", "local-admin-password");
    const response = await POST(new Request("http://localhost/api/admin/session", { method: "POST", body }));
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
    const response = await POST(new Request("http://localhost/api/admin/session", { method: "POST", body }));
    expect(response.headers.get("location")).toContain("/login?error=invalid");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("expires the session cookie on logout", async () => {
    const response = await DELETE(new Request("http://localhost/api/admin/session", { method: "DELETE" }));
    expect(response.status).toBe(303);
    expect(response.headers.get("set-cookie")).toContain("admin_session=");
    expect(response.headers.get("set-cookie")).toContain("Expires=Thu, 01 Jan 1970");
  });
});
