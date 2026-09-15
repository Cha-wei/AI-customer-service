import type { ConversationSummary, MessageRole } from "@/modules/conversations/domain";

export const senderLabels: Record<MessageRole, string> = { customer: "客户", agent: "AI", human: "人工", system: "系统" };

// Latest customer message is the only evidence available for an unanswered turn.
// Never derive waiting time from conversation.updatedAt (status changes also update it).
export function queueAttention(conversation: Pick<ConversationSummary, "status" | "latestMessage">, now: number) {
  const { status, latestMessage } = conversation;
  const awaitingReply = latestMessage?.role === "customer" && ["open", "processing", "human_handoff"].includes(status);
  const sentAt = latestMessage ? new Date(latestMessage.createdAt).getTime() : NaN;
  const minutes = Math.floor((now - sentAt) / 60000);
  const waiting = awaitingReply && Number.isFinite(minutes) && minutes >= 0
    ? minutes < 1 ? "客户等待不足 1 分钟" : minutes < 60 ? `客户等待 ${minutes} 分钟` : minutes < 1440 ? `客户等待 ${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟` : `客户等待 ${Math.floor(minutes / 1440)} 天 ${Math.floor(minutes % 1440 / 60)} 小时`
    : null;
  return {
    label: status === "waiting_approval" ? "待审批" : status === "human_handoff" ? awaitingReply ? "待人工回复" : "人工跟进" : null,
    waiting,
    actionable: status === "waiting_approval" || status === "human_handoff",
  };
}
