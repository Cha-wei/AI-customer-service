import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { AccessError } from "../internal-auth";

export const CUSTOMER_COOKIE = "customer_session";
function sign(value: string) {
  const secret = process.env.WEB_CHAT_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new AccessError(503, "auth_unconfigured");
  return createHmac("sha256", secret).update(value).digest("base64url");
}
// Called only after the host application's server has authenticated the customer.
export function createCustomerSession(customerId: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ customerId, expires: now + 8 * 3600_000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
export function verifyCustomerSession(value: string | undefined, now = Date.now()): string {
  if (!value) throw new AccessError(401, "unauthorized");
  const [payload, signature, extra] = value.split(".");
  const expected = sign(payload);
  if (extra !== undefined || !signature || !/^[A-Za-z0-9_-]{43}$/.test(signature) || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new AccessError(401, "unauthorized");
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.customerId !== "string" || !data.customerId.trim() || data.customerId.length > 128 || !Number.isFinite(data.expires) || data.expires <= now) throw new Error();
    return data.customerId;
  } catch { throw new AccessError(401, "unauthorized"); }
}
export async function customerIdentity() {
  return verifyCustomerSession((await cookies()).get(CUSTOMER_COOKIE)?.value);
}
