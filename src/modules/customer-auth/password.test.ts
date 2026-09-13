// @vitest-environment node
import { hashPassword, verifyPassword } from "./password";
it("salts independently and rejects wrong, missing or malformed hashes", async () => {
  const password = "test-only-password-123";
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  expect(first).not.toBe(second);
  expect(first).not.toContain(password);
  expect(await verifyPassword(password, first)).toBe(true);
  expect(await verifyPassword("incorrect", first)).toBe(false);
  expect(await verifyPassword(password, undefined)).toBe(false);
  expect(await verifyPassword(password, "invalid")).toBe(false);
  await expect(hashPassword("short")).rejects.toThrow();
});
