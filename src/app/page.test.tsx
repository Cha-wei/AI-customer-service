vi.mock("@/components/workspace/workspace-sync", () => ({ WorkspaceSync: () => null }));
import { render, screen } from "@testing-library/react";
import Home from "./page";

const { list } = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/modules/admin-auth", () => ({ requireAdminSession: vi.fn() }));
vi.mock("@/modules/conversations/composition-root", () => ({
  getConversationService: () => ({ list }),
}));

describe("conversation management page", () => {
  beforeEach(() => list.mockReset());

  const page = (conversations: unknown[], overrides = {}) => ({ conversations, page: 1, pageSize: 20, total: conversations.length, ...overrides });

  it("shows the required conversation summary", async () => {
    list.mockResolvedValue(page([{
      id: "conversation-1",
      customerId: "customer-1",
      status: "open",
      latestMessage: { content: "我的订单什么时候到？" },
      createdAt: new Date("2026-09-12T08:00:00Z"),
      updatedAt: new Date("2026-09-12T08:30:00Z"),
    }]));
    render(await Home({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("heading", { name: /会话队列/ })).toBeInTheDocument();
    expect(screen.getByText("陈雨")).toBeInTheDocument();
    expect(screen.getAllByText("待处理").length).toBeGreaterThan(0);
    expect(screen.getByText("我的订单什么时候到？")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /陈雨/ })).toHaveAttribute("href", "/conversations/conversation-1");
  });

  it("shows an empty state", async () => {
    list.mockResolvedValue(page([]));
    render(await Home({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("暂无会话")).toBeInTheDocument();
  });

  it("paginates matching conversations and preserves filters", async () => {
    const date = new Date();
    list.mockResolvedValue(page(Array.from({ length: 5 }, (_, i) => ({ id: String(i + 20), customerId: `customer-${i + 20}`, status: "open", latestMessage: null, updatedAt: date })), { page: 2, total: 25 }));
    render(await Home({ searchParams: Promise.resolve({ query: "customer", status: "open", page: "2" }) }));
    expect(screen.queryByText("customer-0")).not.toBeInTheDocument();
    expect(screen.getByText("客户编号 customer-24")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "上一页" })).toHaveAttribute("href", "/?query=customer&status=open&page=1");
    expect(screen.queryByRole("link", { name: "下一页" })).not.toBeInTheDocument();
  });

  it("filters by customer, message and status", async () => {
    const createdAt = new Date("2026-09-12T08:00:00Z");
    list.mockResolvedValue(page([
      { id: "1", customerId: "customer-1", status: "open", latestMessage: { content: "订单查询" }, createdAt, updatedAt: createdAt },
    ]));
    render(await Home({ searchParams: Promise.resolve({ query: "订单", status: "open" }) }));
    expect(screen.getByText("陈雨")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "清除" })).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith({ query: "订单", status: "open", page: 1 });
  });

  it("maps the demo display name to the existing customer ID before database search", async () => {
    list.mockResolvedValue(page([]));
    render(await Home({ searchParams: Promise.resolve({ query: "陈雨", status: "open" }) }));
    expect(list).toHaveBeenCalledWith({ query: "customer-1", status: "open", page: 1 });
    expect(screen.getByRole("searchbox")).toHaveValue("陈雨");
  });
});
