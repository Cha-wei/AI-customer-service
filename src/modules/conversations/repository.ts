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

export interface ListConversationsQuery {
  customerId?: string;
  query: string;
  status: ConversationStatus | "";
  page: number;
  pageSize: number;
}

export interface ConversationPage {
  conversations: ConversationSummary[];
  page: number;
  pageSize: number;
  total: number;
}

export interface MessageCursor {
  createdAt: Date;
  id: string;
}

export interface MessagePage {
  messages: Message[];
  nextCursor: MessageCursor | null;
}

export type ConversationHeader = Omit<Conversation, "messages">;

export interface ConversationRepository {
  create(input: CreateConversationRecord): Promise<Conversation>;
  appendMessage(input: AppendMessageRecord): Promise<Message | null>;
  findById(conversationId: string): Promise<Conversation | null>;
  findHeaderById(conversationId: string): Promise<ConversationHeader | null>;
  listMessages(input: {
    conversationId: string;
    customerId?: string;
    before?: MessageCursor;
    pageSize: number;
  }): Promise<MessagePage | null>;
  list(query: ListConversationsQuery): Promise<ConversationPage>;
  updateStatus(
    conversationId: string,
    status: ConversationStatus,
  ): Promise<Conversation | null>;
}
