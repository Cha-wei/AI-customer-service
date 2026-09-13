// @vitest-environment node
import { createCustomerSession, customerIdentity, revokeCustomerSession } from "./session";
const m = vi.hoisted(() => ({ cookie: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: m.cookie }) }));
vi.mock("@/lib/prisma", () => ({ prisma: { revokedCustomerSession: { findUnique: m.findUnique, upsert: m.upsert } } }));
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("WEB_CHAT_SESSION_SECRET", "session-test-".repeat(4)); });
afterEach(() => vi.unstubAllEnvs());
it("persists only a digest and rejects replay of a revoked cookie", async () => {
  const value = createCustomerSession("customer-1");
  m.cookie.mockReturnValue({ value });
  expect(await customerIdentity()).toBe("customer-1");
  await revokeCustomerSession();
  expect(m.upsert).toHaveBeenCalledOnce();
  const data = m.upsert.mock.calls[0][0];
  expect(data.create.digest).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(data)).not.toContain(value);
  m.findUnique.mockResolvedValue(data.create);
  await expect(customerIdentity()).rejects.toMatchObject({ status: 401 });
});
it("gives repeated sign-ins distinct sessions even at the same instant", () => {
  expect(createCustomerSession("customer-1", 1000)).not.toBe(createCustomerSession("customer-1", 1000));
});
it("fails closed when revocation storage is unavailable", async () => {
  m.cookie.mockReturnValue({ value: createCustomerSession("customer-1") });
  m.findUnique.mockRejectedValue(new Error("unavailable"));
  await expect(customerIdentity()).rejects.toThrow();
});
