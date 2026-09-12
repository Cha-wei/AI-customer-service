import { NextResponse } from "next/server";

import {
  ADMIN_SESSION_COOKIE,
  AdminAuthConfigurationError,
  adminSessionCookieOptions,
  createAdminSession,
  verifyAdminPassword,
} from "@/modules/admin-auth";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const password = form.get("password");
    if (typeof password !== "string" || !verifyAdminPassword(password)) {
      return NextResponse.redirect(new URL("/login?error=invalid", request.url), 303);
    }

    const session = createAdminSession();
    const response = NextResponse.redirect(new URL("/", request.url), 303);
    response.cookies.set(ADMIN_SESSION_COOKIE, session.value, {
      ...adminSessionCookieOptions,
      expires: session.expires,
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    if (error instanceof AdminAuthConfigurationError) {
      return NextResponse.redirect(new URL("/login?error=unconfigured", request.url), 303);
    }
    throw error;
  }
}

export async function DELETE(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    ...adminSessionCookieOptions,
    expires: new Date(0),
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
