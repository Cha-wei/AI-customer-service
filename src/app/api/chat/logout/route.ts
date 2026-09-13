import { NextResponse } from "next/server";
import { CUSTOMER_COOKIE, revokeCustomerSession } from "@/modules/web-chat/session";
import { isSameOrigin } from "@/modules/admin-auth/origin";

export async function POST(request: Request) {
  const json = (error: string, status: number) => NextResponse.json({ error: { message: error } }, { status, headers: { "Cache-Control": "no-store" } });
  if (!isSameOrigin(request)) return json("请求来源无效。", 403);
  try {
    await revokeCustomerSession();
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(CUSTOMER_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
    return response;
  } catch { return json("退出失败，请重试。", 503); }
}
