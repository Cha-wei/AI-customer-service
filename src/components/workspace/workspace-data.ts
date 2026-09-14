import { prisma } from "@/lib/prisma";
import type { ExecutionRecord } from "@/modules/agent-runtime/execution-reader";

// Bound this UI read to the visible message page. Diagnostic pagination must not
// hide recent activity in a conversation with more than 50 older executions.
export async function readMessageActivity(conversationId: string, messageIds: string[]): Promise<ExecutionRecord[]> {
  if (!messageIds.length) return [];
  const rows = await prisma.runtimeExecution.findMany({
    where: { conversationId, messageId: { in: messageIds.slice(0, 50) } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 50,
  });
  return rows.flatMap(row => {
    if (row.status !== "running" && row.status !== "completed" && row.status !== "failed") return [];
    let toolResult: unknown = null;
    try { toolResult = row.toolResult === null ? null : JSON.parse(row.toolResult); } catch { /* A malformed diagnostic result must not break the message UI. */ }
    return [{ ...row, status: row.status, toolResult }];
  });
}
