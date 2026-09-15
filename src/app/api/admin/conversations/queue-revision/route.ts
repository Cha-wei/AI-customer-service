import { NextResponse } from "next/server";
import { requireAdminSession } from "@/modules/admin-auth";
import { readQueuePage, queueRevision } from "@/components/workspace/queue-data";

export async function GET(request: Request) {
  await requireAdminSession();
  const headers = { "Cache-Control": "no-store" };
  try {
    const params = new URL(request.url).searchParams;
    const page = await readQueuePage({ query: params.get("query") ?? undefined, status: params.get("status") ?? undefined, page: params.get("page") ?? undefined });
    return NextResponse.json({ revision: queueRevision(page, Date.now()) }, { headers });
  } catch {
    return NextResponse.json({ error: "暂时无法同步队列" }, { status: 503, headers });
  }
}
