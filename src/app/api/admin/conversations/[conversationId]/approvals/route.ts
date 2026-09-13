import { NextResponse } from "next/server";
import { requireAdminSession } from "@/modules/admin-auth";
import { isSameOrigin } from "@/modules/admin-auth/origin";
import { getApprovalService } from "@/modules/approvals/composition-root";
import { RuntimeConflictError } from "@/modules/agent-runtime";

export async function POST(request: Request, context: { params: Promise<{ conversationId: string }> }) {
  await requireAdminSession();
  if (!isSameOrigin(request)) return new NextResponse("请求来源无效", { status: 403 });
  const { conversationId } = await context.params;
  const destination = new URL(`/conversations/${encodeURIComponent(conversationId)}`, request.headers.get("origin")!);
  try {
    const form = await request.formData();
    await getApprovalService().decide(conversationId, String(form.get("approvalId")), String(form.get("decision")));
  } catch (error) {
    destination.searchParams.set("notice", error instanceof RuntimeConflictError ? "conflict" : "error");
  }
  const response = NextResponse.redirect(destination, 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
