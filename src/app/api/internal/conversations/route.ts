import { NextResponse } from "next/server";

import { getConversationService } from "@/modules/conversations/composition-root";
import { authenticate, assertCustomer } from "@/modules/internal-auth";

import { conversationErrorResponse, readJsonObject } from "./http";

export async function GET(request: Request) {
  try {
    const principal = authenticate(request);
    const rawPage = new URL(request.url).searchParams.get("page") ?? "1";
    const page = /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
    const result = await getConversationService().list({
      ...(principal.role === "customer" ? { customerId: principal.customerId } : {}),
      page,
    });
    return NextResponse.json({ data: result.conversations, page: result.page, pageSize: result.pageSize, total: result.total }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = conversationErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const principal = authenticate(request);
    const body = await readJsonObject(request);
    assertCustomer(principal, typeof body.customerId === "string" ? body.customerId.trim() : "");
    const conversation = await getConversationService().create({
      customerId: body.customerId as string,
      initialMessage: body.initialMessage as string,
    });

    return NextResponse.json({ data: conversation }, { status: 201 });
  } catch (error) {
    const response = conversationErrorResponse(error);
    if (response) {
      return response;
    }

    throw error;
  }
}
