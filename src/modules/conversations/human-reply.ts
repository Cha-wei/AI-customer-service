import type { PrismaClient } from "@prisma/client";
import { ConversationValidationError } from "./errors";
import { AdminTransitionConflict } from "./admin-transition";

export async function replyFromHuman(client: PrismaClient, id: string, content: unknown, lastMessageId: unknown) {
  if (typeof content !== "string" || !content.trim() || content.length > 10000 || typeof lastMessageId !== "string" || !lastMessageId || lastMessageId.length > 128) throw new ConversationValidationError("Invalid reply.");
  return client.$transaction(async tx => {
    const changed = await tx.conversation.updateMany({
      where: { id, status: "human_handoff", executions: { none: { status: "running" } } },
      data: { updatedAt: new Date() },
    });
    if (!changed.count) throw new AdminTransitionConflict();
    const latest = await tx.message.findFirst({ where: { conversationId: id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
    // A repeated request or another participant's newer message requires review before replying.
    if (latest?.id !== lastMessageId) throw new AdminTransitionConflict();
    return tx.message.create({ data: { conversationId: id, role: "human", content: content.trim() } });
  });
}
