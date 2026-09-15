import type { ConversationSummary, MessageRole } from "@/modules/conversations/domain";

export const senderLabels: Record<MessageRole, string> = { customer: "客户", agent: "AI", human: "人工", system: "系统" };

// Handoff time and customer message time measure different waits. Neither uses updatedAt.
export function queueAttention(conversation: Pick<ConversationSummary, "status" | "latestMessage" | "humanHandoffAt" | "hasHumanReply">, now: number) {
  const { status, latestMessage } = conversation;
  const awaitingFirstHuman = status === "human_handoff" && conversation.hasHumanReply === false;
  const awaitingReply = latestMessage?.role === "customer" && ["open", "processing", "human_handoff"].includes(status);
  const since = awaitingFirstHuman ? conversation.humanHandoffAt : latestMessage?.createdAt;
  const sentAt = since ? new Date(since).getTime() : NaN;
  const minutes = Math.floor((now - sentAt) / 60000);
  const prefix = awaitingFirstHuman ? "等待人工" : "客户等待";
  const waiting = (awaitingFirstHuman || awaitingReply) && Number.isFinite(minutes) && minutes >= 0
    ? minutes < 1 ? `${prefix}不足 1 分钟` : minutes < 60 ? `${prefix} ${minutes} 分钟` : minutes < 1440 ? `${prefix} ${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟` : `${prefix} ${Math.floor(minutes / 1440)} 天 ${Math.floor(minutes % 1440 / 60)} 小时`
    : null;
  return {
    label: status === "waiting_approval" ? "待审批" : awaitingFirstHuman ? "待人工首次回复" : status === "human_handoff" ? awaitingReply ? "待人工回复" : "人工跟进" : null,
    waiting,
    actionable: status === "waiting_approval" || status === "human_handoff",
  };
}
