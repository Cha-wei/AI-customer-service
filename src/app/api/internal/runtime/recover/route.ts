import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PrismaExecutionStore } from "@/modules/agent-runtime/prisma-execution-store";
import { authenticate, AccessError, accessErrorResponse } from "@/modules/internal-auth";

// Explicit maintenance endpoint; no background scheduler in this MVP.
export async function POST(request: Request) {
  try {
    if (authenticate(request).role !== "operator") throw new AccessError(403, "forbidden");
    const recovered = await new PrismaExecutionStore(prisma).recoverExpired(new Date(Date.now() - 15 * 60 * 1000));
    return NextResponse.json({ recovered });
  } catch (error) {
    return accessErrorResponse(error) ?? NextResponse.json({ error: { code: "recovery_failed", message: "Unable to recover executions." } }, { status: 500 });
  }
}
