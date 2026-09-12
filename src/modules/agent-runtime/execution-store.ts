import type { Message } from "../conversations";
import type { RuntimeResult } from "./runtime";
import type { IntentFailureCode } from "./intent-error";

export interface ExecutionStore {
  begin(conversationId: string, messageId: string): Promise<string>;
  complete(id: string, content: string, status: RuntimeResult["status"], toolResult: RuntimeResult["toolResult"], errorCode?: IntentFailureCode): Promise<Message>;
  fail(id: string): Promise<void>;
  recoverExpired(before: Date): Promise<number>;
}
