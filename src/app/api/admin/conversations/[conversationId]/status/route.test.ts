import { POST } from "./route";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), transition: vi.fn() }));
vi.mock("@/modules/admin-auth", () => ({ requireAdminSession: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/modules/conversations/admin-transition", () => ({ transitionFromAdmin: mocks.transition, AdminTransitionConflict: class extends Error {} }));
beforeEach(() => { mocks.auth.mockReset(); mocks.transition.mockReset(); });
const call = (origin = "http://localhost") => {
  const body = new FormData(); body.set("status", "resolved");
  return POST(new Request("http://localhost/api/admin/conversations/c/status", { method: "POST", headers: { origin }, body }), { params: Promise.resolve({ conversationId: "c" }) });
};
it("requires authentication before mutations", async () => {
  mocks.auth.mockRejectedValue(new Error("login required"));
  await expect(call()).rejects.toThrow("login required");
  expect(mocks.transition).not.toHaveBeenCalled();
});
it("rejects cross-origin changes", async () => {
  expect((await call("https://foreign.example")).status).toBe(403);
  expect(mocks.transition).not.toHaveBeenCalled();
});
it("updates the selected conversation and hides internal errors", async () => {
  expect((await call()).status).toBe(303);
  expect(mocks.transition).toHaveBeenCalledWith({}, "c", "resolved");
  mocks.transition.mockRejectedValue(new Error("private database details"));
  const response = await call();
  expect(response.headers.get("location")).toContain("notice=error");
  expect(await response.text()).not.toContain("private database details");
});
