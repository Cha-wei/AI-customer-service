import { readMessageActivity } from "./workspace-data";
const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { runtimeExecution: { findMany } } }));
beforeEach(() => findMany.mockReset());

it("scopes recent activity to the selected conversation and bounds the message batch", async () => {
  findMany.mockResolvedValue([]);
  const ids = Array.from({ length: 70 }, (_, i) => `m-${i}`);
  await readMessageActivity("c-1", ids);
  expect(findMany).toHaveBeenCalledWith({ where: { conversationId: "c-1", messageId: { in: ids.slice(0, 50) } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 50 });
});
it("does not query an empty page and tolerates malformed diagnostic data", async () => {
  expect(await readMessageActivity("c", [])).toEqual([]);
  expect(findMany).not.toHaveBeenCalled();
  findMany.mockResolvedValue([{ id: "e", status: "completed", toolResult: "not-json" }, { id: "bad", status: "unexpected", toolResult: null }]);
  expect(await readMessageActivity("c", ["m"])).toEqual([{ id: "e", status: "completed", toolResult: null }]);
});
