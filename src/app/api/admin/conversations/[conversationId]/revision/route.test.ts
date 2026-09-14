// @vitest-environment node
import { GET } from "./route";
const m = vi.hoisted(() => ({ auth: vi.fn(), read: vi.fn() }));
vi.mock("@/modules/admin-auth", () => ({ requireAdminSession: m.auth }));
vi.mock("@/components/workspace/workspace-snapshot", () => ({ readWorkspaceSnapshot: m.read }));
beforeEach(() => vi.resetAllMocks());
const context = { params: Promise.resolve({ conversationId: "c" }) };
const request = new Request("http://localhost/api/admin/conversations/c/revision");
it("authenticates before reading and only exposes an uncached revision", async () => {
  m.auth.mockRejectedValueOnce(new Error("unauthorized"));
  await expect(GET(request, context)).rejects.toThrow("unauthorized");
  expect(m.read).not.toHaveBeenCalled();
  m.read.mockResolvedValue({ revision: "v1", latestExecution: { toolResult: "private" } });
  const response = await GET(request, context);
  expect(await response.json()).toEqual({ revision: "v1" });
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("does not leak storage errors", async () => {
  m.read.mockRejectedValue(new Error("private credentials"));
  const response = await GET(request, context);
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private credentials");
});
