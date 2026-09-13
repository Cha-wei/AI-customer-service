import type { ReactNode } from "react";

export function ConversationHeader({ customerId, createdAt, status, statusLabel, children }: {
  customerId: string; createdAt: Date; status: string; statusLabel: string; children: ReactNode;
}) {
  return <header className="conversation-header">
    <span className="avatar" aria-hidden="true">{customerId.slice(-2).toUpperCase()}</span>
    <div className="customer-heading">
      <p className="eyebrow">客户会话</p><h1>{customerId}</h1>
      <p className="muted">开始于 {new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(createdAt)}</p>
    </div>
    <span className={`status status-${status}`}>{statusLabel}</span>
    {children}
  </header>;
}
