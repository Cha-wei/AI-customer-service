// @vitest-environment node
import { createCustomerSession, verifyCustomerSession } from "./session";

afterEach(() => vi.unstubAllEnvs());
it("binds a signed, expiring session to a customer and rejects tampering", () => {
  vi.stubEnv("WEB_CHAT_SESSION_SECRET", "test-session-secret-".repeat(3));
  const value = createCustomerSession("customer-1", 1000);
  expect(verifyCustomerSession(value, 2000)).toBe("customer-1");
  expect(() => verifyCustomerSession(value, 1000 + 8 * 3600_000)).toThrow();
  expect(() => verifyCustomerSession(value + "x", 2000)).toThrow();
  expect(() => verifyCustomerSession(undefined)).toThrow();
  expect(() => verifyCustomerSession(value.replace(value.split(".")[0], Buffer.from(JSON.stringify({ customerId: "customer-2", expires: 9999999999999 })).toString("base64url")))).toThrow();
});
it("fails closed when the server secret is missing", () => {
  vi.stubEnv("WEB_CHAT_SESSION_SECRET", "");
  expect(() => createCustomerSession("customer-1")).toThrow();
});
