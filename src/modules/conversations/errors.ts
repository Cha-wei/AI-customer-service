export class ConversationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConversationValidationError";
  }
}

export class ConversationNotFoundError extends Error {
  constructor(conversationId: string) {
    super("Conversation " + conversationId + " was not found.");
    this.name = "ConversationNotFoundError";
  }
}

export class InvalidConversationTransitionError extends Error {
  constructor(current: string, next: string) {
    super("Conversation cannot transition from " + current + " to " + next + ".");
    this.name = "InvalidConversationTransitionError";
  }
}
