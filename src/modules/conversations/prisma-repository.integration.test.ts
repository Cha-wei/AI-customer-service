import { PrismaClient } from "@prisma/client";

import { PrismaConversationRepository } from "./prisma-repository";
import { ConversationService } from "./service";
import { CustomerServiceRuntime, RuleIntentProvider } from "../agent-runtime";
import { OrderQueryTool } from "../tools";
import { MockCustomerContextProvider } from "../customer-context";
import { PrismaExecutionStore } from "../agent-runtime/prisma-execution-store";

describe("PrismaConversationRepository", () => {
  const client = new PrismaClient();
  const repository = new PrismaConversationRepository(client);

  beforeAll(async () => {
    await client.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "RuntimeExecution" ("id" TEXT NOT NULL PRIMARY KEY, "conversationId" TEXT NOT NULL, "messageId" TEXT NOT NULL UNIQUE, "status" TEXT NOT NULL, "toolResult" TEXT, "errorCode" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "finishedAt" DATETIME)');
    await client.$executeRawUnsafe("PRAGMA foreign_keys = ON");
    await client.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS "Conversation" ("id" TEXT NOT NULL PRIMARY KEY, "customerId" TEXT NOT NULL, "status" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL)',
    );
    await client.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS "Message" ("id" TEXT NOT NULL PRIMARY KEY, "conversationId" TEXT NOT NULL, "role" TEXT NOT NULL, "content" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE)',
    );
  });

  beforeEach(async () => {
    await client.runtimeExecution.deleteMany();
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
    }, new PrismaExecutionStore(client));
    const result = await runtime.run(created.id);
    const stored = await repository.findById(created.id);
    expect(stored?.status).toBe("open");
    expect(stored?.messages).toHaveLength(2);
    expect(stored?.messages.find((message) => message.id === result.reply.id)?.content).toContain("运输中");
    expect(await client.runtimeExecution.findFirst()).toMatchObject({ status: "completed", messageId: created.messages[0].id });
  });

  it("recovers expired executions and fences off late replies", async () => {
    const service = new ConversationService(repository);
    const created = await service.create({ customerId: "customer-1", initialMessage: "查订单" });
    const store = new PrismaExecutionStore(client);
    const executionId = await store.begin(created.id, created.messages[0].id);
    await expect(store.begin(created.id, created.messages[0].id)).rejects.toThrow();
    expect(await store.recoverExpired(new Date(0))).toBe(0);
    await client.runtimeExecution.update({ where: { id: executionId }, data: { createdAt: new Date(0) } });
    expect(await store.recoverExpired(new Date())).toBe(1);
    expect(await store.recoverExpired(new Date())).toBe(0);
    await expect(store.complete(executionId, "late reply", "open", null)).rejects.toThrow();
    expect((await repository.findById(created.id))?.status).toBe("human_handoff");
    expect(await client.message.count()).toBe(1);
    expect(await client.runtimeExecution.findUnique({ where: { id: executionId } })).toMatchObject({ status: "failed", errorCode: "EXECUTION_EXPIRED" });
  });

  it("rolls back completion if conversation state changed", async () => {
    const created = await new ConversationService(repository).create({ customerId: "customer-1", initialMessage: "查订单" });
    const store = new PrismaExecutionStore(client);
    const id = await store.begin(created.id, created.messages[0].id);
    await repository.updateStatus(created.id, "human_handoff");
    await expect(store.complete(id, "reply", "open", null)).rejects.toThrow();
    expect(await client.runtimeExecution.findUnique({ where: { id } })).toMatchObject({ status: "running" });
    expect(await client.message.count()).toBe(1);
    await store.fail(id);
    expect(await client.runtimeExecution.findUnique({ where: { id } })).toMatchObject({ status: "failed" });
  });
});
