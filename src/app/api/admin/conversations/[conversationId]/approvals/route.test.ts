import { POST } from "./route";
import { RuntimeConflictError } from "@/modules/agent-runtime";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), decide: vi.fn() }));
vi.mock("@/modules/admin-auth", () => ({ requireAdminSession: mocks.auth }));
vi.mock("@/modules/approvals/composition-root", () => ({ getApprovalService: () => ({ decide: mocks.decide }) }));
beforeEach(() => { mocks.auth.mockReset(); mocks.decide.mockReset(); });
const call = (origin = "http://localhost", decision = "approve") => {
  const body = new FormData(); body.set("approvalId", "approval-1"); body.set("decision", decision);
  return POST(new Request("http://localhost/api/admin/conversations/c/approvals", { method: "POST", headers: { origin }, body }), { params: Promise.resolve({ conversationId: "c" }) });
};
it("requires an admin session before reading form data or changing approvals", async () => {
  mocks.auth.mockRejectedValue(new Error("login required"));
  await expect(call()).rejects.toThrow("login required");
  expect(mocks.decide).not.toHaveBeenCalled();
});
it("rejects cross-origin and missing origin decisions", async () => {
  expect((await call("https://foreign.example")).status).toBe(403);
  expect((await call("")).status).toBe(403);
  expect(mocks.decide).not.toHaveBeenCalled();
});
it.each(["approve", "reject"])("passes the scoped %s decision", async decision => {
  const response = await call("http://localhost", decision);
  expect(response.status).toBe(303);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(mocks.decide).toHaveBeenCalledWith("c", "approval-1", decision);
});
it("reports stale decisions and hides unexpected failure details", async () => {
  mocks.decide.mockRejectedValueOnce(new RuntimeConflictError("stale"));
  expect((await call()).headers.get("location")).toContain("notice=conflict");
  mocks.decide.mockRejectedValueOnce(new Error("private database details"));
  const response = await call();
  expect(response.headers.get("location")).toContain("notice=error");
  expect(await response.text()).not.toContain("private database details");
});
