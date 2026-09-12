import { NextResponse } from "next/server";
import { requireAdminSession } from "@/modules/admin-auth";
import { isSameOrigin } from "@/modules/admin-auth/origin";
import { prisma } from "@/lib/prisma";
import { AdminTransitionConflict, transitionFromAdmin } from "@/modules/conversations/admin-transition";

export async function POST(request: Request, context: { params: Promise<{ conversationId: string }> }) {
  await requireAdminSession();
  if (!isSameOrigin(request)) return new NextResponse("请求来源无效", { status: 403 });
  const { conversationId } = await context.params;
  const destination = new URL(`/conversations/${encodeURIComponent(conversationId)}`, request.headers.get("origin")!);
  try {
    const form = await request.formData();
    await transitionFromAdmin(prisma, conversationId, String(form.get("status")));
  } catch (error) {
    destination.searchParams.set("notice", error instanceof AdminTransitionConflict ? "conflict" : "error");
  }
  const response = NextResponse.redirect(destination, 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
