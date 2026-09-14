import { render, screen } from "@testing-library/react";
import ConversationDetail from "./page";

const { getHeader, listMessages, listExecutions } = vi.hoisted(() => ({ getHeader: vi.fn(), listMessages: vi.fn(), listExecutions: vi.fn() }));
vi.mock("@/modules/admin-auth", () => ({ requireAdminSession: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/components/workspace/workspace-data", () => ({ readMessageActivity: async () => [] }));
vi.mock("@/modules/approvals/composition-root", () => ({ getApprovalService: () => ({ list: async () => [] }) }));
vi.mock("@/modules/conversations/composition-root", () => ({
  getConversationService: () => ({ getHeader, listMessages, list: async () => ({ conversations: [], page: 1, pageSize: 20, total: 0 }) }),
}));
vi.mock("@/modules/agent-runtime/prisma-execution-reader", () => ({
  PrismaExecutionReader: class { list = listExecutions; },
}));

describe("conversation detail page", () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  });
  beforeEach(() => { getHeader.mockReset(); listMessages.mockReset(); listExecutions.mockReset(); });

  it("shows messages and execution details", async () => {
    const createdAt = new Date("2026-09-12T08:00:00Z");
    getHeader.mockResolvedValue({
      id: "conversation-1", customerId: "customer-1", status: "open", createdAt, updatedAt: createdAt,
    });
    listMessages.mockResolvedValue({
      messages: [
        { id: "message-1", role: "customer", content: "我的订单什么时候到？", createdAt },
        { id: "message-2", role: "agent", content: "订单正在运输中。", createdAt },
      ], nextCursor: "older",
    });
    listExecutions.mockResolvedValue({
      executions: [{
        id: "execution-1", status: "completed",
        toolResult: { status: "shipped", carrier: "Mock Express" },
        errorCode: null, createdAt, finishedAt: createdAt,
      }],
      nextOffset: null,
    });

    render(await ConversationDetail({ params: Promise.resolve({ conversationId: "conversation-1" }) }));
    expect(screen.getByRole("heading", { name: "陈雨" })).toBeInTheDocument();
    expect(screen.getByText("我的订单什么时候到？")).toBeInTheDocument();
    expect(screen.getByText("订单正在运输中。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "加载更早消息" })).toBeInTheDocument();
    expect(screen.getByText(/Mock Express/)).toBeInTheDocument();
    expect(screen.getByText("已完成")).toBeInTheDocument();
    expect(listExecutions).toHaveBeenCalledWith("conversation-1", 0);
  });

  it("shows empty states", async () => {
    const createdAt = new Date("2026-09-12T08:00:00Z");
    getHeader.mockResolvedValue({
      id: "conversation-1", customerId: "customer-1", status: "open",
      createdAt, updatedAt: createdAt,
    });
    listMessages.mockResolvedValue({ messages: [], nextCursor: null });
    listExecutions.mockResolvedValue({ executions: [], nextOffset: null });

    render(await ConversationDetail({ params: Promise.resolve({ conversationId: "conversation-1" }) }));
    expect(screen.getByText("暂无消息记录")).toBeInTheDocument();
    expect(screen.getByText("暂无执行记录")).toBeInTheDocument();
  });

  it("reads and links execution history pages", async () => {
    const createdAt = new Date("2026-09-12T08:00:00Z");
    getHeader.mockResolvedValue({ id: "conversation-1", customerId: "customer-1", status: "open", createdAt, updatedAt: createdAt });
    listMessages.mockResolvedValue({ messages: [], nextCursor: null });
    listExecutions.mockResolvedValue({ executions: [{ id: "e", status: "completed", createdAt, finishedAt: null, toolResult: null, errorCode: null }], nextOffset: 100 });

    render(await ConversationDetail({ params: Promise.resolve({ conversationId: "conversation-1" }), searchParams: Promise.resolve({ executionPage: "2" }) }));

    expect(listExecutions).toHaveBeenCalledWith("conversation-1", 50);
    expect(screen.getByRole("link", { name: "上一页", hidden: true })).toHaveAttribute("href", "/conversations/conversation-1?executionPage=1");
    expect(screen.getByRole("link", { name: "下一页", hidden: true })).toHaveAttribute("href", "/conversations/conversation-1?executionPage=3");
  });

  it("redirects an empty out-of-range page to the first page", async () => {
    getHeader.mockResolvedValue({ id: "conversation-1" });
    listMessages.mockResolvedValue({ messages: [], nextCursor: null });
    listExecutions.mockResolvedValue({ executions: [], nextOffset: null });
    await expect(ConversationDetail({ params: Promise.resolve({ conversationId: "conversation-1" }), searchParams: Promise.resolve({ executionPage: "99" }) })).rejects.toMatchObject({ digest: expect.stringContaining("/conversations/conversation-1") });
  });
});
