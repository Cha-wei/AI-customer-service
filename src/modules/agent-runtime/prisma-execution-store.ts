import { PrismaClient } from "@prisma/client";
import type { Message } from "../conversations";
import type { ExecutionStore } from "./execution-store";
import { RuntimeConflictError, type RuntimeResult } from "./runtime";

export class PrismaExecutionStore implements ExecutionStore {
  constructor(private readonly client: PrismaClient) {}

  async begin(conversationId: string, messageId: string): Promise<string> {
    return this.client.$transaction(async (tx) => {
      const claimed = await tx.conversation.updateMany({
        where: { id: conversationId, status: "open" }, data: { status: "processing" },
      });
      if (!claimed.count) throw new RuntimeConflictError("Conversation is already processing.");
      const latest = await tx.message.findFirst({ where: { conversationId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
      if (latest?.id !== messageId || latest.role !== "customer") throw new RuntimeConflictError("Customer message changed.");
      if (await tx.runtimeExecution.findUnique({ where: { messageId } })) throw new RuntimeConflictError("Message was already processed.");
      return (await tx.runtimeExecution.create({ data: { conversationId, messageId, status: "running" } })).id;
    });
  }

  async complete(id: string, content: string, status: RuntimeResult["status"], toolResult: RuntimeResult["toolResult"]): Promise<Message> {
    return this.client.$transaction(async (tx) => {
      const execution = await tx.runtimeExecution.findUniqueOrThrow({ where: { id } });
      const claimed = await tx.runtimeExecution.updateMany({ where: { id, status: "running" }, data: {
        status: "completed", finishedAt: new Date(), toolResult: toolResult === null ? null : JSON.stringify(toolResult),
      } });
      if (!claimed.count) throw new RuntimeConflictError("Execution is no longer active.");
      const updated = await tx.conversation.updateMany({ where: { id: execution.conversationId, status: "processing" }, data: { status } });
      if (!updated.count) throw new RuntimeConflictError("Conversation state changed.");
      const reply = await tx.message.create({ data: { conversationId: execution.conversationId, role: "agent", content } });
      return { ...reply, role: "agent" };
    });
  }

  async fail(id: string): Promise<void> {
    await this.client.$transaction(async (tx) => {
      const execution = await tx.runtimeExecution.findUniqueOrThrow({ where: { id } });
      const changed = await tx.runtimeExecution.updateMany({ where: { id, status: "running" }, data: { status: "failed", errorCode: "EXECUTION_FAILED", finishedAt: new Date() } });
      if (changed.count) await tx.conversation.updateMany({ where: { id: execution.conversationId, status: "processing" }, data: { status: "human_handoff" } });
    });
  }

  async recoverExpired(before: Date): Promise<number> {
    return this.client.$transaction(async (tx) => {
      const expired = await tx.runtimeExecution.findMany({ where: { status: "running", createdAt: { lt: before } } });
      for (const execution of expired) {
        await tx.runtimeExecution.update({ where: { id: execution.id }, data: { status: "failed", errorCode: "EXECUTION_EXPIRED", finishedAt: new Date() } });
        await tx.conversation.updateMany({ where: { id: execution.conversationId, status: "processing" }, data: { status: "human_handoff" } });
      }
      return expired.length;
    });
  }
}
