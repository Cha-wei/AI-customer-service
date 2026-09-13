import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MessageHistory } from "./message-history";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

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

it("retains both draft and request snapshot on uncertain sends", async () => {
  const fetcher = vi.fn(async (_url: string, options?: RequestInit) => {
    if (options?.method === "POST") throw new Error("connection interrupted");
    return new Response(JSON.stringify({ data: [message("m1", "客户问题")], nextCursor: null, status: "human_handoff" }));
  });
  vi.stubGlobal("fetch", fetcher);
  render(<MessageHistory conversationId="c-1" initialStatus="human_handoff" initialMessages={[message("m1", "客户问题")]} initialCursor={null} />);
  fireEvent.change(screen.getByLabelText("人工回复"), { target: { value: "人工回答" } });
  fireEvent.click(screen.getByRole("button", { name: "发送人工回复" }));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("人工回复")).toHaveValue("人工回答");
  await waitFor(() => expect(screen.getByRole("button", { name: "发送人工回复" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "发送人工回复" }));
  await waitFor(() => expect(fetcher.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(2));
  const requests = fetcher.mock.calls.filter(([, options]) => options?.method === "POST").map(([, options]) => JSON.parse(options!.body as string));
  expect(requests).toEqual([{ content: "人工回答", lastMessageId: "m1" }, { content: "人工回答", lastMessageId: "m1" }]);
});
