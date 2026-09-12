import { NextResponse } from "next/server";

import { getConversationService } from "@/modules/conversations/composition-root";

import { conversationErrorResponse } from "../http";

interface RouteContext {
  params: Promise<{ conversationId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { conversationId } = await context.params;
    const conversation = await getConversationService().get(conversationId);

    return NextResponse.json({ data: conversation });
  } catch (error) {
    const response = conversationErrorResponse(error);
    if (response) {
      return response;
    }

    throw error;
  }
}
