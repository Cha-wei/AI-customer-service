import { NextResponse } from "next/server";

import {
  ConversationNotFoundError,
  ConversationValidationError,
  InvalidConversationTransitionError,
} from "@/modules/conversations";

export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown>> {
  let value: unknown;

  try {
    value = await request.json();
  } catch {
    throw new ConversationValidationError("Request body must be valid JSON.");
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ConversationValidationError("Request body must be a JSON object.");
  }

  return value as Record<string, unknown>;
}

export function conversationErrorResponse(
  error: unknown,
): NextResponse | undefined {
  if (error instanceof ConversationValidationError) {
    return NextResponse.json(
      { error: { code: "validation_error", message: error.message } },
      { status: 400 },
    );
  }

  if (error instanceof ConversationNotFoundError) {
    return NextResponse.json(
      { error: { code: "conversation_not_found", message: error.message } },
      { status: 404 },
    );
  }

  if (error instanceof InvalidConversationTransitionError) {
    return NextResponse.json(
      { error: { code: "invalid_status_transition", message: error.message } },
      { status: 409 },
    );
  }

  return undefined;
}
