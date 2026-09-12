export type IntentFailureCode = "MODEL_TIMEOUT" | "MODEL_UNAVAILABLE" | "MODEL_INVALID_OUTPUT" | "MODEL_REFUSED";

export class IntentProviderError extends Error {
  constructor(readonly code: IntentFailureCode) {
    super("Intent classification failed.");
    this.name = "IntentProviderError";
  }
}
