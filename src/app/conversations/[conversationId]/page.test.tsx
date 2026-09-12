import { render, screen } from "@testing-library/react";
import ConversationDetail from "./page";

const { get, listExecutions } = vi.hoisted(() => ({ get: vi.fn(), listExecutions: vi.fn() }));
vi.mock("@/modules/admin-auth", () => ({ requireAdminSession: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/modules/conversations/composition-root", () => ({
  getConversationService: () => ({ get }),
}));
vi.mock("@/modules/agent-runtime/prisma-execution-reader", () => ({
  PrismaExecutionReader: class { list = listExecutions; },
}));

describe("conversation detail page", () => {
  beforeEach(() => { get.mockReset(); listExecutions.mockReset(); });

  it("shows messages and execution details", async () => {
    const createdAt = new Date("2026-09-12T08:00:00Z");
    get.mockResolvedValue({
      id: "conversation-1", customerId: "customer-1", status: "open", createdAt, updatedAt: createdAt,
      messages: [
        { id: "message-1", role: "customer", content: "我的订单什么时候到？", createdAt },
        { id: "message-2", role: "agent", content: "订单正在运输中。", createdAt },
      ],
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
    expect(screen.getByRole("heading", { name: "customer-1" })).toBeInTheDocument();
    expect(screen.getByText("我的订单什么时候到？")).toBeInTheDocument();
    expect(screen.getByText("订单正在运输中。")).toBeInTheDocument();
    expect(screen.getByText(/Mock Express/)).toBeInTheDocument();
    expect(screen.getByText("已完成")).toBeInTheDocument();
    expect(listExecutions).toHaveBeenCalledWith("conversation-1", 0);
  });

  it("shows empty states", async () => {
    const createdAt = new Date("2026-09-12T08:00:00Z");
    get.mockResolvedValue({
      id: "conversation-1", customerId: "customer-1", status: "open",
      messages: [], createdAt, updatedAt: createdAt,
    });
    listExecutions.mockResolvedValue({ executions: [], nextOffset: null });

    render(await ConversationDetail({ params: Promise.resolve({ conversationId: "conversation-1" }) }));
    expect(screen.getByText("暂无消息记录")).toBeInTheDocument();
    expect(screen.getByText("暂无执行记录")).toBeInTheDocument();
  });

  it("reads and links execution history pages", async () => {
    const createdAt = new Date("2026-09-12T08:00:00Z");
    get.mockResolvedValue({ id: "conversation-1", customerId: "customer-1", status: "open", messages: [], createdAt, updatedAt: createdAt });
    listExecutions.mockResolvedValue({ executions: [], nextOffset: 100 });

    render(await ConversationDetail({ params: Promise.resolve({ conversationId: "conversation-1" }), searchParams: Promise.resolve({ executionPage: "2" }) }));

    expect(listExecutions).toHaveBeenCalledWith("conversation-1", 50);
    expect(screen.getByRole("link", { name: "上一页" })).toHaveAttribute("href", "/conversations/conversation-1?executionPage=1");
    expect(screen.getByRole("link", { name: "下一页" })).toHaveAttribute("href", "/conversations/conversation-1?executionPage=3");
  });
});
