import { NextResponse } from "next/server";

export const HEALTH_RESPONSE = {
  status: "ok",
  service: "ai-customer-service-workbench",
} as const;

export async function GET() {
  return NextResponse.json(HEALTH_RESPONSE);
}
