import type { PrismaClient } from "@prisma/client";

export class AdminTransitionConflict extends Error {}

// Compare-and-set shares the same status lock as Runtime.begin; active runs cannot be interrupted.
export async function transitionFromAdmin(client: PrismaClient, id: string, target: string) {
  if (target !== "human_handoff" && target !== "resolved") throw new AdminTransitionConflict();
  const allowed = target === "human_handoff" ? ["open"] : ["open", "human_handoff"];
  await client.$transaction(async (tx) => {
    const changed = await tx.conversation.updateMany({
      where: { id, status: { in: allowed }, executions: { none: { status: "running" } } },
      data: { status: target, ...(target === "human_handoff" ? { humanHandoffAt: new Date() } : {}) },
    });
    if (!changed.count) throw new AdminTransitionConflict();
    await tx.message.create({ data: {
      conversationId: id, role: "system",
      content: target === "resolved" ? "管理员已将会话标记为已解决。" : "管理员已将会话转为人工接管。",
    } });
  });
}
