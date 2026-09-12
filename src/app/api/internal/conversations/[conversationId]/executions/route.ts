import { NextResponse } from "next/server";
import { authenticate, assertConversation } from "@/modules/internal-auth";
import { prisma } from "@/lib/prisma";
import { ConversationValidationError } from "@/modules/conversations";
import { PrismaExecutionReader } from "@/modules/agent-runtime/prisma-execution-reader";
import { conversationErrorResponse } from "../../http";

export async function GET(request: Request, context: { params: Promise<{ conversationId: string }> }) {
  try {
    const principal = authenticate(request);
    const rawOffset = new URL(request.url).searchParams.get("offset") ?? "0";
    if (!/^\d+$/.test(rawOffset)) throw new ConversationValidationError("offset must be a non-negative integer.");
    const { conversationId } = await context.params;
    await assertConversation(principal, conversationId);
    const page = await new PrismaExecutionReader(prisma).list(conversationId, Number(rawOffset));
    return NextResponse.json(page, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return conversationErrorResponse(error) ?? NextResponse.json(
      { error: { code: "execution_query_failed", message: "Unable to read execution records." } }, { status: 500 },
    );
  }
}
