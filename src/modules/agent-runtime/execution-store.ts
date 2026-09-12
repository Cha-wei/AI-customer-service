import type { Message } from "../conversations";
import type { RuntimeResult } from "./runtime";

export interface ExecutionStore {
  begin(conversationId: string, messageId: string): Promise<string>;
  complete(id: string, content: string, status: RuntimeResult["status"], toolResult: RuntimeResult["toolResult"]): Promise<Message>;
  fail(id: string): Promise<void>;
  recoverExpired(before: Date): Promise<number>;
}
