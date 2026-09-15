import type { Prisma, PrismaClient } from "@prisma/client";
import { isConversationStatus, isMessageRole, type ConversationSummary } from "@/modules/conversations/domain";
import type { ListConversationsQuery } from "@/modules/conversations/repository";

const include = {
  messages: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1 },
  _count: { select: { messages: { where: { role: "human" } } } },
} satisfies Prisma.ConversationInclude;
type Row = Prisma.ConversationGetPayload<{ include: typeof include }>;
function summary(row: Row): ConversationSummary {
  if (!isConversationStatus(row.status)) throw new Error("Invalid conversation status");
  const message = row.messages[0];
  if (message && !isMessageRole(message.role)) throw new Error("Invalid message role");
  return { id: row.id, customerId: row.customerId, status: row.status, createdAt: row.createdAt, updatedAt: row.updatedAt,
    humanHandoffAt: row.humanHandoffAt, hasHumanReply: row._count.messages > 0,
    latestMessage: message ? { ...message, role: message.role as NonNullable<ConversationSummary["latestMessage"]>["role"] } : null };
}

// Admin read projection only: customer pagination never changes stored consultations or customer APIs.
export async function readCustomerQueue(client: PrismaClient, input: ListConversationsQuery) {
  const where: Prisma.ConversationWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.query ? { OR: [{ customerId: { contains: input.query } }, { messages: { some: { content: { contains: input.query } } } }] } : {}),
  };
  return client.$transaction(async tx => {
    const total = (await tx.conversation.groupBy({ by: ["customerId"], where })).length;
    const page = Math.min(input.page, Math.max(1, Math.ceil(total / input.pageSize)));
    const customers = await tx.conversation.groupBy({ by: ["customerId"], where, _max: { updatedAt: true },
      orderBy: [{ _max: { updatedAt: "desc" } }, { customerId: "desc" }], skip: (page - 1) * input.pageSize, take: input.pageSize });
    const conversations = await Promise.all(customers.map(async ({ customerId }) => {
      const matched = { ...where, customerId };
      const counts = await tx.conversation.groupBy({ by: ["status"], where: { customerId }, _count: { _all: true } });
      const matchingStatuses = input.query || input.status ? await tx.conversation.groupBy({ by: ["status"], where: matched }) : counts;
      const status = ["waiting_approval", "human_handoff", "processing", "open", "resolved"].find(s => matchingStatuses.some(c => c.status === s))!;
      const firstHuman = status === "human_handoff" ? await tx.conversation.findFirst({ where: { ...matched, status, messages: { none: { role: "human" } } }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], include }) : null;
      const target = firstHuman ?? await tx.conversation.findFirstOrThrow({ where: { ...matched, status }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], include });
      const latest = await tx.conversation.findFirstOrThrow({ where: { customerId }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], include });
      const pendingApprovals = await tx.approval.count({ where: { customerId, status: "pending", conversation: { customerId } } });
      return { ...summary(target), latest: summary(latest), pendingApprovals,
        humanCount: counts.find(c => c.status === "human_handoff")?._count._all ?? 0,
        activeCount: counts.filter(c => c.status !== "resolved").reduce((sum, c) => sum + c._count._all, 0),
        consultationCount: counts.reduce((sum, c) => sum + c._count._all, 0) };
    }));
    return { conversations, total, page, pageSize: input.pageSize };
  });
}

export async function readCustomerConsultations(client: PrismaClient, customerId: string, history: boolean, requestedPage: number) {
  const where = { customerId, status: history ? "resolved" : { not: "resolved" } };
  return client.$transaction(async tx => {
    const total = await tx.conversation.count({ where });
    const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / 10)));
    const rows = await tx.conversation.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 10, skip: (page - 1) * 10, include });
    return { conversations: rows.map(summary), total, page, pageSize: 10 };
  });
}
