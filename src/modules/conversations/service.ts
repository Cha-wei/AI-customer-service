import {
  canTransitionConversation,
  isMessageRole,
  type Conversation,
  type ConversationStatus,
  type ConversationSummary,
  type Message,
  type MessageRole,
} from "./domain";
import {
  ConversationNotFoundError,
  ConversationValidationError,
  InvalidConversationTransitionError,
} from "./errors";
import type { ConversationRepository } from "./repository";

const MAX_CUSTOMER_ID_LENGTH = 128;
const MAX_MESSAGE_LENGTH = 10_000;

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

  list(): Promise<ConversationSummary[]> {
    return this.repository.list();
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
