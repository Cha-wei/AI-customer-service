import { NextResponse } from "next/server";

import { getConversationService } from "@/modules/conversations/composition-root";
import type { MessageRole } from "@/modules/conversations";

import { conversationErrorResponse, readJsonObject } from "../../http";

interface RouteContext {
  params: Promise<{ conversationId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const [{ conversationId }, body] = await Promise.all([
      context.params,
      readJsonObject(request),
    ]);
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
