import {
  Prisma,
  PrismaClient,
  type Conversation as ConversationRecord,
} from "@prisma/client";

import {
  isConversationStatus,
  isMessageRole,
  type Conversation,
  type ConversationSummary,
  type Message,
} from "./domain";
import type {
  AppendMessageRecord,
  ConversationPage,
  ConversationRepository,
  CreateConversationRecord,
  ListConversationsQuery,
  MessagePage,
} from "./repository";

type ConversationWithMessages = Prisma.ConversationGetPayload<{
  include: { messages: true };
}>;

type ConversationWithLatestMessage = ConversationRecord & {
  messages: Prisma.MessageGetPayload<Record<string, never>>[];
  _count: { messages: number };
};

export class PrismaConversationRepository implements ConversationRepository {
  constructor(private readonly client: PrismaClient) {}

  async create(input: CreateConversationRecord): Promise<Conversation> {
    const record = await this.client.conversation.create({
      data: {
        customerId: input.customerId,
        status: input.status,
        ...(input.status === "human_handoff" ? { humanHandoffAt: new Date() } : {}),
        messages: {
          create: input.initialMessage,
        },
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return mapConversation(record);
  }

  async appendMessage(input: AppendMessageRecord): Promise<Message | null> {
    try {
      const [, message] = await this.client.$transaction([
        this.client.conversation.update({
          where: { id: input.conversationId },
          data: { updatedAt: new Date() },
        }),
        this.client.message.create({
          data: {
            conversationId: input.conversationId,
            role: input.role,
            content: input.content,
          },
        }),
      ]);

      return mapMessage(message);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2025" || error.code === "P2003")
      ) {
        return null;
      }

      throw error;
    }
  }

  async findById(conversationId: string): Promise<Conversation | null> {
    const record = await this.client.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
    });

    return record ? mapConversation(record) : null;
  }

  async findHeaderById(conversationId: string) {
    const record = await this.client.conversation.findUnique({ where: { id: conversationId } });
    if (!record || !isConversationStatus(record.status)) return null;
    return { id: record.id, customerId: record.customerId, status: record.status, createdAt: record.createdAt, updatedAt: record.updatedAt };
  }

  async listMessages(input: { conversationId: string; customerId?: string; before?: { createdAt: Date; id: string }; pageSize: number }): Promise<MessagePage | null> {
    const conversation = await this.client.conversation.findFirst({
      where: { id: input.conversationId, ...(input.customerId ? { customerId: input.customerId } : {}) },
      select: { id: true },
    });
    if (!conversation) return null;
    const records = await this.client.message.findMany({
      where: {
        conversationId: input.conversationId,
        ...(input.before ? { OR: [
          { createdAt: { lt: input.before.createdAt } },
          { createdAt: input.before.createdAt, id: { lt: input.before.id } },
        ] } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.pageSize + 1,
    });
    const hasMore = records.length > input.pageSize;
    const pageRecords = records.slice(0, input.pageSize);
    const oldest = pageRecords.at(-1);
    return {
      messages: pageRecords.reverse().map(mapMessage),
      nextCursor: hasMore && oldest ? { createdAt: oldest.createdAt, id: oldest.id } : null,
    };
  }

  async list(input: ListConversationsQuery): Promise<ConversationPage> {
    const where: Prisma.ConversationWhereInput = {
      ...(input.customerId ? { customerId: input.customerId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.query ? {
        OR: [
          { customerId: { contains: input.query } },
          { messages: { some: { content: { contains: input.query } } } },
        ],
      } : {}),
    };
    return this.client.$transaction(async (tx) => {
      const total = await tx.conversation.count({ where });
      const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
      const page = Math.min(input.page, totalPages);
      const records = await tx.conversation.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * input.pageSize,
        take: input.pageSize,
        include: {
          _count: { select: { messages: { where: { role: "human" } } } },
          messages: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 1,
          },
        },
      });
      return { conversations: records.map(mapSummary), page, pageSize: input.pageSize, total };
    });
  }

  async updateStatus(
    conversationId: string,
    status: Conversation["status"],
  ): Promise<Conversation | null> {
    try {
      const record = await this.client.conversation.update({
        where: { id: conversationId },
        data: { status, ...(status === "human_handoff" ? { humanHandoffAt: new Date() } : {}) },
        include: {
          messages: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
        },
      });

      return mapConversation(record);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return null;
      }

      throw error;
    }
  }
}

function mapConversation(record: ConversationWithMessages): Conversation {
  if (!isConversationStatus(record.status)) {
    throw new Error("Unknown conversation status in persistence: " + record.status);
  }

  return {
    id: record.id,
    customerId: record.customerId,
    status: record.status,
    messages: record.messages.map(mapMessage),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapSummary(record: ConversationWithLatestMessage): ConversationSummary {
  if (!isConversationStatus(record.status)) {
    throw new Error("Unknown conversation status in persistence: " + record.status);
  }

  return {
    id: record.id,
    customerId: record.customerId,
    status: record.status,
    latestMessage: record.messages[0] ? mapMessage(record.messages[0]) : null,
    humanHandoffAt: record.humanHandoffAt,
    hasHumanReply: record._count.messages > 0,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapMessage(record: {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  createdAt: Date;
}): Message {
  if (!isMessageRole(record.role)) {
    throw new Error("Unknown message role in persistence: " + record.role);
  }

  return {
    id: record.id,
    conversationId: record.conversationId,
    role: record.role,
    content: record.content,
    createdAt: record.createdAt,
  };
}
