import { NextResponse } from "next/server";
import { getAgentRuntime } from "@/modules/agent-runtime/composition-root";
import { RuntimeConflictError } from "@/modules/agent-runtime";
import { authenticate, assertConversation } from "@/modules/internal-auth";
import { conversationErrorResponse } from "../../http";

export async function POST(
  _request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    const principal = authenticate(_request);
    const { conversationId } = await context.params;
    await assertConversation(principal, conversationId);
    return NextResponse.json(await getAgentRuntime().run(conversationId));
  } catch (error) {
    if (error instanceof RuntimeConflictError) {
      return NextResponse.json({ error: { code: "runtime_conflict", message: error.message } }, { status: 409 });
    }
    return conversationErrorResponse(error)
      ?? NextResponse.json({ error: { code: "runtime_error", message: "Unable to process conversation." } }, { status: 500 });
  }
}
