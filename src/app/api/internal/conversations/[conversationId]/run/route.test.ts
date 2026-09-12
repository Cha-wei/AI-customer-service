import { RuntimeConflictError } from "@/modules/agent-runtime";
import { ConversationNotFoundError } from "@/modules/conversations";
import { POST } from "./route";
import { configureTestAuth, authHeaders } from "@/test/internal-auth";
configureTestAuth();

const { run } = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("@/modules/agent-runtime/composition-root", () => ({ getAgentRuntime: () => ({ run }) }));

describe("POST conversation run", () => {
  beforeEach(() => { run.mockReset(); });
  const call = () => POST(new Request("http://localhost/api/internal/conversations/c/run", { method: "POST", headers: authHeaders }), { params: Promise.resolve({ conversationId: "c" }) });
  it("invokes runtime using the route conversation id", async () => {
    run.mockResolvedValue({ status: "open" });
    expect((await call()).status).toBe(200);
    expect(run).toHaveBeenCalledWith("c");
  });
  it.each([
    [new RuntimeConflictError("busy"), 409],
    [new ConversationNotFoundError("c"), 404],
    [new Error("private details"), 500],
  ])("maps errors without leaking internal failures", async (error, status) => {
    run.mockRejectedValue(error);
    const response = await call();
    expect(response.status).toBe(status);
    expect(await response.text()).not.toContain("private details");
  });
});
