import { render, screen } from "@testing-library/react";
import Home from "./page";

const { list } = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/modules/admin-auth", () => ({ requireAdminSession: vi.fn() }));
vi.mock("@/modules/conversations/composition-root", () => ({
  getConversationService: () => ({ list }),
}));

describe("conversation management page", () => {
  beforeEach(() => list.mockReset());

  it("shows the required conversation summary", async () => {
    list.mockResolvedValue([{
      id: "conversation-1",
      customerId: "customer-1",
      status: "open",
      latestMessage: { content: "我的订单什么时候到？" },
      createdAt: new Date("2026-09-12T08:00:00Z"),
      updatedAt: new Date("2026-09-12T08:30:00Z"),
    }]);
    render(await Home({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("heading", { name: "会话管理" })).toBeInTheDocument();
    expect(screen.getByText("customer-1")).toBeInTheDocument();
    expect(screen.getAllByText("待处理")).toHaveLength(2);
    expect(screen.getByText("我的订单什么时候到？")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/conversations/conversation-1");
  });

  it("shows an empty state", async () => {
    list.mockResolvedValue([]);
    render(await Home({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("暂无会话")).toBeInTheDocument();
  });

  it("filters by customer, message and status", async () => {
    const createdAt = new Date("2026-09-12T08:00:00Z");
    list.mockResolvedValue([
      { id: "1", customerId: "customer-1", status: "open", latestMessage: { content: "订单查询" }, createdAt, updatedAt: createdAt },
      { id: "2", customerId: "customer-2", status: "resolved", latestMessage: { content: "产品问题" }, createdAt, updatedAt: createdAt },
    ]);
    render(await Home({ searchParams: Promise.resolve({ query: "订单", status: "open" }) }));
    expect(screen.getByText("customer-1")).toBeInTheDocument();
    expect(screen.queryByText("customer-2")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "清除" })).toBeInTheDocument();
  });
});
