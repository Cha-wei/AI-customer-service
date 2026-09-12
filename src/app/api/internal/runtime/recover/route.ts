import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PrismaExecutionStore } from "@/modules/agent-runtime/prisma-execution-store";

// Explicit maintenance endpoint; no background scheduler in this MVP.
export async function POST() {
  try {
    const recovered = await new PrismaExecutionStore(prisma).recoverExpired(new Date(Date.now() - 15 * 60 * 1000));
    return NextResponse.json({ recovered });
  } catch {
    return NextResponse.json({ error: { code: "recovery_failed", message: "Unable to recover executions." } }, { status: 500 });
  }
}
