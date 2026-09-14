import { NextResponse } from "next/server";
import { requireAdminSession } from "@/modules/admin-auth";
import { readWorkspaceSnapshot } from "@/components/workspace/workspace-snapshot";
import { ConversationNotFoundError } from "@/modules/conversations";

export async function GET(_request: Request, context: { params: Promise<{ conversationId: string }> }) {
  await requireAdminSession();
  const headers = { "Cache-Control": "no-store" };
  try {
    const { conversationId } = await context.params;
    const { revision } = await readWorkspaceSnapshot(conversationId);
    return NextResponse.json({ revision }, { headers });
  } catch (error) {
    return NextResponse.json({ error: "暂时无法同步会话" }, { status: error instanceof ConversationNotFoundError ? 404 : 503, headers });
  }
}
