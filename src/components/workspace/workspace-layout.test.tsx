import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WorkspaceLayout } from "./workspace-layout";

afterEach(() => { cleanup(); localStorage.clear(); });
it("collapses independent panels, preserves the conversation and restores preferences on remount", () => {
  const ui = <WorkspaceLayout inbox={<p>队列内容</p>} context={<p>上下文内容</p>}><textarea aria-label="保留的草稿" defaultValue="正在编辑" /></WorkspaceLayout>;
  const { unmount } = render(ui);
  for (const name of ["功能导航", "会话列表", "上下文面板"]) fireEvent.click(screen.getByRole("button", { name: `收起${name}` }));
  expect(screen.getByText("队列内容")).not.toBeVisible();
  expect(screen.getByText("上下文内容")).not.toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "展开上下文面板" }));
  fireEvent.click(screen.getByRole("button", { name: "关闭上下文面板" }));
  expect(screen.getByRole("button", { name: "展开上下文面板" })).toHaveFocus();
  expect(screen.getByLabelText("保留的草稿")).toHaveValue("正在编辑");
  expect(localStorage.getItem("customer-workspace-layout-v2")).toBe("111");
  unmount(); render(ui);
  for (const name of ["功能导航", "会话列表", "上下文面板"]) expect(screen.getByRole("button", { name: `展开${name}` })).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(screen.getByRole("button", { name: "展开会话列表" }));
  expect(screen.getByText("队列内容")).toBeVisible();
  expect(screen.getByText("上下文内容")).not.toBeVisible();
});
it("ignores malformed preferences and keeps unavailable navigation noninteractive", () => {
  localStorage.setItem("customer-workspace-layout-v2", '{"bad":true}');
  render(<WorkspaceLayout inbox={<p>队列</p>}>会话内容</WorkspaceLayout>);
  expect(screen.getByRole("button", { name: "收起会话列表" })).toBeVisible();
  expect(screen.getByRole("button", { name: "知识库 · 未开放" })).toBeDisabled();
});
