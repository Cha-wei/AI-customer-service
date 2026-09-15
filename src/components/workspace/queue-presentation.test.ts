import type { Message, ConversationStatus } from "@/modules/conversations/domain";
import { queueAttention } from "./queue-presentation";
const now = Date.parse("2026-09-15T12:00:00Z");
const message = { role: "customer", createdAt: new Date(now - 65 * 60000) } as Message;
const attention = (status: ConversationStatus, latestMessage: Message | null = message) => queueAttention({ status, latestMessage }, now);
it("measures first human wait from handoff even after AI, system or customer messages", () => {
  for (const role of ["agent", "system", "customer"] as const) {
    expect(queueAttention({ status: "human_handoff", latestMessage: { ...message, role }, humanHandoffAt: new Date(now - 120000), hasHumanReply: false }, now))
      .toMatchObject({ label: "待人工首次回复", waiting: "等待人工 2 分钟" });
  }
});
it("stops first-reply timing after a human reply or closure, and preserves subsequent customer waits", () => {
  const base = { humanHandoffAt: new Date(now - 120000), hasHumanReply: true };
  expect(queueAttention({ ...base, status: "human_handoff", latestMessage: { ...message, role: "human" } }, now)).toMatchObject({ label: "人工跟进", waiting: null });
  expect(queueAttention({ ...base, status: "human_handoff", latestMessage: message }, now)).toMatchObject({ label: "待人工回复", waiting: "客户等待 1 小时 5 分钟" });
  expect(queueAttention({ ...base, hasHumanReply: false, status: "resolved", latestMessage: message }, now).waiting).toBeNull();
});
it("labels legacy first replies without inventing missing, invalid or future handoff times", () => {
  for (const humanHandoffAt of [null, new Date("invalid"), new Date(now + 60000)]) {
    expect(queueAttention({ status: "human_handoff", latestMessage: message, humanHandoffAt, hasHumanReply: false }, now)).toMatchObject({ label: "待人工首次回复", waiting: null });
  }
});
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
