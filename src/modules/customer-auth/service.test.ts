// @vitest-environment node
import { authenticateCustomer } from "./service";
const m = vi.hoisted(() => ({ find: vi.fn(), verify: vi.fn(), customer: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { customerAccount: { findUnique: m.find } } }));
vi.mock("./password", async original => ({ ...await original<typeof import("./password")>(), verifyPassword: m.verify }));
vi.mock("@/modules/customer-context/composition-root", () => ({ getCustomerContextProvider: () => ({ getCustomer: m.customer }) }));
beforeEach(() => { vi.resetAllMocks(); });
it("requires password, enabled account and valid customer mapping", async () => {
  const account = { id: "a1", customerId: "customer-1", passwordHash: "hash", enabled: true, sessionVersion: 1 };
  m.find.mockResolvedValue(account); m.verify.mockResolvedValue(true); m.customer.mockResolvedValue({ id: "customer-1" });
  expect(await authenticateCustomer("alice", "password")).toEqual({ id: "a1", customerId: "customer-1", version: 1 });
  m.find.mockResolvedValue({ ...account, enabled: false });
  expect(await authenticateCustomer("alice", "password")).toBeNull();
  m.find.mockResolvedValue(account); m.customer.mockResolvedValue(null);
  expect(await authenticateCustomer("alice", "password")).toBeNull();
  m.verify.mockResolvedValue(false);
  expect(await authenticateCustomer("alice", "password")).toBeNull();
});
it("does password work for unknown users without exposing existence", async () => {
  m.find.mockResolvedValue(null); m.verify.mockResolvedValue(false);
  expect(await authenticateCustomer("unknown", "password")).toBeNull();
  expect(m.verify).toHaveBeenCalledWith("password", undefined);
});
