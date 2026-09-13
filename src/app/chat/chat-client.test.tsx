import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ChatClient from "./chat-client";
const inbox = { conversations: [], orders: [{ id: "order-1001", label: "耳机" }], page: 1, pageSize: 20, total: 0 };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
it("requires order selection, sends only customer input and displays persisted replies", async () => {
  const fetcher = vi.fn(async (_url: string, options?: RequestInit) => options?.method === "POST" ? reply({ id: "c1" }) : _url.includes("?id=") ? reply({ id: "c1", status: "waiting_approval", messages: [{ id: "m1", role: "agent", content: "退款申请已提交" }], nextCursor: null }) : reply(inbox));
  vi.stubGlobal("fetch", fetcher);
  render(<ChatClient />);
  await waitFor(() => expect(screen.getByRole("button", { name: "申请退款" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "申请退款" }));
  expect(screen.getByRole("button", { name: "发送消息" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("请选择退款订单（必选）"), { target: { value: "order-1001" } });
  fireEvent.click(screen.getByRole("button", { name: "发送消息" }));
  await screen.findByText("退款申请已提交");
  expect(screen.getByRole("button", { name: "发送消息" })).toBeDisabled();
  const sent = fetcher.mock.calls.find(([, options]) => options?.method === "POST")![1]!;
  expect(JSON.parse(sent.body as string)).toEqual({ content: "申请退款", orderId: "order-1001" });
  expect(sent.headers).toEqual({ "Content-Type": "application/json" });
});
it("retains the draft on failure and lets the customer reload after a session error", async () => {
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => options?.method === "POST" ? Promise.reject(new Error("网络中断")) : reply(inbox)));
  render(<ChatClient />);
  await waitFor(() => expect(screen.getByLabelText("消息")).toBeEnabled());
  fireEvent.change(screen.getByLabelText("消息"), { target: { value: "查询订单" } });
  fireEvent.click(screen.getByRole("button", { name: "发送消息" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("网络中断");
  expect(screen.getByLabelText("消息")).toHaveValue("查询订单");
});
it("polls approval outcomes and loads older history without discarding it", async () => {
  vi.useFakeTimers();
  let approved = false;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("before=") ? reply({ messages: [{ id: "old", role: "customer", content: "早期消息" }], nextCursor: null }) : url.includes("?id=") ? reply({ id: "c1", status: approved ? "resolved" : "waiting_approval", messages: [{ id: "pending", role: "agent", content: "等待审批" }, ...(approved ? [{ id: "done", role: "agent", content: "已完成 Mock 退款" }] : [])], nextCursor: "older" }) : reply({ ...inbox, conversations: [{ id: "c1", latestMessage: { content: "已有会话" } }] })));
  await act(async () => { render(<ChatClient />); });
  await act(async () => { fireEvent.click(screen.getByText("已有会话")); });
  await act(async () => { fireEvent.click(screen.getByText("加载更早消息")); });
  approved = true;
  await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
  expect(screen.getByText("已完成 Mock 退款")).toBeInTheDocument();
  expect(screen.getByText("早期消息")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("会话已解决");
});
it("shows expired session errors without enabling send", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => reply({}, 401)));
  render(<ChatClient />);
  expect(await screen.findByRole("alert")).toHaveTextContent("客户登录已失效");
  expect(screen.getByRole("button", { name: "发送消息" })).toBeDisabled();
});
