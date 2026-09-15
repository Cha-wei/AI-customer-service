import { queueAttention, senderLabels } from "./queue-presentation";
import Link from "next/link";
import { normalizeInboxFilters, readQueuePage, queueRevision, type InboxFilters } from "./queue-data";
import { WorkspaceSync } from "./workspace-sync";
import { QueueViewport } from "./queue-viewport";
export type { InboxFilters } from "./queue-data";
import { CONVERSATION_STATUSES } from "@/modules/conversations/domain";
import { customerLabel, formatDate, relativeTime, statusLabels } from "./presentation";
import { WorkspaceIcon } from "./workspace-icon";

export async function ConversationList({ filters = {}, selectedId, selectedCustomerId }: { filters?: InboxFilters; selectedId?: string; selectedCustomerId?: string }) {
  const { query, status } = normalizeInboxFilters(filters);
  const result = await readQueuePage(filters);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const currentPage = result.page;
  const basePath = selectedId ? `/conversations/${selectedId}` : "/";
  const pageHref = (page: number) => `${basePath}?${new URLSearchParams({ query: filters.query ?? "", status, page: String(page) })}`;
  // This async Server Component renders a request-time snapshot, not a ticking client clock.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const revision = queueRevision(result, now);
  const requestUrl = `/api/admin/conversations/queue-revision?${new URLSearchParams({ query, status, page: String(currentPage) })}`;
  return <div className="inbox-content">
    <WorkspaceSync requestUrl={requestUrl} revision={revision} />
    <header className="inbox-heading"><div><h1>客户队列 <span className="inbox-count">{result.total}</span></h1><p>每位客户一个入口 · 按匹配咨询最近更新排序</p><p>待办汇总该客户全部咨询</p></div></header>
    <form className="queue-search" key={query} method="get" action={basePath}>
      <label className="sr-only" htmlFor="queue-query">搜索</label>
      <input id="queue-query" defaultValue={filters.query} name="query" placeholder="搜索客户、消息或订单号" type="search" title="支持客户展示名、客户编号和历史消息中的订单号" />
      {status && <input type="hidden" name="status" value={status} />}
      <button type="submit" aria-label="搜索会话" title="搜索会话"><WorkspaceIcon name="search" /></button>
    </form>
    <nav className="queue-filters" aria-label="会话状态筛选">
      {["", ...CONVERSATION_STATUSES].map(value => <Link key={value} className={status === value ? "active" : ""} aria-current={status === value ? "page" : undefined} href={`${basePath}?${new URLSearchParams({ query, status: value })}`}>{value ? statusLabels[value as keyof typeof statusLabels] : "全部"}</Link>)}
    </nav>
    {query && <div className="search-summary"><span>搜索：{query}</span><Link href={`${basePath}?${new URLSearchParams({ status })}`}>清除</Link></div>}
    {result.conversations.length === 0 ? <div className="queue-empty"><WorkspaceIcon name="search" /><h3>{query || status ? "没有匹配的会话" : "暂无会话"}</h3><p>{query || status ? "试试其他关键词或状态。" : "客户发起咨询后，会话会显示在这里。"}</p></div> :
      <QueueViewport revision={revision}>{result.conversations.map(conversation => {
        const customer = customerLabel(conversation.customerId);
        const text = conversation.latest.latestMessage?.content ?? "";
        const topic = /退款|refund/i.test(text) ? "退款相关" : /订单|物流|order/i.test(text) ? "订单相关" : "";
        const attention = queueAttention(conversation, now);
        return <Link data-customer-id={conversation.customerId} className={`conversation-row ${selectedCustomerId === conversation.customerId ? "selected" : ""}`} aria-current={selectedCustomerId === conversation.customerId ? "page" : undefined} href={`/conversations/${conversation.id}${query || status || currentPage > 1 ? `?${new URLSearchParams({ query, status, page: String(currentPage) })}` : ""}`} key={conversation.customerId}>
          <span className="avatar" aria-hidden="true">{customer.name.slice(0, 1)}</span>
          <span className="conversation-main"><span className="conversation-meta"><strong>{customer.name}</strong><time title={`最近更新：${formatDate(conversation.latest.updatedAt)}`} dateTime={conversation.latest.updatedAt.toISOString()}>{relativeTime(conversation.latest.updatedAt, now)}</time></span><span className="customer-code" title={conversation.customerId}>客户编号 {customer.code}</span><span className="latest-message">{conversation.latest.latestMessage && <span className="message-sender">最近 · {senderLabels[conversation.latest.latestMessage.role] ?? "消息"}：</span>}<span>{text || "暂无消息"}</span></span><span className="queue-aggregate">进行中 {conversation.activeCount} · 待审批 {conversation.pendingApprovals} · 人工接管 {conversation.humanCount}</span><span className="queue-tags"><span className={`status status-${conversation.status}`}>打开：{attention.label ?? statusLabels[conversation.status]}</span>{topic && <span className="topic-label" title="依据最近消息关键词展示，不代表 AI 意图识别结果">{topic}</span>}{attention.actionable && <span className="attention-dot" title="需要人工处理" aria-label="需要人工处理" />}</span>{attention.waiting && <span className="queue-waiting" title={`${conversation.status === "human_handoff" && conversation.hasHumanReply === false ? `进入人工接管：${formatDate(conversation.humanHandoffAt!)}` : `最近客户消息：${formatDate(conversation.latestMessage!.createdAt)}`}；等待时长截至 ${formatDate(new Date(now))}`}>{attention.waiting}</span>}</span>
        </Link>;
      })}</QueueViewport>}
    <nav className="queue-pagination" aria-label="会话分页">
      {currentPage > 1 ? <Link href={pageHref(currentPage - 1)}>上一页</Link> : <span />}
      <span>第 {currentPage} / {totalPages} 页</span>
      {currentPage < totalPages ? <Link href={pageHref(currentPage + 1)}>下一页</Link> : <span />}
    </nav>
  </div>;
}
