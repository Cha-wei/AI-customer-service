import type { PrismaClient } from "@prisma/client";
import { ConversationNotFoundError, ConversationValidationError } from "../conversations";
import type { ExecutionPage, ExecutionReader, ExecutionRecord } from "./execution-reader";

const PAGE_SIZE = 50;

export class PrismaExecutionReader implements ExecutionReader {
  constructor(private readonly client: PrismaClient) {}

  async list(conversationId: string, offset = 0): Promise<ExecutionPage> {
    if (!conversationId.trim() || conversationId.length > 128 || !Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000) {
      throw new ConversationValidationError("Invalid conversationId or offset.");
    }
    return this.client.$transaction(async (tx) => {
      const conversation = await tx.conversation.findUnique({ where: { id: conversationId }, select: { id: true } });
      if (!conversation) throw new ConversationNotFoundError(conversationId);
      const rows = await tx.runtimeExecution.findMany({
        where: { conversationId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip: offset, take: PAGE_SIZE + 1,
      });
      const executions: ExecutionRecord[] = rows.slice(0, PAGE_SIZE).map((row) => {
        if (row.status !== "running" && row.status !== "completed" && row.status !== "failed") {
          throw new Error("Invalid persisted execution status.");
        }
        return { ...row, status: row.status, toolResult: row.toolResult === null ? null : JSON.parse(row.toolResult) as unknown };
      });
      return { executions, nextOffset: rows.length > PAGE_SIZE ? offset + PAGE_SIZE : null };
    });
  }
}
