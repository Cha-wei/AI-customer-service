// @vitest-environment node
import { POST } from "./route";
import { AdminTransitionConflict } from "@/modules/conversations/admin-transition";
const m = vi.hoisted(() => ({ auth: vi.fn(), reply: vi.fn() }));
vi.mock("@/modules/admin-auth", () => ({ requireAdminSession: m.auth }));
vi.mock("@/modules/conversations/human-reply", () => ({ replyFromHuman: m.reply }));
beforeEach(() => { vi.resetAllMocks(); });
const context = { params: Promise.resolve({ conversationId: "c1" }) };
const request = (origin = "http://localhost") => new Request("http://localhost/api/admin/conversations/c1/messages", { method: "POST", headers: { origin }, body: JSON.stringify({ content: "reply", lastMessageId: "m1", role: "agent" }) });
it("requires admin authentication before any writes", async () => {
  m.auth.mockRejectedValue(new Error("unauthorized"));
  await expect(POST(request(), context)).rejects.toThrow("unauthorized");
  expect(m.reply).not.toHaveBeenCalled();
});
it("blocks CSRF and always uses the human reply service", async () => {
  expect((await POST(request("https://evil.example"), context)).status).toBe(403);
  expect(m.reply).not.toHaveBeenCalled();
  m.reply.mockResolvedValue({ id: "m2", role: "human" });
  const response = await POST(request(), context);
  expect(response.status).toBe(201);
  expect(m.reply).toHaveBeenCalledWith(expect.anything(), "c1", "reply", "m1");
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("reports conflicts and sanitizes storage failures", async () => {
  m.reply.mockRejectedValue(new AdminTransitionConflict());
  expect((await POST(request(), context)).status).toBe(409);
  m.reply.mockRejectedValue(new Error("private connection data"));
  const response = await POST(request(), context);
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private connection data");
});
