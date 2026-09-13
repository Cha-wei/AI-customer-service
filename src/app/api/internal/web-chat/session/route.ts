import { NextResponse } from "next/server";
import { authenticate, AccessError, accessErrorResponse } from "@/modules/internal-auth";
import { createCustomerSession, CUSTOMER_COOKIE } from "@/modules/web-chat/session";
import { getCustomerContextProvider } from "@/modules/customer-context/composition-root";

export async function POST(request: Request) {
  try {
    const principal = authenticate(request);
    if (principal.role !== "operator") throw new AccessError(403, "forbidden");
    const body = await request.json().catch(() => null);
    if (!body || typeof body.customerId !== "string" || !await getCustomerContextProvider().getCustomer(body.customerId)) {
      return NextResponse.json({ error: "Invalid customer." }, { status: 400 });
    }
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(CUSTOMER_COOKIE, createCustomerSession(body.customerId), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 8 * 3600,
    });
    return response;
  } catch (error) {
    return accessErrorResponse(error) ?? NextResponse.json({ error: "Unable to create session." }, { status: 503 });
  }
}
