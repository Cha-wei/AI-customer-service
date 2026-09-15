import type { Message, ConversationStatus } from "@/modules/conversations/domain";
import { queueAttention } from "./queue-presentation";
const now = Date.parse("2026-09-15T12:00:00Z");
const message = { role: "customer", createdAt: new Date(now - 65 * 60000) } as Message;
const attention = (status: ConversationStatus, latestMessage: Message | null = message) => queueAttention({ status, latestMessage }, now);
it("distinguishes unanswered human conversations from ones staff already replied to", () => {
  expect(attention("human_handoff")).toMatchObject({ label: "待人工回复", waiting: "客户等待 1 小时 5 分钟", actionable: true });
  expect(attention("human_handoff", { ...message, role: "human" })).toMatchObject({ label: "人工跟进", waiting: null });
});
it("does not treat approvals, resolved conversations or system records as reply waits", () => {
  expect(attention("waiting_approval")).toMatchObject({ label: "待审批", waiting: null });
  expect(attention("resolved").waiting).toBeNull();
  expect(attention("open", { ...message, role: "system" }).waiting).toBeNull();
  expect(attention("human_handoff", null).waiting).toBeNull();
});
it("handles sub-minute, day-long, future and invalid timestamps without invented durations", () => {
  expect(attention("processing", { ...message, createdAt: new Date(now - 1000) }).waiting).toBe("客户等待不足 1 分钟");
  expect(attention("open", { ...message, createdAt: new Date(now - 25 * 3600000) }).waiting).toBe("客户等待 1 天 1 小时");
  expect(attention("open", { ...message, createdAt: new Date(now + 60000) }).waiting).toBeNull();
  expect(attention("open", { ...message, createdAt: new Date("invalid") }).waiting).toBeNull();
});
