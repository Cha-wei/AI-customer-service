// @vitest-environment node
import { GET } from "./route";
const m = vi.hoisted(() => ({ auth: vi.fn(), read: vi.fn() }));
vi.mock("@/modules/admin-auth", () => ({ requireAdminSession: m.auth }));
vi.mock("@/components/workspace/queue-data", () => ({ readQueuePage: m.read, queueRevision: () => "v1" }));
beforeEach(() => vi.resetAllMocks());
it("requires admin auth and only returns an uncached revision for the requested view", async () => {
  const request = new Request("http://localhost/api/admin/conversations/queue-revision?status=open&page=2&query=test");
  m.auth.mockRejectedValueOnce(new Error("unauthorized"));
  await expect(GET(request)).rejects.toThrow("unauthorized");
  expect(m.read).not.toHaveBeenCalled();
  m.read.mockResolvedValue({ conversations: [{ content: "private" }] });
  const response = await GET(request);
  expect(m.read).toHaveBeenCalledWith({ status: "open", page: "2", query: "test" });
  expect(await response.json()).toEqual({ revision: "v1" });
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("sanitizes failures", async () => {
  m.read.mockRejectedValue(new Error("private data"));
  const response = await GET(new Request("http://localhost/api/admin/conversations/queue-revision"));
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private data");
});
