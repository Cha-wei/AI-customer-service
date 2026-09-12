import { PrismaClient } from "@prisma/client";

import { PrismaConversationRepository } from "./prisma-repository";
import { ConversationService } from "./service";
import { CustomerServiceRuntime, RuleIntentProvider } from "../agent-runtime";
import { OrderQueryTool } from "../tools";
import { MockCustomerContextProvider } from "../customer-context";

describe("PrismaConversationRepository", () => {
  const client = new PrismaClient();
  const repository = new PrismaConversationRepository(client);

  beforeAll(async () => {
    await client.$executeRawUnsafe("PRAGMA foreign_keys = ON");
    await client.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS "Conversation" ("id" TEXT NOT NULL PRIMARY KEY, "customerId" TEXT NOT NULL, "status" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL)',
    );
    await client.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS "Message" ("id" TEXT NOT NULL PRIMARY KEY, "conversationId" TEXT NOT NULL, "role" TEXT NOT NULL, "content" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE)',
    );
  });

  beforeEach(async () => {
    await client.message.deleteMany();
    await client.conversation.deleteMany();
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  it("persists a conversation and returns its ordered message history", async () => {
    const created = await repository.create({
      customerId: "customer-1",
      status: "open",
      initialMessage: {
        role: "customer",
        content: "Where is my order?",
      },
    });

    const reply = await repository.appendMessage({
      conversationId: created.id,
      role: "agent",
      content: "It is in transit.",
    });
    const loaded = await repository.findById(created.id);

    expect(reply?.conversationId).toBe(created.id);
    expect(loaded?.messages.map((message) => message.content)).toEqual([
      "Where is my order?",
      "It is in transit.",
    ]);
  });

  it("returns the latest message in the conversation list", async () => {
    const created = await repository.create({
      customerId: "customer-2",
      status: "open",
      initialMessage: {
        role: "customer",
        content: "First message",
      },
    });
    await repository.appendMessage({
      conversationId: created.id,
      role: "system",
      content: "Latest message",
    });

    const conversations = await repository.list();

    expect(conversations).toHaveLength(1);
    expect(conversations[0].latestMessage?.content).toBe("Latest message");
  });

  it("returns null when appending to a missing conversation", async () => {
    await expect(
      repository.appendMessage({
        conversationId: "missing",
        role: "customer",
        content: "Hello",
      }),
    ).resolves.toBeNull();
  });

  it("persists the runtime order-query reply and final state in SQLite", async () => {
    const service = new ConversationService(repository);
    const created = await service.create({ customerId: "customer-1", initialMessage: "我的订单什么时候到？" });
    const runtime = new CustomerServiceRuntime(service, new RuleIntentProvider(), {
      orderQuery: new OrderQueryTool(new MockCustomerContextProvider()),
    });
    const result = await runtime.run(created.id);
    const stored = await repository.findById(created.id);
    expect(stored?.status).toBe("open");
    expect(stored?.messages).toHaveLength(2);
    expect(stored?.messages.find((message) => message.id === result.reply.id)?.content).toContain("运输中");
  });
});
