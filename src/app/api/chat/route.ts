import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { customerIdentity } from "@/modules/web-chat/session";
import { ownedConversation, sendCustomerMessage } from "@/modules/web-chat/service";
import { getConversationService } from "@/modules/conversations/composition-root";
import { getCustomerContextProvider } from "@/modules/customer-context/composition-root";
import { conversationErrorResponse } from "../internal/conversations/http";
import { RuntimeConflictError } from "@/modules/agent-runtime/runtime";
import { isSameOrigin } from "@/modules/admin-auth/origin";

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
const accountKey = (id: string) => createHash("sha256").update(id).digest("hex");
function customerJson(data: unknown, customerId: string) {
  const response = json(data);
  response.headers.set("X-Chat-Account", accountKey(customerId));
  return response;
}
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
      return customerJson({ id, status: header.status, ...history }, customerId);
    }
    const page = await getConversationService().list({ customerId, page: Number(query.get("page") ?? 1) });
    const orders = (await getCustomerContextProvider().listOrders(customerId)).filter(o => o.customerId === customerId && o.status !== "cancelled").map(o => ({ id: o.id, label: o.items.map(i => i.name).join("、") }));
    return customerJson({ ...page, orders }, customerId);
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const customerId = await customerIdentity();
    if (!isSameOrigin(request)) return json({ error: { message: "请求来源无效。" } }, 403);
    // Bind drafts to the account that loaded the page, including new conversations.
    if (request.headers.get("x-chat-account") !== accountKey(customerId)) return json({ error: { message: "客户账号已变更，请重新加载。" } }, 401);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: { message: "消息格式无效。" } }, 400);
    return customerJson(await sendCustomerMessage(customerId, body), customerId);
  } catch (error) { return failure(error); }
}
