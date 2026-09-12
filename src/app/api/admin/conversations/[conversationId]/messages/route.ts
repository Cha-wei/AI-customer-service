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
    return NextResponse.json({ data: page.messages, nextCursor: page.nextCursor }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = conversationErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
