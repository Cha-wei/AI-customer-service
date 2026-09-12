import { NextResponse } from "next/server";

import { getConversationService } from "@/modules/conversations/composition-root";
import type { MessageRole } from "@/modules/conversations";
import { authenticate, assertConversation, AccessError } from "@/modules/internal-auth";

import { conversationErrorResponse, readJsonObject } from "../../http";

interface RouteContext {
  params: Promise<{ conversationId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const principal = authenticate(request);
    const [{ conversationId }, body] = await Promise.all([
      context.params,
      readJsonObject(request),
    ]);
    await assertConversation(principal, conversationId);
    if (principal.role === "customer" && body.role !== "customer") throw new AccessError(403, "forbidden");
    const message = await getConversationService().appendMessage({
      conversationId,
      role: body.role as MessageRole,
      content: body.content as string,
    });

    return NextResponse.json({ data: message }, { status: 201 });
  } catch (error) {
    const response = conversationErrorResponse(error);
    if (response) {
      return response;
    }

    throw error;
  }
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const principal = authenticate(request);
    const { conversationId } = await context.params;
    const before = new URL(request.url).searchParams.get("before") ?? undefined;
    const page = await getConversationService().listMessages({
      conversationId,
      ...(principal.role === "customer" ? { customerId: principal.customerId } : {}),
      before,
    });
    return NextResponse.json({ data: page.messages, nextCursor: page.nextCursor }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = conversationErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
