import { prisma } from "@/lib/prisma";
import { getConversationService } from "../conversations/composition-root";
import { getAgentRuntime } from "../agent-runtime/composition-root";
import { RuntimeConflictError } from "../agent-runtime/runtime";
import { ConversationNotFoundError, ConversationValidationError } from "../conversations";
import { getCustomerContextProvider } from "../customer-context/composition-root";

export async function ownedConversation(customerId: string, id: string) {
  const header = await getConversationService().getHeader(id);
  if (header.customerId !== customerId) throw new ConversationNotFoundError(id);
  return header;
}

export async function sendCustomerMessage(customerId: string, input: Record<string, unknown>) {
  if (Object.keys(input).some(key => !["conversationId", "content", "orderId"].includes(key))) throw new ConversationValidationError("Invalid fields.");
  if (typeof input.content !== "string" || !input.content.trim() || input.content.length > 10000) throw new ConversationValidationError("Invalid message.");
  if (input.conversationId !== undefined && (typeof input.conversationId !== "string" || !input.conversationId)) throw new ConversationValidationError("Invalid conversation.");
  let content = input.content.trim();
  if (/退款|refund/i.test(content) && !/人工|human/i.test(content)) {
    if (typeof input.orderId !== "string") throw new ConversationValidationError("请选择退款订单。");
    const orders = await getCustomerContextProvider().listOrders(customerId);
    if (!orders.some(o => o.customerId === customerId && o.id === input.orderId && o.status !== "cancelled")) throw new ConversationValidationError("请选择有效的退款订单。");
    // The explicit selection is authoritative; free text cannot select another order.
    content = `申请退款 ${input.orderId}`;
  }
  let id: string;
  if (typeof input.conversationId === "string") {
    id = input.conversationId;
    await ownedConversation(customerId, id);
    // Serialize append against concurrent sends and runtime/approval state changes.
    await prisma.$transaction(async tx => {
      if (!(await tx.conversation.updateMany({ where: { id, customerId, status: "open" }, data: { updatedAt: new Date() } })).count) throw new RuntimeConflictError("会话当前不能发送消息。");
      const latest = await tx.message.findFirst({ where: { conversationId: id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
      if (latest?.role === "customer") throw new RuntimeConflictError("上一条消息仍待处理，请刷新会话。");
      await tx.message.create({ data: { conversationId: id, role: "customer", content } });
    });
  } else {
    id = (await getConversationService().create({ customerId, initialMessage: content })).id;
  }
  try { await getAgentRuntime().run(id); }
  catch { return { id, warning: "消息已保存，处理暂未完成。请刷新查看结果，不要重复提交。" }; }
  return { id };
}
