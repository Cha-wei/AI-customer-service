export const CONVERSATION_STATUSES = [
  "open",
  "processing",
  "waiting_approval",
  "human_handoff",
  "resolved",
] as const;

export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export const MESSAGE_ROLES = ["customer", "agent", "human", "system"] as const;

export type MessageRole = (typeof MESSAGE_ROLES)[number];

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  customerId: string;
  status: ConversationStatus;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationSummary {
  id: string;
  customerId: string;
  status: ConversationStatus;
  latestMessage: Message | null;
  createdAt: Date;
  updatedAt: Date;
}

const ALLOWED_TRANSITIONS: Record<ConversationStatus, readonly ConversationStatus[]> = {
  open: ["processing", "human_handoff", "resolved"],
  processing: ["open", "waiting_approval", "human_handoff", "resolved"],
  waiting_approval: ["processing", "human_handoff", "resolved"],
  human_handoff: ["resolved"],
  resolved: [],
};

export function canTransitionConversation(
  current: ConversationStatus,
  next: ConversationStatus,
): boolean {
  return ALLOWED_TRANSITIONS[current].includes(next);
}

export function isConversationStatus(value: string): value is ConversationStatus {
  return CONVERSATION_STATUSES.includes(value as ConversationStatus);
}

export function isMessageRole(value: string): value is MessageRole {
  return MESSAGE_ROLES.includes(value as MessageRole);
}
