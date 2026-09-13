import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "@/app/logout-button";

export function WorkspaceLayout({ inbox, children }: { inbox: ReactNode; children: ReactNode }) {
  return <main className="workspace">
    <aside className="workspace-sidebar" aria-label="主导航">
      <div className="workspace-brand"><span className="brand-symbol" aria-hidden="true">✦</span><div><strong>Aira<span className="brand-dot">.</span></strong><small>AI 客服工作台</small></div></div>
      <nav><Link className="sidebar-link active" href="/" aria-current="page"><span aria-hidden="true">▤</span>会话<span className="nav-indicator" /></Link></nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><span aria-hidden="true">✦</span><p>让每一次对话<br />都得到认真回应</p><small>AI 辅助 · 人工协作</small></div><div className="operator"><span className="operator-avatar">A</span><div><strong>客服团队</strong><small>管理员工作空间</small></div></div><LogoutButton /></div>
    </aside>
    <section className="workspace-inbox" aria-label="会话列表">{inbox}</section>
    <section className="workspace-conversation" aria-label="当前会话">{children}</section>
  </main>;
}

export function WorkspaceEmpty() {
  return <div className="workspace-empty"><span className="empty-orbit" aria-hidden="true">✦</span><p className="eyebrow">每一次对话，都从这里开始</p><h2>专注对话，让服务更有温度</h2><p>从左侧选择一个会话，查看客户消息，<br />与 AI 一起完成下一步处理。</p><div className="empty-capabilities"><span>◎ 了解问题</span><span>✦ AI 辅助</span><span>✓ 人工协作</span></div></div>;
}
