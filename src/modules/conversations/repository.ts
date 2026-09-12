import type {
  Conversation,
  ConversationStatus,
  ConversationSummary,
  Message,
  MessageRole,
} from "./domain";

export interface CreateConversationRecord {
  customerId: string;
  status: ConversationStatus;
  initialMessage: {
    role: MessageRole;
    content: string;
  };
}

export interface AppendMessageRecord {
  conversationId: string;
  role: MessageRole;
  content: string;
}

export interface ConversationRepository {
  create(input: CreateConversationRecord): Promise<Conversation>;
  appendMessage(input: AppendMessageRecord): Promise<Message | null>;
  findById(conversationId: string): Promise<Conversation | null>;
  list(): Promise<ConversationSummary[]>;
  updateStatus(
    conversationId: string,
    status: ConversationStatus,
  ): Promise<Conversation | null>;
}
