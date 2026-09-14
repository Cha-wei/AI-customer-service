import type { ReactNode } from "react";
import { customerLabel } from "./presentation";

export function ConversationHeader({ customerId, createdAt, status, statusLabel, children }: {
  customerId: string; createdAt: Date; status: string; statusLabel: string; children: ReactNode;
}) {
  const customer = customerLabel(customerId);
  return <header className="conversation-header">
    <span className="avatar" aria-hidden="true">{customer.name.slice(0, 1)}</span>
    <div className="customer-heading">
      <h1>{customer.name}</h1>
      <p className="muted" title={customerId}>客户编号 {customer.code} · 开始于 {new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(createdAt)}</p>
    </div>
    <span className={`status status-${status}`}>{statusLabel}</span>
    {children}
  </header>;
}
