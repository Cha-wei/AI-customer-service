import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getConversationService } from "../conversations/composition-root";
import { ConversationNotFoundError } from "../conversations";

export type Principal = { role: "operator" } | { role: "customer"; customerId: string };
type Credential = Principal & { token: string };

export class AccessError extends Error {
  constructor(readonly status: 401 | 403 | 503, readonly code: string) {
    super(code === "auth_unconfigured" ? "Internal API authentication is not configured." : "Access denied.");
  }
}

export function authenticate(request: Request): Principal {
  let credentials: Credential[];
  try {
    const parsed: unknown = JSON.parse(process.env.INTERNAL_API_TOKENS ?? "");
    if (!Array.isArray(parsed) || !parsed.length) throw new Error();
    const seen = new Set<string>();
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object" || typeof entry.token !== "string" || entry.token.length < 32 || /\s/.test(entry.token) || seen.has(entry.token)) throw new Error();
      if (entry.role !== "operator" && (entry.role !== "customer" || typeof entry.customerId !== "string" || !entry.customerId.trim() || entry.customerId !== entry.customerId.trim() || entry.customerId.length > 128)) throw new Error();
      seen.add(entry.token);
    }
    credentials = parsed;
  } catch { throw new AccessError(503, "auth_unconfigured"); }
  const match = /^Bearer ([^\s]+)$/i.exec(request.headers.get("authorization") ?? "");
  if (!match) throw new AccessError(401, "unauthorized");
  const digest = (text: string) => createHash("sha256").update(text).digest();
  const tokenHash = digest(match[1]);
  const credential = credentials.find((entry) => timingSafeEqual(digest(entry.token), tokenHash));
  if (!credential) throw new AccessError(401, "unauthorized");
  return credential.role === "operator" ? { role: "operator" } : { role: "customer", customerId: credential.customerId };
}

export function assertCustomer(principal: Principal, customerId: string): void {
  if (principal.role === "customer" && principal.customerId !== customerId) throw new AccessError(403, "forbidden");
}

export async function assertConversation(principal: Principal, conversationId: string): Promise<void> {
  if (principal.role === "operator") return;
  const conversation = await getConversationService().get(conversationId);
  // Same response as a missing ID so customer credentials cannot enumerate others' sessions.
  if (conversation.customerId !== principal.customerId) throw new ConversationNotFoundError(conversationId);
}

export function accessErrorResponse(error: unknown): NextResponse | undefined {
  if (!(error instanceof AccessError)) return undefined;
  return NextResponse.json({ error: { code: error.code, message: error.message } }, {
    status: error.status,
    headers: { "Cache-Control": "no-store", ...(error.status === 401 ? { "WWW-Authenticate": "Bearer" } : {}) },
  });
}
