import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const ADMIN_SESSION_COOKIE = "admin_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

export class AdminAuthConfigurationError extends Error {}

export function verifyAdminPassword(candidate: string): boolean {
  const password = readSecret("ADMIN_UI_PASSWORD", 12);
  return safeEqual(candidate, password);
}

export function createAdminSession(now = new Date()): {
  value: string;
  expires: Date;
} {
  const expires = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
  const expiresAt = Math.floor(expires.getTime() / 1000).toString();
  return { value: `${expiresAt}.${sign(expiresAt)}`, expires };
}

export function verifyAdminSession(value: string | undefined, now = new Date()): boolean {
  if (!value) return false;
  const [expiresAt, signature, extra] = value.split(".");
  if (extra !== undefined || !/^\d+$/.test(expiresAt ?? "") || !signature) return false;
  if (Number(expiresAt) <= Math.floor(now.getTime() / 1000)) return false;
  return safeEqual(signature, sign(expiresAt));
}

export async function requireAdminSession(): Promise<void> {
  const value = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!verifyAdminSession(value)) redirect("/login");
}

export const adminSessionCookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

function sign(value: string): string {
  return createHmac("sha256", readSecret("ADMIN_UI_SESSION_SECRET", 32))
    .update(value)
    .digest("base64url");
}

function readSecret(name: string, minimumLength: number): string {
  const value = process.env[name];
  if (!value || value.length < minimumLength) {
    throw new AdminAuthConfigurationError(`${name} is not configured.`);
  }
  return value;
}

function safeEqual(left: string, right: string): boolean {
  const leftHash = createHmac("sha256", "admin-auth-compare").update(left).digest();
  const rightHash = createHmac("sha256", "admin-auth-compare").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}
