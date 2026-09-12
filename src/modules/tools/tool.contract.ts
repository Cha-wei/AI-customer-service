import type { Tool } from "./tool";

export interface ToolContractFixture {
  createTool(): Tool;
  validArguments: unknown;
  invalidArguments: unknown;
}

export function toolContract(fixture: ToolContractFixture): void {
  it("preserves call identity and tool name on success", async () => {
    const tool = fixture.createTool();
    const result = await tool.execute({
      callId: "call-success",
      arguments: fixture.validArguments,
    });

    expect(result.ok).toBe(true);
    expect(result.callId).toBe("call-success");
    expect(result.toolName).toBe(tool.name);
  });

  it("returns a structured failure instead of throwing for invalid input", async () => {
    const tool = fixture.createTool();
    const result = await tool.execute({
      callId: "call-failure",
      arguments: fixture.invalidArguments,
    });

    expect(result.ok).toBe(false);
    expect(result.callId).toBe("call-failure");
    expect(result.toolName).toBe(tool.name);
    if (!result.ok) {
      expect(result.error.code).toBeTruthy();
      expect(result.error.message).toBeTruthy();
      expect(typeof result.error.retryable).toBe("boolean");
    }
  });
}
