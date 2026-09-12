import {
  AdminAuthConfigurationError,
  createAdminSession,
  verifyAdminPassword,
  verifyAdminSession,
} from "./session";

vi.mock("server-only", () => ({}));

describe("admin session", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_UI_PASSWORD", "local-admin-password");
    vi.stubEnv("ADMIN_UI_SESSION_SECRET", "local-session-secret-with-32-characters");
  });

  it("validates the configured password without exposing it", () => {
    expect(verifyAdminPassword("local-admin-password")).toBe(true);
    expect(verifyAdminPassword("wrong-password")).toBe(false);
  });

  it("creates a signed expiring session", () => {
    const now = new Date("2026-09-12T08:00:00Z");
    const session = createAdminSession(now);
    expect(verifyAdminSession(session.value, now)).toBe(true);
    expect(verifyAdminSession(session.value, session.expires)).toBe(false);
    expect(verifyAdminSession(session.value + "tampered", now)).toBe(false);
  });

  it("fails closed when configuration is missing", () => {
    vi.stubEnv("ADMIN_UI_PASSWORD", "");
    expect(() => verifyAdminPassword("anything")).toThrow(AdminAuthConfigurationError);
  });
});
