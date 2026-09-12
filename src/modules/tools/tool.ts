export interface ToolCallInput {
  callId: string;
  arguments: unknown;
}

export interface ToolError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface ToolSuccess<TOutput> {
  ok: true;
  callId: string;
  toolName: string;
  data: TOutput;
}

export interface ToolFailure {
  ok: false;
  callId: string;
  toolName: string;
  error: ToolError;
}

export type ToolResult<TOutput> = ToolSuccess<TOutput> | ToolFailure;

export interface Tool<TOutput = unknown> {
  readonly name: string;
  execute(input: ToolCallInput): Promise<ToolResult<TOutput>>;
}
