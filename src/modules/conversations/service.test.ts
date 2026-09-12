import type { Conversation, ConversationSummary, Message } from "./domain";
import {
  ConversationValidationError,
  InvalidConversationTransitionError,
} from "./errors";
import type { ConversationRepository } from "./repository";
import { ConversationService } from "./service";

const now = new Date("2026-09-12T00:00:00.000Z");

function conversation(status: Conversation["status"] = "open"): Conversation {
  return {
    id: "conversation-1",
    customerId: "customer-1",
    status,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

function repositoryStub(
  overrides: Partial<ConversationRepository> = {},
): ConversationRepository {
  return {
    create: vi.fn(async () => conversation()),
    appendMessage: vi.fn(async () => null),
    findById: vi.fn(async () => conversation()),
    list: vi.fn(async (): Promise<ConversationSummary[]> => []),
    updateStatus: vi.fn(async () => conversation("processing")),
    ...overrides,
  };
}

describe("ConversationService", () => {
  it("creates an open conversation with a normalized customer message", async () => {
    const create = vi.fn(async () => conversation());
    const repository = repositoryStub({ create });
    const service = new ConversationService(repository);

    await service.create({
      customerId: "  customer-1 ",
      initialMessage: "  Where is my order? ",
    });

    expect(create).toHaveBeenCalledWith({
      customerId: "customer-1",
      status: "open",
      initialMessage: {
        role: "customer",
        content: "Where is my order?",
      },
    });
  });

  it("rejects an empty initial message", async () => {
    const service = new ConversationService(repositoryStub());

    await expect(
      service.create({ customerId: "customer-1", initialMessage: " " }),
    ).rejects.toBeInstanceOf(ConversationValidationError);
  });

  it("rejects invalid lifecycle transitions without updating persistence", async () => {
    const updateStatus = vi.fn(async () => conversation());
    const service = new ConversationService(
      repositoryStub({
        findById: vi.fn(async () => conversation("open")),
        updateStatus,
      }),
    );

    await expect(
      service.transition("conversation-1", "waiting_approval"),
    ).rejects.toBeInstanceOf(InvalidConversationTransitionError);
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it("appends a supported message role", async () => {
    const savedMessage: Message = {
      id: "message-1",
      conversationId: "conversation-1",
      role: "agent",
      content: "Your order is in transit.",
      createdAt: now,
    };
    const appendMessage = vi.fn(async () => savedMessage);
    const service = new ConversationService(
      repositoryStub({ appendMessage }),
    );

    await expect(
      service.appendMessage({
        conversationId: "conversation-1",
        role: "agent",
        content: "Your order is in transit.",
      }),
    ).resolves.toEqual(savedMessage);
  });
});
