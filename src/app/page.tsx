import Link from "next/link";
import { requireAdminSession } from "@/modules/admin-auth";
import { getConversationService } from "@/modules/conversations/composition-root";
import { CONVERSATION_STATUSES, isConversationStatus } from "@/modules/conversations/domain";
import { LogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";
const statusLabels: Record<string, string> = { open: "待处理", processing: "处理中", waiting_approval: "待审批", human_handoff: "人工接管", resolved: "已解决" };

export default async function Home({ searchParams }: { searchParams: Promise<{ query?: string; status?: string; page?: string }> }) {
  await requireAdminSession();
  const filters = await searchParams;
  const query = filters.query?.trim().toLocaleLowerCase("zh-CN") ?? "";
  const status = isConversationStatus(filters.status ?? "") ? filters.status : "";
  const conversations = await getConversationService().list();
  const visibleConversations = conversations.filter((conversation) => {
    const matchesQuery = !query
      || conversation.customerId.toLocaleLowerCase("zh-CN").includes(query)
      || conversation.latestMessage?.content.toLocaleLowerCase("zh-CN").includes(query);
    return matchesQuery && (!status || conversation.status === status);
  });
  const totalPages = Math.max(1, Math.ceil(visibleConversations.length / 20));
  const requestedPage = /^\d+$/.test(filters.page ?? "") ? Number(filters.page) : 1;
  const currentPage = Math.max(1, Math.min(totalPages, Number.isSafeInteger(requestedPage) ? requestedPage : 1));
  const pageItems = visibleConversations.slice((currentPage - 1) * 20, currentPage * 20);
  const pageHref = (page: number) => `/?${new URLSearchParams({ query: filters.query ?? "", status: status ?? "", page: String(page) })}`;
  return <main className="shell">
    <header className="topbar"><div><p className="eyebrow">客服工作台</p><h1>会话管理</h1></div><div className="topbar-actions"><p className="topbar-note">{visibleConversations.length} 个会话</p><LogoutButton /></div></header>
    <section className="panel" aria-labelledby="conversation-list-title">
      <div className="panel-heading"><div><h2 id="conversation-list-title">全部会话</h2><p>按最近更新时间排序</p></div></div>
      <form className="filters" method="get">
        <label><span>搜索</span><input defaultValue={filters.query} name="query" placeholder="客户 ID 或消息内容" type="search" /></label>
        <label><span>状态</span><select defaultValue={status} name="status"><option value="">全部状态</option>{CONVERSATION_STATUSES.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></label>
        <button type="submit">筛选</button>
        {(query || status) && <Link className="clear-link" href="/">清除</Link>}
      </form>
      {visibleConversations.length === 0 ? <div className="state-card"><span className="state-icon" aria-hidden="true">◎</span><h3>{query || status ? "没有匹配的会话" : "暂无会话"}</h3><p>{query || status ? "请调整搜索条件或状态筛选。" : "客户发起咨询后，会话会显示在这里。"}</p></div> :
        <div className="conversation-list">{pageItems.map((conversation) =>
          <Link className="conversation-row" href={`/conversations/${conversation.id}`} key={conversation.id}>
            <span className="avatar" aria-hidden="true">{conversation.customerId.slice(0, 2).toUpperCase()}</span>
            <span className="conversation-main"><span className="conversation-meta"><strong>{conversation.customerId}</strong><span className={`status status-${conversation.status}`}>{statusLabels[conversation.status] ?? conversation.status}</span></span><span className="latest-message">{conversation.latestMessage?.content ?? "暂无消息"}</span></span>
            <time dateTime={conversation.updatedAt.toISOString()}>{formatDate(conversation.updatedAt)}</time><span className="chevron" aria-hidden="true">›</span>
          </Link>)}</div>}
      <nav className="panel-heading" aria-label="会话分页">
        {currentPage > 1 ? <Link href={pageHref(currentPage - 1)}>上一页</Link> : <span />}
        <span>第 {currentPage} / {totalPages} 页</span>
        {currentPage < totalPages ? <Link href={pageHref(currentPage + 1)}>下一页</Link> : <span />}
      </nav>
    </section>
  </main>;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}
