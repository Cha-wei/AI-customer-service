import { render, screen } from "@testing-library/react";
import Home from "./page";

const { list } = vi.hoisted(() => ({ list: vi.fn() }));
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
    render(await Home());
    expect(screen.getByRole("heading", { name: "会话管理" })).toBeInTheDocument();
    expect(screen.getByText("customer-1")).toBeInTheDocument();
    expect(screen.getByText("待处理")).toBeInTheDocument();
    expect(screen.getByText("我的订单什么时候到？")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/conversations/conversation-1");
  });

  it("shows an empty state", async () => {
    list.mockResolvedValue([]);
    render(await Home());
    expect(screen.getByText("暂无会话")).toBeInTheDocument();
  });
});
