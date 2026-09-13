import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/modules/admin-auth";
import { PrismaExecutionReader } from "@/modules/agent-runtime/prisma-execution-reader";
import { ConversationNotFoundError } from "@/modules/conversations";
import { getConversationService } from "@/modules/conversations/composition-root";
import { MessageHistory } from "./message-history";
import { getApprovalService } from "@/modules/approvals/composition-root";

export const dynamic = "force-dynamic";
const statusLabels: Record<string, string> = { open: "待处理", processing: "处理中", waiting_approval: "待审批", human_handoff: "人工接管", resolved: "已解决" };
const executionLabels: Record<string, string> = { running: "执行中", completed: "已完成", failed: "失败" };

export default async function ConversationDetail({ params, searchParams }: { params: Promise<{ conversationId: string }>; searchParams?: Promise<{ notice?: string; executionPage?: string }> }) {
  await requireAdminSession();
  const { conversationId } = await params;
  const filters = await searchParams;
  const requestedExecutionPage = /^\d+$/.test(filters?.executionPage ?? "") ? Number(filters?.executionPage) : 1;
  const executionPage = Number.isSafeInteger(requestedExecutionPage) && requestedExecutionPage > 0 && requestedExecutionPage <= 20_001 ? requestedExecutionPage : 1;
  const { conversation, messages, page } = await loadConversation(conversationId, executionPage);
  if (executionPage > 1 && page.executions.length === 0) redirect(`/conversations/${encodeURIComponent(conversationId)}`);
  const notice = filters?.notice;
  const approvals = await getApprovalService().list(conversation.id, conversation.customerId);

  return <main className="shell">
    <Link className="back-link" href="/">← 返回会话列表</Link>
    <header className="detail-header"><div><p className="eyebrow">会话详情</p><h1>{conversation.customerId}</h1><p className="muted mono">{conversation.id}</p></div><span className={`status status-${conversation.status}`}>{statusLabels[conversation.status] ?? conversation.status}</span></header>
    {notice && <p role="alert">{notice === "conflict" ? "会话状态已改变或正在执行，请刷新后重试。" : "更新失败，请稍后重试。"}</p>}
    {(conversation.status === "open" || conversation.status === "human_handoff") &&
      <form className="panel-heading" action={`/api/admin/conversations/${conversation.id}/status`} method="post">
        {conversation.status === "open" && <button name="status" value="human_handoff">转人工</button>}
        <button name="status" value="resolved">标记已解决</button>
      </form>}
    {conversation.status === "processing" && <p>正在执行，请等待执行结束后再更新状态。</p>}
    <section className="panel" aria-label="退款审批"><div className="panel-heading"><h2>退款审批</h2></div>
      {approvals.length === 0 ? <p>暂无退款审批</p> : approvals.map(approval => <article className="execution" key={approval.id}>
        <p>订单：{approval.orderId} · 客户：{approval.customerId}</p>
        <p>Policy：{approval.reason}</p>
        <p>状态：{({ pending: "待审批", approved: "已批准并退款", rejected: "已拒绝", failed: "批准后执行失败" } as Record<string, string>)[approval.status]}</p>
        {approval.result && <p>退款结果：{approval.result}</p>}
        {approval.status === "pending" && <form action={`/api/admin/conversations/${conversation.id}/approvals`} method="post">
          <input type="hidden" name="approvalId" value={approval.id} />
          <button name="decision" value="approve">批准退款</button> <button name="decision" value="reject">拒绝退款</button>
        </form>}
      </article>)}
    </section>
    <div className="detail-grid">
      <section className="panel" aria-labelledby="messages-title"><div className="panel-heading"><div><h2 id="messages-title">消息记录</h2><p>默认显示最新 50 条</p></div></div>
        <MessageHistory conversationId={conversation.id} initialMessages={messages.messages} initialCursor={messages.nextCursor} />
      </section>
      <section className="panel" aria-labelledby="executions-title"><div className="panel-heading"><div><h2 id="executions-title">执行记录</h2><p>本页 {page.executions.length} 条 · 按时间从早到晚</p></div></div>
        {page.executions.length === 0 ? <Empty text="暂无执行记录" /> : <div className="execution-list">{page.executions.map((execution) => <article className="execution" key={execution.id}><div className="execution-heading"><span className={`status execution-${execution.status}`}>{executionLabels[execution.status]}</span><time dateTime={execution.createdAt.toISOString()}>{formatDate(execution.createdAt)}</time></div><dl><div><dt>工具结果</dt><dd>{formatResult(execution.toolResult)}</dd></div><div><dt>失败原因</dt><dd>{execution.errorCode ?? "—"}</dd></div><div><dt>完成时间</dt><dd>{execution.finishedAt ? formatDate(execution.finishedAt) : "—"}</dd></div></dl></article>)}</div>}
        <nav className="panel-heading" aria-label="执行记录分页">
          {executionPage > 1 ? <Link href={`/conversations/${conversation.id}?executionPage=${executionPage - 1}`}>上一页</Link> : <span />}
          <span>第 {executionPage} 页</span>
          {page.nextOffset !== null ? <Link href={`/conversations/${conversation.id}?executionPage=${executionPage + 1}`}>下一页</Link> : <span />}
        </nav>
      </section>
    </div>
  </main>;
}

async function loadConversation(conversationId: string, executionPage: number) {
  try {
    const service = getConversationService();
    const [conversation, messages, page] = await Promise.all([service.getHeader(conversationId), service.listMessages({ conversationId }), new PrismaExecutionReader(prisma).list(conversationId, (executionPage - 1) * 50)]);
    return { conversation, messages, page };
  } catch (error) { if (error instanceof ConversationNotFoundError) notFound(); throw error; }
}

function Empty({ text }: { text: string }) { return <div className="state-card compact"><span className="state-icon" aria-hidden="true">◎</span><p>{text}</p></div>; }
function formatResult(value: unknown): string { if (value === null || value === undefined) return "—"; return typeof value === "string" ? value : JSON.stringify(value, null, 2); }
function formatDate(date: Date): string { return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(date); }
