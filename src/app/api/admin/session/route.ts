import { NextResponse } from "next/server";
import { loginLimit } from "@/modules/admin-auth/login-limit";
import { isSameOrigin } from "@/modules/admin-auth/origin";

import {
  ADMIN_SESSION_COOKIE,
  AdminAuthConfigurationError,
  adminSessionCookieOptions,
  createAdminSession,
  verifyAdminPassword,
} from "@/modules/admin-auth";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new NextResponse("请求来源无效", { status: 403 });
  const retryAfter = loginLimit.reserve();
  if (retryAfter) return new NextResponse("登录尝试过多，请稍后重试。", {
    status: 429, headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" },
  });
  try {
    const form = await request.formData();
    const password = form.get("password");
    if (typeof password !== "string" || !verifyAdminPassword(password)) {
      return NextResponse.redirect(new URL("/login?error=invalid", request.headers.get("origin")!), 303);
    }

    const session = createAdminSession();
    loginLimit.reset();
    const response = NextResponse.redirect(new URL("/", request.headers.get("origin")!), 303);
    response.cookies.set(ADMIN_SESSION_COOKIE, session.value, {
      ...adminSessionCookieOptions,
      expires: session.expires,
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    if (error instanceof AdminAuthConfigurationError) {
      return NextResponse.redirect(new URL("/login?error=unconfigured", request.headers.get("origin")!), 303);
    }
    return new NextResponse("无法处理登录请求", { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return new NextResponse("请求来源无效", { status: 403 });
  const response = NextResponse.redirect(new URL("/login", request.headers.get("origin")!), 303);
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    ...adminSessionCookieOptions,
    expires: new Date(0),
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
