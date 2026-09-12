import { NextResponse } from "next/server";

import { getConversationService } from "@/modules/conversations/composition-root";

import { conversationErrorResponse, readJsonObject } from "./http";

export async function GET() {
  const conversations = await getConversationService().list();
  return NextResponse.json({ data: conversations });
}

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
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
