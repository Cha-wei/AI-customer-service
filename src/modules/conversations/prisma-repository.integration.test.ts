import { PrismaClient } from "@prisma/client";
import { AdminTransitionConflict, transitionFromAdmin } from "./admin-transition";

import { PrismaConversationRepository } from "./prisma-repository";
import { ConversationService } from "./service";
import { CustomerServiceRuntime, RuleIntentProvider } from "../agent-runtime";
import { OrderQueryTool } from "../tools";
import { MockCustomerContextProvider } from "../customer-context";
import { PrismaExecutionStore } from "../agent-runtime/prisma-execution-store";
import { PrismaExecutionReader } from "../agent-runtime/prisma-execution-reader";
import { IntentProviderError, type IntentFailureCode } from "../agent-runtime/intent-error";

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

  it("records admin updates and rejects stale or active updates", async () => {
    const conversation = await repository.create({ customerId: "customer-1", status: "open", initialMessage: { role: "customer", content: "订单查询" } });
    await transitionFromAdmin(client, conversation.id, "human_handoff");
    await expect(transitionFromAdmin(client, conversation.id, "human_handoff")).rejects.toThrow(AdminTransitionConflict);
    await transitionFromAdmin(client, conversation.id, "resolved");
    expect((await repository.findById(conversation.id))?.messages.filter((m) => m.role === "system")).toHaveLength(2);
    await expect(transitionFromAdmin(client, conversation.id, "open")).rejects.toThrow(AdminTransitionConflict);
    const active = await repository.create({ customerId: "customer-1", status: "open", initialMessage: { role: "customer", content: "订单查询" } });
    const execution = await new PrismaExecutionStore(client).begin(active.id, active.messages[0].id);
    await expect(transitionFromAdmin(client, active.id, "resolved")).rejects.toThrow(AdminTransitionConflict);
    expect((await client.runtimeExecution.findUniqueOrThrow({ where: { id: execution } })).status).toBe("running");
    expect((await repository.findById(active.id))?.messages).toHaveLength(1);
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

    const page = await repository.list({ query: "", status: "", page: 1, pageSize: 20 });

    expect(page.conversations).toHaveLength(1);
    expect(page.conversations[0].latestMessage?.content).toBe("Latest message");
  });

  it("filters, counts and clamps conversation pages in SQLite", async () => {
    for (let i = 0; i < 22; i++) {
      await repository.create({
        customerId: i === 21 ? "unrelated-account" : `customer-${i}`,
        status: i % 2 === 0 ? "open" : "resolved",
        initialMessage: { role: "customer", content: i === 20 ? "special order" : "hello" },
      });
    }

    const second = await repository.list({ query: "customer", status: "", page: 2, pageSize: 20 });
    expect(second).toMatchObject({ page: 2, pageSize: 20, total: 21 });
    expect(second.conversations).toHaveLength(1);

    const filtered = await repository.list({ query: "special", status: "open", page: 99, pageSize: 20 });
    expect(filtered).toMatchObject({ page: 1, total: 1 });
    expect(filtered.conversations[0].customerId).toBe("customer-20");
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

  it("isolates customer rows and totals before pagination", async () => {
    await client.conversation.createMany({ data: Array.from({ length: 45 }, (_, i) => ({
      id: `scoped-${String(i).padStart(3, "0")}`, customerId: i < 21 ? "owner" : "other", status: "open", updatedAt: new Date(0),
    })) });
    const page = await repository.list({ customerId: "owner", query: "", status: "", page: 2, pageSize: 20 });
    expect(page.total).toBe(21);
    expect(page.conversations.map((item) => item.id)).toEqual(["scoped-000"]);
    const empty = await repository.list({ customerId: "missing", query: "", status: "", page: 2, pageSize: 20 });
    expect(empty).toMatchObject({ conversations: [], total: 0, page: 1 });
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

  it("reads execution pages scoped to a conversation with decoded results", async () => {
    const service = new ConversationService(repository);
    const first = await service.create({ customerId: "customer-1", initialMessage: "查订单" });
    const second = await service.create({ customerId: "customer-2", initialMessage: "查订单" });
    await client.runtimeExecution.createMany({ data: Array.from({ length: 51 }, (_, i) => ({
      id: `execution-${String(i).padStart(3, "0")}`, conversationId: first.id, messageId: `source-${i}`,
      status: "completed", createdAt: new Date(0), toolResult: JSON.stringify({ ok: true }),
    })) });
    const reader = new PrismaExecutionReader(client);
    const page = await reader.list(first.id);
    expect(page.executions).toHaveLength(50);
    expect(page.nextOffset).toBe(50);
    expect(page.executions[0].toolResult).toEqual({ ok: true });
    const last = await reader.list(first.id, page.nextOffset!);
    expect(last.executions.map((record) => record.id)).toEqual(["execution-050"]);
    expect(last.nextOffset).toBeNull();
    expect(await reader.list(second.id)).toEqual({ executions: [], nextOffset: null });
    await expect(reader.list("missing")).rejects.toThrow("was not found");
    await expect(reader.list(first.id, -1)).rejects.toThrow("Invalid");
  });

  it.each<IntentFailureCode>(["MODEL_TIMEOUT", "MODEL_UNAVAILABLE", "MODEL_INVALID_OUTPUT", "MODEL_REFUSED"])("persists %s and a handoff reply without calling tools", async (code) => {
    const service = new ConversationService(repository);
    const created = await service.create({ customerId: "customer-1", initialMessage: "查订单" });
    const tool = new OrderQueryTool(new MockCustomerContextProvider());
    const execute = vi.spyOn(tool, "execute");
    const runtime = new CustomerServiceRuntime(service, {
      classify: async () => { throw new IntentProviderError(code); },
    }, { orderQuery: tool }, new PrismaExecutionStore(client));
    const result = await runtime.run(created.id);
    expect(result.status).toBe("human_handoff");
    expect(result.reply.content).toContain("人工");
    expect(execute).not.toHaveBeenCalled();
    expect((await repository.findById(created.id))?.status).toBe("human_handoff");
    expect(await client.runtimeExecution.findFirst()).toMatchObject({ status: "failed", errorCode: code, toolResult: null });
  });
});
