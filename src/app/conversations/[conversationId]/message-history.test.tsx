import { act, fireEvent, render, screen } from "@testing-library/react";
import { MessageHistory } from "./message-history";

const message = (id: string, content: string) => ({ id, conversationId: "c-1", role: "customer" as const, content, createdAt: new Date("2026-09-13T00:00:00Z") });

it("prepends older messages and preserves the visible reading position", async () => {
  let resolveFetch!: (value: Response) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve; })));
  const { container } = render(<MessageHistory conversationId="c-1" initialMessages={[message("new", "new")]} initialCursor="older" />);
  const list = container.querySelector(".message-list") as HTMLDivElement;
  let height = 100;
  Object.defineProperty(list, "scrollHeight", { get: () => height });
  list.scrollTop = 25;
  fireEvent.click(screen.getByRole("button", { name: "加载更早消息" }));
  height = 160;
  await act(async () => resolveFetch(new Response(JSON.stringify({ data: [message("old", "old")], nextCursor: null }), { status: 200 })));
  expect(screen.getAllByText(/old|new/).map((node) => node.textContent)).toEqual(["old", "new"]);
  expect(list.scrollTop).toBe(85);
  expect(screen.getByText("已到达最早消息")).toBeInTheDocument();
});
