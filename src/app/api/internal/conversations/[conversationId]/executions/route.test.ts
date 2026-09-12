import { GET } from "./route";
import { ConversationNotFoundError } from "@/modules/conversations";

const { list } = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/modules/agent-runtime/prisma-execution-reader", () => ({
  PrismaExecutionReader: class { list = list; },
}));

describe("execution query API", () => {
  beforeEach(() => { list.mockReset(); });
  const call = (query = "") => GET(new Request(`http://localhost/api/internal/conversations/c/executions${query}`), { params: Promise.resolve({ conversationId: "c" }) });
  it("returns scoped records without caching", async () => {
    list.mockResolvedValue({ executions: [], nextOffset: null });
    const response = await call("?offset=50");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(list).toHaveBeenCalledWith("c", 50);
    expect(await response.json()).toEqual({ executions: [], nextOffset: null });
  });
  it.each(["-1", "1.5", "abc", ""])("rejects invalid offset %s", async (offset) => {
    expect((await call(`?offset=${offset}`)).status).toBe(400);
    expect(list).not.toHaveBeenCalled();
  });
  it("distinguishes a missing conversation from an empty history", async () => {
    list.mockRejectedValue(new ConversationNotFoundError("c"));
    expect((await call()).status).toBe(404);
  });
  it("hides database failure details", async () => {
    list.mockRejectedValue(new Error("private database details"));
    const response = await call();
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private database details");
  });
});
