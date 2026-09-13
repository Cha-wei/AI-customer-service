import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { AccessError } from "../internal-auth";

export const CUSTOMER_COOKIE = "customer_session";
function sign(value: string) {
  const secret = process.env.WEB_CHAT_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new AccessError(503, "auth_unconfigured");
  return createHmac("sha256", secret).update(value).digest("base64url");
}
// Called only after local password verification or privileged host authentication.
export function createCustomerSession(customerId: string, now = Date.now(), account?: { id: string; version: number }) {
  if (!customerId.trim() || customerId !== customerId.trim() || customerId.length > 128) throw new AccessError(401, "unauthorized");
  const payload = Buffer.from(JSON.stringify({ customerId, account, nonce: randomUUID(), expires: now + 8 * 3600_000 })).toString("base64url");
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
  const value = (await cookies()).get(CUSTOMER_COOKIE)?.value;
  const identity = verifyCustomerSession(value);
  if (await prisma.revokedCustomerSession.findUnique({ where: { digest: sessionDigest(value!) } })) throw new AccessError(401, "unauthorized");
  const { account } = JSON.parse(Buffer.from(value!.split(".")[0], "base64url").toString());
  const stored = await prisma.customerAccount.findUnique({ where: { customerId: identity } });
  if (stored && !stored.enabled) throw new AccessError(401, "unauthorized");
  if (account && (!stored || account.id !== stored.id || account.version !== stored.sessionVersion)) throw new AccessError(401, "unauthorized");
  return identity;
}

function sessionDigest(value: string) { return createHash("sha256").update(value).digest("hex"); }
export async function revokeCustomerSession() {
  const value = (await cookies()).get(CUSTOMER_COOKIE)?.value;
  if (!value) return;
  try { verifyCustomerSession(value); } catch (error) {
    if (error instanceof AccessError && error.status === 401) return;
    throw error;
  }
  const { expires } = JSON.parse(Buffer.from(value.split(".")[0], "base64url").toString());
  await prisma.revokedCustomerSession.upsert({ where: { digest: sessionDigest(value) }, create: { digest: sessionDigest(value), expiresAt: new Date(expires) }, update: {} });
}
