import { NextResponse } from "next/server";
import { isSameOrigin } from "@/modules/admin-auth/origin";
import { authenticateCustomer } from "@/modules/customer-auth/service";
import { customerLoginLimit } from "@/modules/customer-auth/login-limit";
import { CUSTOMER_COOKIE, createCustomerSession, revokeCustomerSession } from "@/modules/web-chat/session";

export async function POST(request: Request) {
  const failure = (message: string, status: number, retry?: number) => NextResponse.json({ error: message }, {
    status, headers: { "Cache-Control": "no-store", ...(retry ? { "Retry-After": String(retry) } : {}) },
  });
  if (!isSameOrigin(request)) return failure("请求来源无效。", 403);
  try {
    // Bound the body before parsing, including chunked requests without Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return failure("账号或密码不正确。", 401);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 4096) { await reader.cancel(); return failure("登录请求过大。", 413); }
      chunks.push(value);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString());
    if (!body || typeof body.loginName !== "string" || typeof body.password !== "string" || body.password.length > 128 || body.loginName.length > 64) return failure("账号或密码不正确。", 401);
    const name = body.loginName.trim().toLowerCase();
    const retry = customerLoginLimit.reserve(name);
    if (retry) return failure("登录尝试过多，请稍后重试。", 429, retry);
    const account = await authenticateCustomer(name, body.password);
    if (!account) return failure("账号或密码不正确。", 401);
    const value = createCustomerSession(account.customerId, Date.now(), { id: account.id, version: account.version });
    await revokeCustomerSession();
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(CUSTOMER_COOKIE, value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 8 * 3600 });
    customerLoginLimit.success(name);
    return response;
  } catch (error) {
    if (error instanceof SyntaxError) return failure("账号或密码不正确。", 401);
    return failure("登录服务暂不可用，请稍后重试。", 503);
  }
}
