import { NextResponse } from "next/server";

import { getConversationService } from "@/modules/conversations/composition-root";
import { authenticate, assertConversation } from "@/modules/internal-auth";

import { conversationErrorResponse } from "../http";

interface RouteContext {
  params: Promise<{ conversationId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const principal = authenticate(_request);
    const { conversationId } = await context.params;
    await assertConversation(principal, conversationId);
    const conversation = await getConversationService().get(conversationId);

    return NextResponse.json({ data: conversation }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = conversationErrorResponse(error);
    if (response) {
      return response;
    }

    throw error;
  }
}
