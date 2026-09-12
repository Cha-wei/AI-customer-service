import Link from "next/link";
import { getConversationService } from "@/modules/conversations/composition-root";

export const dynamic = "force-dynamic";
const statusLabels: Record<string, string> = { open: "待处理", processing: "处理中", waiting_approval: "待审批", human_handoff: "人工接管", resolved: "已解决" };

export default async function Home() {
  const conversations = await getConversationService().list();
  return <main className="shell">
    <header className="topbar"><div><p className="eyebrow">客服工作台</p><h1>会话管理</h1></div><p className="topbar-note">{conversations.length} 个会话</p></header>
    <section className="panel" aria-labelledby="conversation-list-title">
      <div className="panel-heading"><div><h2 id="conversation-list-title">全部会话</h2><p>按最近更新时间排序</p></div></div>
      {conversations.length === 0 ? <div className="state-card"><span className="state-icon" aria-hidden="true">◎</span><h3>暂无会话</h3><p>客户发起咨询后，会话会显示在这里。</p></div> :
        <div className="conversation-list">{conversations.map((conversation) =>
          <Link className="conversation-row" href={`/conversations/${conversation.id}`} key={conversation.id}>
            <span className="avatar" aria-hidden="true">{conversation.customerId.slice(0, 2).toUpperCase()}</span>
            <span className="conversation-main"><span className="conversation-meta"><strong>{conversation.customerId}</strong><span className={`status status-${conversation.status}`}>{statusLabels[conversation.status] ?? conversation.status}</span></span><span className="latest-message">{conversation.latestMessage?.content ?? "暂无消息"}</span></span>
            <time dateTime={conversation.updatedAt.toISOString()}>{formatDate(conversation.updatedAt)}</time><span className="chevron" aria-hidden="true">›</span>
          </Link>)}</div>}
    </section>
  </main>;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}
