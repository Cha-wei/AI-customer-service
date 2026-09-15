// @vitest-environment node
import { queueRevision, readQueuePage } from "./queue-data";
import type { ConversationPage } from "@/modules/conversations/repository";
const { list } = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("./customer-queue-reader", () => ({ readCustomerQueue: list }));
it("uses the same display-name mapping, filters and pagination as the rendered queue", async () => {
  await readQueuePage({ query: " 陈雨 ", status: "human_handoff", page: "2" });
  expect(list).toHaveBeenCalledWith({}, { query: "customer-1", status: "human_handoff", page: 2, pageSize: 20 });
  await readQueuePage({ status: "invalid", page: "invalid" });
  expect(list).toHaveBeenLastCalledWith({}, { query: "", status: "", page: 1, pageSize: 20 });
});
it("detects membership/count changes and minute boundaries without changing unchanged revisions", () => {
  const page: ConversationPage = { conversations: [], total: 0, page: 1, pageSize: 20 };
  expect(queueRevision(page, 60001)).toBe(queueRevision(page, 65000));
  expect(queueRevision(page, 60001)).not.toBe(queueRevision(page, 120001));
  expect(queueRevision(page, 60001)).not.toBe(queueRevision({ ...page, total: 1 }, 60001));
});
