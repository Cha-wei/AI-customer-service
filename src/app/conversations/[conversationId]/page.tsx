import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/modules/admin-auth";
import { PrismaExecutionReader } from "@/modules/agent-runtime/prisma-execution-reader";
import { ConversationNotFoundError } from "@/modules/conversations";
import { getConversationService } from "@/modules/conversations/composition-root";

export const dynamic = "force-dynamic";
const statusLabels: Record<string, string> = { open: "待处理", processing: "处理中", waiting_approval: "待审批", human_handoff: "人工接管", resolved: "已解决" };
const executionLabels: Record<string, string> = { running: "执行中", completed: "已完成", failed: "失败" };

export default async function ConversationDetail({ params }: { params: Promise<{ conversationId: string }> }) {
  await requireAdminSession();
  const { conversationId } = await params;
  const { conversation, page } = await loadConversation(conversationId);

  return <main className="shell">
    <Link className="back-link" href="/">← 返回会话列表</Link>
    <header className="detail-header"><div><p className="eyebrow">会话详情</p><h1>{conversation.customerId}</h1><p className="muted mono">{conversation.id}</p></div><span className={`status status-${conversation.status}`}>{statusLabels[conversation.status] ?? conversation.status}</span></header>
    <div className="detail-grid">
      <section className="panel" aria-labelledby="messages-title"><div className="panel-heading"><div><h2 id="messages-title">消息记录</h2><p>{conversation.messages.length} 条消息</p></div></div>
        {conversation.messages.length === 0 ? <Empty text="暂无消息记录" /> : <div className="message-list">{conversation.messages.map((message) => <article className={`message message-${message.role}`} key={message.id}><div className="message-meta"><strong>{message.role === "customer" ? "客户" : message.role === "agent" ? "AI 客服" : "系统"}</strong><time dateTime={message.createdAt.toISOString()}>{formatDate(message.createdAt)}</time></div><p>{message.content}</p></article>)}</div>}
      </section>
      <section className="panel" aria-labelledby="executions-title"><div className="panel-heading"><div><h2 id="executions-title">执行记录</h2><p>最近 {page.executions.length} 条</p></div></div>
        {page.executions.length === 0 ? <Empty text="暂无执行记录" /> : <div className="execution-list">{page.executions.map((execution) => <article className="execution" key={execution.id}><div className="execution-heading"><span className={`status execution-${execution.status}`}>{executionLabels[execution.status]}</span><time dateTime={execution.createdAt.toISOString()}>{formatDate(execution.createdAt)}</time></div><dl><div><dt>工具结果</dt><dd>{formatResult(execution.toolResult)}</dd></div><div><dt>失败原因</dt><dd>{execution.errorCode ?? "—"}</dd></div><div><dt>完成时间</dt><dd>{execution.finishedAt ? formatDate(execution.finishedAt) : "—"}</dd></div></dl></article>)}</div>}
      </section>
    </div>
  </main>;
}

async function loadConversation(conversationId: string) {
  try {
    const [conversation, page] = await Promise.all([getConversationService().get(conversationId), new PrismaExecutionReader(prisma).list(conversationId, 0)]);
    return { conversation, page };
  } catch (error) { if (error instanceof ConversationNotFoundError) notFound(); throw error; }
}

function Empty({ text }: { text: string }) { return <div className="state-card compact"><span className="state-icon" aria-hidden="true">◎</span><p>{text}</p></div>; }
function formatResult(value: unknown): string { if (value === null || value === undefined) return "—"; return typeof value === "string" ? value : JSON.stringify(value, null, 2); }
function formatDate(date: Date): string { return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(date); }
