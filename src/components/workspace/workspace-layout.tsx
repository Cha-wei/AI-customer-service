"use client";

import Link from "next/link";
import { useRef, useSyncExternalStore, type ReactNode } from "react";
import { LogoutButton } from "@/app/logout-button";
import { WorkspaceIcon, type WorkspaceIconName } from "./workspace-icon";

const layoutKey = "customer-workspace-layout-v2";
const layoutEvent = "workspace-layout-change";
let fallback = "000";
function snapshot() {
  try { const value = localStorage.getItem(layoutKey); return value && /^[01]{3}$/.test(value) ? value : "000"; } catch { return fallback; }
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(layoutEvent, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(layoutEvent, callback); };
}
const links: { title: string; status: string; icon: WorkspaceIconName }[] = [
  { title: "会话中心", status: "", icon: "conversations" },
  { title: "待处理", status: "open", icon: "queue" },
  { title: "待审批", status: "waiting_approval", icon: "approval" },
  { title: "人工接管", status: "human_handoff", icon: "human" },
  { title: "已解决", status: "resolved", icon: "resolved" },
];

export function WorkspaceLayout({ inbox, children, context, filter = "" }: { inbox: ReactNode; children: ReactNode; context?: ReactNode; filter?: string }) {
  // External storage preserves layout across route changes without a hydration mismatch.
  const value = useSyncExternalStore(subscribe, snapshot, () => "000");
  const contextToggle = useRef<HTMLButtonElement>(null);
  const [navClosed, listClosed, contextClosed] = value.split("").map(char => char === "1");
  function toggle(index: number) {
    const flags = snapshot().split(""); flags[index] = flags[index] === "1" ? "0" : "1";
    fallback = flags.join("");
    try { localStorage.setItem(layoutKey, fallback); } catch { /* Keep the in-memory preference when storage is unavailable. */ }
    window.dispatchEvent(new Event(layoutEvent));
  }
  return <main className={`workspace ${navClosed ? "nav-collapsed" : ""} ${listClosed ? "list-collapsed" : ""} ${contextClosed || !context ? "context-collapsed" : ""}`}>
    <aside className="workspace-sidebar" aria-label="主导航">
      <div className="workspace-brand"><span className="product-mark">AI</span><strong className="nav-label">AI 客服工作台</strong></div>
      <button className="nav-collapse" title={navClosed ? "展开功能导航" : "收起功能导航"} aria-label={navClosed ? "展开功能导航" : "收起功能导航"} aria-expanded={!navClosed} onClick={() => toggle(0)}><WorkspaceIcon name="collapse" /><span className="nav-label">收起导航</span></button>
      <nav aria-label="工作台功能"><p className="nav-group nav-label">工作台</p>
        {links.map(link => <Link key={link.title} title={link.title} aria-label={link.title} className={`sidebar-link ${filter === link.status ? "active" : ""}`} href={link.status ? `/?status=${link.status}` : "/"} aria-current={filter === link.status ? "page" : undefined}><WorkspaceIcon name={link.icon} /><span className="nav-label">{link.title}</span></Link>)}
        <p className="nav-group nav-label">知识与 AI</p>
        {([{ title: "知识库", icon: "knowledge" }, { title: "智能体", icon: "agent" }] as const).map(item => <button key={item.title} className="sidebar-link unavailable" disabled title={`${item.title} · 未开放`} aria-label={`${item.title} · 未开放`}><WorkspaceIcon name={item.icon} /><span className="nav-label">{item.title}<small>未开放</small></span></button>)}
      </nav>
      <div className="sidebar-bottom"><button className="sidebar-link unavailable" disabled title="系统设置 · 未开放" aria-label="系统设置 · 未开放"><WorkspaceIcon name="settings" /><span className="nav-label">系统设置<small>未开放</small></span></button><div className="operator"><span className="operator-avatar" title="管理员">管</span><div className="nav-label"><strong>管理员</strong><small title="当前使用共享管理员账户">客服团队</small></div></div><LogoutButton /></div>
    </aside>
    <div className="workspace-body">
      <header className="workspace-toolbar"><div className="workspace-tools"><button className="toolbar-button" aria-label={listClosed ? "展开会话列表" : "收起会话列表"} aria-expanded={!listClosed} aria-controls="workspace-inbox" onClick={() => toggle(1)}><WorkspaceIcon name="list" /><span>{listClosed ? "展开列表" : "会话队列"}</span></button><span className="toolbar-divider" /><span className="toolbar-title">会话中心</span></div>{context && <button ref={contextToggle} className="toolbar-button" aria-label={contextClosed ? "展开上下文面板" : "收起上下文面板"} aria-expanded={!contextClosed} aria-controls="workspace-context" onClick={() => toggle(2)}><WorkspaceIcon name="context" /><span>上下文</span></button>}</header>
      <div className="workspace-panels">
        <section id="workspace-inbox" className="workspace-inbox" hidden={listClosed} aria-label="会话列表">{inbox}</section>
        <section className="workspace-conversation" aria-label="当前会话">{children}</section>
        {context && <aside id="workspace-context" className="context-panel" hidden={contextClosed} aria-label="上下文面板"><header className="context-heading"><h2>处理上下文</h2><button aria-label="关闭上下文面板" className="icon-button" onClick={() => { contextToggle.current?.focus(); toggle(2); }}>×</button></header>{context}</aside>}
      </div>
    </div>
  </main>;
}

export function WorkspaceEmpty() {
  return <div className="workspace-empty"><WorkspaceIcon name="conversations" /><h2>选择一个会话开始处理</h2><p>查看客户问题、AI 处理记录与待办事项。</p><p className="muted">可通过顶部按钮展开会话队列。</p></div>;
}
