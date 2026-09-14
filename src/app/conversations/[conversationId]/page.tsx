import { ConversationHeader } from "@/components/workspace/conversation-header";
import { WorkspaceLayout } from "@/components/workspace/workspace-layout";
import { ConversationList } from "@/components/workspace/conversation-list";
import { ContextPanel } from "@/components/workspace/context-panel";
import { statusLabels } from "@/components/workspace/presentation";
import { readMessageActivity } from "@/components/workspace/workspace-data";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/modules/admin-auth";
import { PrismaExecutionReader } from "@/modules/agent-runtime/prisma-execution-reader";
import { ConversationNotFoundError } from "@/modules/conversations";
import { getConversationService } from "@/modules/conversations/composition-root";
import { MessageHistory } from "./message-history";
import { getApprovalService } from "@/modules/approvals/composition-root";

export const dynamic = "force-dynamic";

export default async function ConversationDetail({ params, searchParams }: { params: Promise<{ conversationId: string }>; searchParams?: Promise<{ notice?: string; executionPage?: string; query?: string; status?: string; page?: string }> }) {
  await requireAdminSession();
  const { conversationId } = await params;
  const filters = await searchParams;
  const requestedExecutionPage = /^\d+$/.test(filters?.executionPage ?? "") ? Number(filters?.executionPage) : 1;
  const executionPage = Number.isSafeInteger(requestedExecutionPage) && requestedExecutionPage > 0 && requestedExecutionPage <= 20_001 ? requestedExecutionPage : 1;
  const { conversation, messages, page } = await loadConversation(conversationId, executionPage);
  if (executionPage > 1 && page.executions.length === 0) redirect(`/conversations/${encodeURIComponent(conversationId)}`);
  const notice = filters?.notice;
  const approvals = await getApprovalService().list(conversation.id, conversation.customerId);
  const activity = await readMessageActivity(conversation.id, messages.messages.map(message => message.id));

  const inbox = await ConversationList({ filters, selectedId: conversation.id });
  const context = await ContextPanel({ conversation, page, executionPage, filters });
  return <WorkspaceLayout inbox={inbox} context={context} filter={filters?.status}>

    <ConversationHeader customerId={conversation.customerId} createdAt={conversation.createdAt} status={conversation.status} statusLabel={statusLabels[conversation.status] ?? conversation.status}>

      {(conversation.status === "open" || conversation.status === "human_handoff") &&
        <form className="conversation-actions" action={`/api/admin/conversations/${conversation.id}/status`} method="post">
          {conversation.status === "open" && <button name="status" value="human_handoff">转人工</button>}
          <button name="status" value="resolved">标记已解决</button>
        </form>}
    </ConversationHeader>
    {conversation.status === "processing" && <p className="workspace-notice">正在执行，请等待执行结束后再更新状态。</p>}
    {notice && <p className="workspace-notice" role="alert">{notice === "conflict" ? "会话状态已改变或正在执行，请刷新后重试。" : "更新失败，请稍后重试。"}</p>}
    {approvals.length > 0 && <section className="approval-panel" aria-label="退款审批"><div className="panel-heading"><h2>退款审批</h2></div>
      {approvals.map(approval => <article className="execution" key={approval.id}>
        <p>订单：{approval.orderId} · 客户：{approval.customerId}</p>
        <p>审批原因：{approval.reason}</p>
        <p>状态：{({ pending: "待审批", approved: "已批准并退款", rejected: "已拒绝", failed: "批准后执行失败" } as Record<string, string>)[approval.status]}</p>
        {approval.result && <p>退款结果：{approval.result}</p>}
        {approval.status === "pending" && <form action={`/api/admin/conversations/${conversation.id}/approvals`} method="post">
          <input type="hidden" name="approvalId" value={approval.id} />
          <button name="decision" value="approve">批准退款</button> <button name="decision" value="reject">拒绝退款</button>
        </form>}
      </article>)}
    </section>}
    <div className="conversation-thread">
      <section className="thread-panel" aria-label="消息记录">
        <MessageHistory key={`${conversation.id}:${conversation.status}`} initialStatus={conversation.status} conversationId={conversation.id} initialMessages={messages.messages} initialCursor={messages.nextCursor} executions={activity} approvals={approvals.map(({ executionId, orderId }) => ({ executionId, orderId }))} />
      </section>

    </div>
  </WorkspaceLayout>;
}

async function loadConversation(conversationId: string, executionPage: number) {
  try {
    const service = getConversationService();
    const [conversation, messages, page] = await Promise.all([service.getHeader(conversationId), service.listMessages({ conversationId }), new PrismaExecutionReader(prisma).list(conversationId, (executionPage - 1) * 50)]);
    return { conversation, messages, page };
  } catch (error) { if (error instanceof ConversationNotFoundError) notFound(); throw error; }
}
