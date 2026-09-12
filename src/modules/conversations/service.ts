import {
  canTransitionConversation,
  isMessageRole,
  type Conversation,
  type ConversationStatus,
  type Message,
  type MessageRole,
} from "./domain";
import {
  ConversationNotFoundError,
  ConversationValidationError,
  InvalidConversationTransitionError,
} from "./errors";
import type { ConversationHeader, ConversationPage, ConversationRepository } from "./repository";

const MAX_CUSTOMER_ID_LENGTH = 128;
const MAX_MESSAGE_LENGTH = 10_000;
const CONVERSATION_PAGE_SIZE = 20;
export const MESSAGE_PAGE_SIZE = 50;

export interface SerializedMessagePage {
  messages: Message[];
  nextCursor: string | null;
}

export interface CreateConversationInput {
  customerId: string;
  initialMessage: string;
}

export interface AppendMessageInput {
  conversationId: string;
  role: MessageRole;
  content: string;
}

export class ConversationService {
  constructor(private readonly repository: ConversationRepository) {}

  async create(input: CreateConversationInput): Promise<Conversation> {
    const customerId = validateText(
      input.customerId,
      "customerId",
      MAX_CUSTOMER_ID_LENGTH,
    );
    const initialMessage = validateText(
      input.initialMessage,
      "initialMessage",
      MAX_MESSAGE_LENGTH,
    );

    return this.repository.create({
      customerId,
      status: "open",
      initialMessage: {
        role: "customer",
        content: initialMessage,
      },
    });
  }

  async appendMessage(input: AppendMessageInput): Promise<Message> {
    const conversationId = validateText(input.conversationId, "conversationId", 128);
    if (!isMessageRole(input.role)) {
      throw new ConversationValidationError("role is invalid.");
    }

    const content = validateText(input.content, "content", MAX_MESSAGE_LENGTH);
    const message = await this.repository.appendMessage({
      conversationId,
      role: input.role,
      content,
    });

    if (!message) {
      throw new ConversationNotFoundError(conversationId);
    }

    return message;
  }

  async get(conversationId: string): Promise<Conversation> {
    const id = validateText(conversationId, "conversationId", 128);
    const conversation = await this.repository.findById(id);

    if (!conversation) {
      throw new ConversationNotFoundError(id);
    }

    return conversation;
  }

  async getHeader(conversationId: string): Promise<ConversationHeader> {
    const id = validateText(conversationId, "conversationId", 128);
    const conversation = await this.repository.findHeaderById(id);
    if (!conversation) throw new ConversationNotFoundError(id);
    return conversation;
  }

  async listMessages(input: { conversationId: string; customerId?: string; before?: string }): Promise<SerializedMessagePage> {
    const conversationId = validateText(input.conversationId, "conversationId", 128);
    const before = input.before ? decodeMessageCursor(input.before) : undefined;
    const page = await this.repository.listMessages({
      conversationId,
      ...(input.customerId ? { customerId: validateText(input.customerId, "customerId", MAX_CUSTOMER_ID_LENGTH) } : {}),
      ...(before ? { before } : {}),
      pageSize: MESSAGE_PAGE_SIZE,
    });
    if (!page) throw new ConversationNotFoundError(conversationId);
    return { messages: page.messages, nextCursor: page.nextCursor ? encodeMessageCursor(page.nextCursor) : null };
  }

  list(input: { customerId?: string; query?: string; status?: ConversationStatus | ""; page?: number } = {}): Promise<ConversationPage> {
    const requestedPage = input.page ?? 1;
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    return this.repository.list({
      ...(input.customerId ? { customerId: input.customerId } : {}),
      query: input.query?.trim() ?? "",
      status: input.status ?? "",
      page,
      pageSize: CONVERSATION_PAGE_SIZE,
    });
  }

  async transition(
    conversationId: string,
    nextStatus: ConversationStatus,
  ): Promise<Conversation> {
    const conversation = await this.get(conversationId);

    if (!canTransitionConversation(conversation.status, nextStatus)) {
      throw new InvalidConversationTransitionError(
        conversation.status,
        nextStatus,
      );
    }

    const updated = await this.repository.updateStatus(
      conversation.id,
      nextStatus,
    );

    if (!updated) {
      throw new ConversationNotFoundError(conversation.id);
    }

    return updated;
  }
}

function encodeMessageCursor(cursor: { createdAt: Date; id: string }): string {
  return Buffer.from(JSON.stringify([cursor.createdAt.toISOString(), cursor.id])).toString("base64url");
}

function decodeMessageCursor(value: string): { createdAt: Date; id: string } {
  try {
    const decoded: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!Array.isArray(decoded) || decoded.length !== 2 || typeof decoded[0] !== "string" || typeof decoded[1] !== "string" || !decoded[1]) throw new Error();
    const createdAt = new Date(decoded[0]);
    if (Number.isNaN(createdAt.getTime())) throw new Error();
    return { createdAt, id: decoded[1] };
  } catch {
    throw new ConversationValidationError("before cursor is invalid.");
  }
}

function validateText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ConversationValidationError(field + " is required.");
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new ConversationValidationError(
      field + " must be at most " + maxLength + " characters.",
    );
  }

  return normalized;
}
