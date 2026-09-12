export interface ExecutionRecord {
  id: string;
  conversationId: string;
  messageId: string;
  status: "running" | "completed" | "failed";
  toolResult: unknown;
  errorCode: string | null;
  createdAt: Date;
  finishedAt: Date | null;
}

export interface ExecutionPage {
  executions: ExecutionRecord[];
  nextOffset: number | null;
}

export interface ExecutionReader {
  list(conversationId: string, offset: number): Promise<ExecutionPage>;
}
