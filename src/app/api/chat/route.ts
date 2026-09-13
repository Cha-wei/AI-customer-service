import { NextResponse } from "next/server";
import { customerIdentity } from "@/modules/web-chat/session";
import { ownedConversation, sendCustomerMessage } from "@/modules/web-chat/service";
import { getConversationService } from "@/modules/conversations/composition-root";
import { getCustomerContextProvider } from "@/modules/customer-context/composition-root";
import { conversationErrorResponse } from "../internal/conversations/http";
import { RuntimeConflictError } from "@/modules/agent-runtime/runtime";
import { isSameOrigin } from "@/modules/admin-auth/origin";

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
function failure(error: unknown) {
  if (error instanceof RuntimeConflictError) return json({ error: { message: error.message } }, 409);
  return conversationErrorResponse(error) ?? json({ error: { message: "服务暂不可用，请稍后重试。" } }, 503);
}
export async function GET(request: Request) {
  try {
    const customerId = await customerIdentity();
    const query = new URL(request.url).searchParams;
    const id = query.get("id");
    if (id) {
      const header = await ownedConversation(customerId, id);
      const history = await getConversationService().listMessages({ conversationId: id, customerId, before: query.get("before") ?? undefined });
      return json({ id, status: header.status, ...history });
    }
    const page = await getConversationService().list({ customerId, page: Number(query.get("page") ?? 1) });
    const orders = (await getCustomerContextProvider().listOrders(customerId)).filter(o => o.customerId === customerId && o.status !== "cancelled").map(o => ({ id: o.id, label: o.items.map(i => i.name).join("、") }));
    return json({ ...page, orders });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const customerId = await customerIdentity();
    if (!isSameOrigin(request)) return json({ error: { message: "请求来源无效。" } }, 403);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: { message: "消息格式无效。" } }, 400);
    return json(await sendCustomerMessage(customerId, body));
  } catch (error) { return failure(error); }
}
