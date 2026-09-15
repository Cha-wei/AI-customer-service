// @vitest-environment node
import { readWorkspaceSnapshot } from "./workspace-snapshot";
const m = vi.hoisted(() => ({ findUnique: vi.fn(), groupBy: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { conversation: m } }));
it("refreshes sibling consultation navigation without changing the selected consultation", async () => {
  m.findUnique.mockResolvedValue({ customerId: "owner", status: "human_handoff", updatedAt: new Date(1000), executions: [], approvals: [], messages: [] });
  m.groupBy.mockResolvedValue([{ status: "open", _count: { _all: 1 }, _max: { updatedAt: new Date(1000) } }]);
  const first = await readWorkspaceSnapshot("selected");
  m.groupBy.mockResolvedValue([{ status: "open", _count: { _all: 2 }, _max: { updatedAt: new Date(2000) } }]);
  const second = await readWorkspaceSnapshot("selected");
  expect(first.revision).not.toBe(second.revision);
  expect(second.latestExecution).toBeNull();
  expect(m.groupBy).toHaveBeenLastCalledWith(expect.objectContaining({ where: { customerId: "owner" } }));
  expect(m.findUnique).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: "selected" } }));
});
