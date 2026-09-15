import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ConversationNotFoundError } from "@/modules/conversations";
import type { ExecutionRecord } from "@/modules/agent-runtime/execution-reader";

// One consistent read catches tool completion even when conversation.updatedAt is unchanged.
export async function readWorkspaceSnapshot(conversationId: string) {
  const row = await prisma.conversation.findUnique({ where: { id: conversationId }, select: {
    customerId: true, status: true, updatedAt: true,
    executions: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1 },
    approvals: { orderBy: { id: "asc" }, select: { id: true, status: true, decidedAt: true, result: true } },
    messages: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: { id: true } },
  } });
  if (!row) throw new ConversationNotFoundError(conversationId);
  // Keep consultation navigation fresh even when this customer is outside the queue's filters/page.
  const consultations = await prisma.conversation.groupBy({ by: ["status"], where: { customerId: row.customerId },
    _count: { _all: true }, _max: { updatedAt: true }, orderBy: { status: "asc" } });
  const execution = row.executions[0];
  let latestExecution: ExecutionRecord | null = null;
  if (execution) {
    if (!["running", "completed", "failed"].includes(execution.status)) throw new Error("Invalid execution status");
    latestExecution = { ...execution, status: execution.status as ExecutionRecord["status"], toolResult: execution.toolResult === null ? null : JSON.parse(execution.toolResult) };
  }
  return { revision: createHash("sha256").update(JSON.stringify([row, consultations])).digest("hex"), latestExecution };
}
