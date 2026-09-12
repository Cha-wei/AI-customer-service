import { LoginLimit } from "./login-limit";
it("expires the login budget and resets it on success", () => {
  const limit = new LoginLimit();
  for (let i = 0; i < 5; i++) expect(limit.reserve(0)).toBe(0);
  expect(limit.reserve(1)).toBe(900);
  expect(limit.reserve(900_000)).toBe(0);
  limit.reset();
  for (let i = 0; i < 5; i++) expect(limit.reserve(900_001)).toBe(0);
});
