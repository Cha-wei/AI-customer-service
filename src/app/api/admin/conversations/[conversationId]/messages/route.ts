import { isSameOrigin } from "@/modules/admin-auth/origin";
import { prisma } from "@/lib/prisma";
import { replyFromHuman } from "@/modules/conversations/human-reply";
import { AdminTransitionConflict } from "@/modules/conversations/admin-transition";
import { ConversationValidationError } from "@/modules/conversations";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/modules/admin-auth";
import { conversationErrorResponse } from "@/app/api/internal/conversations/http";
import { getConversationService } from "@/modules/conversations/composition-root";

export async function GET(request: Request, context: { params: Promise<{ conversationId: string }> }) {
  await requireAdminSession();
  try {
    const { conversationId } = await context.params;
    const before = new URL(request.url).searchParams.get("before") ?? undefined;
    const page = await getConversationService().listMessages({ conversationId, before });
    const header = await getConversationService().getHeader(conversationId);
    return NextResponse.json({ data: page.messages, nextCursor: page.nextCursor, status: header.status }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = conversationErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function POST(request: Request, context: { params: Promise<{ conversationId: string }> }) {
  await requireAdminSession();
  const json = (data: unknown, status: number) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
  if (!isSameOrigin(request)) return json({ error: "请求来源无效。" }, 403);
  try {
    const { conversationId } = await context.params;
    const body = await request.json();
    const message = await replyFromHuman(prisma, conversationId, body?.content, body?.lastMessageId);
    return json({ message }, 201);
  } catch (error) {
    if (error instanceof AdminTransitionConflict) return json({ error: "会话或消息已更新，请核对记录后编辑草稿再发送，避免重复回复。" }, 409);
    if (error instanceof ConversationValidationError || error instanceof SyntaxError) return json({ error: "回复内容无效。" }, 400);
    return json({ error: "发送结果不确定，请先核对消息记录，避免重复回复。" }, 503);
  }
}
