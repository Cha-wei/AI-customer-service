// @vitest-environment node
import { CustomerLoginLimit } from "./login-limit";
it("limits each account, permits another, and expires the window", () => {
  const limit = new CustomerLoginLimit();
  for (let i = 0; i < 5; i++) expect(limit.reserve("a", 1000)).toBe(0);
  expect(limit.reserve("a", 1000)).toBe(900);
  expect(limit.reserve("b", 1000)).toBe(0);
  expect(limit.reserve("a", 901000)).toBe(0);
});
it("bounds work even for arbitrary new usernames; success cannot reset the global cap", () => {
  const limit = new CustomerLoginLimit();
  for (let i = 0; i < 50; i++) { expect(limit.reserve(String(i), 1000)).toBe(0); limit.success(String(i)); }
  expect(limit.reserve("another", 1000)).toBe(900);
});
