import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { readCustomerConsultations } from "./customer-queue-reader";
import { formatDate, statusLabels } from "./presentation";
import { queueAttention } from "./queue-presentation";
import type { InboxFilters } from "./queue-data";

export type ConsultationFilters = InboxFilters & { activePage?: string; historyPage?: string };
function pageNumber(value?: string) { const n = Number(value); return Number.isSafeInteger(n) && n > 0 ? n : 1; }
export async function CustomerConsultations({ customerId, conversationId, status, filters = {} }: { customerId: string; conversationId: string; status: string; filters?: ConsultationFilters }) {
  const [active, history] = await Promise.all([
    readCustomerConsultations(prisma, customerId, false, pageNumber(filters.activePage)),
    readCustomerConsultations(prisma, customerId, true, pageNumber(filters.historyPage)),
  ]);
  const href = (id: string, key?: string, page?: number) => {
    const query = new URLSearchParams();
    for (const field of ["query", "status", "page", "activePage", "historyPage"] as const) if (filters[field]) query.set(field, filters[field]!);
    if (key) query.set(key, String(page));
    return `/conversations/${id}${query.size ? `?${query}` : ""}`;
  };
  // Labels are snapshots refreshed by the existing workspace/queue polling.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  return <section className="customer-consultations" aria-label="该客户的咨询">
    <p className="consultation-scope">{status === "resolved" ? "正在查看历史咨询 · 已解决" : "正在处理当前咨询"} · 订单、审批与回复仅对应本次咨询</p>
    {([["activePage", "切换进行中咨询", active], ["historyPage", "查看历史咨询", history]] as const).map(([key, label, result]) =>
      <details key={key} open={filters[key] !== undefined || undefined}>
        <summary>{label} · {result.total}</summary>
        <div className="consultation-options">
          {result.conversations.length === 0 && <p className="muted">{key === "activePage" ? "暂无进行中咨询" : "暂无历史咨询"}</p>}
          {result.conversations.map(item => {
            const attention = queueAttention(item, now);
            return <Link className="consultation-option" key={item.id} href={href(item.id)} aria-current={item.id === conversationId ? "page" : undefined}>
              <span>{formatDate(item.createdAt)} · {attention.label ?? statusLabels[item.status]}{item.id === conversationId ? " · 当前查看" : ""}</span>
              <span className="consultation-preview">{item.latestMessage?.content ?? "暂无消息"}</span>
              {attention.waiting && <small>{attention.waiting}（截至本次更新）</small>}
            </Link>;
          })}
          {result.total > result.pageSize && <nav aria-label={label + "分页"}>
            {result.page > 1 && <Link href={href(conversationId, key, result.page - 1)}>上一页</Link>}
            <span>第 {result.page} / {Math.ceil(result.total / result.pageSize)} 页</span>
            {result.page * result.pageSize < result.total && <Link href={href(conversationId, key, result.page + 1)}>下一页</Link>}
          </nav>}
        </div>
      </details>)}
  </section>;
}
