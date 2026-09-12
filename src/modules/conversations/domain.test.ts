import { canTransitionConversation } from "./domain";

describe("conversation status lifecycle", () => {
  it("allows the approval flow to resume processing", () => {
    expect(canTransitionConversation("processing", "waiting_approval")).toBe(true);
    expect(canTransitionConversation("waiting_approval", "processing")).toBe(true);
  });

  it("allows handoff to resolve but keeps resolved terminal", () => {
    expect(canTransitionConversation("human_handoff", "resolved")).toBe(true);
    expect(canTransitionConversation("resolved", "open")).toBe(false);
  });

  it("rejects skipping directly from open to approval", () => {
    expect(canTransitionConversation("open", "waiting_approval")).toBe(false);
  });
});
