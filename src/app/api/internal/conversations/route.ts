import { NextResponse } from "next/server";

import { getConversationService } from "@/modules/conversations/composition-root";
import { authenticate, assertCustomer } from "@/modules/internal-auth";

import { conversationErrorResponse, readJsonObject } from "./http";

export async function GET(request: Request) {
  try {
    const principal = authenticate(request);
    const conversations = await getConversationService().list();
    const data = principal.role === "operator"
      ? conversations
      : conversations.filter((item) => item.customerId === principal.customerId);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
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
