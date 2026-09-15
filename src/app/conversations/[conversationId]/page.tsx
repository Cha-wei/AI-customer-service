import { readWorkspaceSnapshot } from "@/components/workspace/workspace-snapshot";
import { WorkspaceSync } from "@/components/workspace/workspace-sync";
import { ApprovalPanel } from "@/components/workspace/approval-panel";
import { Button } from "@/components/ui/button";
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
import { CustomerConsultations, type ConsultationFilters } from "@/components/workspace/customer-consultations";

export const dynamic = "force-dynamic";

export default async function ConversationDetail({ params, searchParams }: { params: Promise<{ conversationId: string }>; searchParams?: Promise<ConsultationFilters & { notice?: string; executionPage?: string }> }) {
  await requireAdminSession();
  const { conversationId } = await params;
  const filters = await searchParams;
  const requestedExecutionPage = /^\d+$/.test(filters?.executionPage ?? "") ? Number(filters?.executionPage) : 1;
  const executionPage = Number.isSafeInteger(requestedExecutionPage) && requestedExecutionPage > 0 && requestedExecutionPage <= 20_001 ? requestedExecutionPage : 1;
  // Capture the revision first: changes during rendering must trigger another sync.
  const snapshot = await readWorkspaceSnapshot(conversationId).catch(error => { if (error instanceof ConversationNotFoundError) notFound(); throw error; });
  const { conversation, messages, page } = await loadConversation(conversationId, executionPage);
  if (executionPage > 1 && page.executions.length === 0) redirect(`/conversations/${encodeURIComponent(conversationId)}`);
  const notice = filters?.notice;
  const approvals = await getApprovalService().list(conversation.id, conversation.customerId);
  const activity = await readMessageActivity(conversation.id, messages.messages.map(message => message.id));

  const inbox = await ConversationList({ filters, selectedId: conversation.id, selectedCustomerId: conversation.customerId });
  const consultations = await CustomerConsultations({ customerId: conversation.customerId, conversationId, status: conversation.status, filters });
  const context = await ContextPanel({ conversation, page, executionPage, filters, approvals, latestExecution: snapshot.latestExecution });
  return <WorkspaceLayout inbox={inbox} context={context} filter={filters?.status}>

    <WorkspaceSync conversationId={conversationId} revision={snapshot.revision} />
    <ConversationHeader customerId={conversation.customerId} createdAt={conversation.createdAt} status={conversation.status} statusLabel={statusLabels[conversation.status] ?? conversation.status}>

      {(conversation.status === "open" || conversation.status === "human_handoff") &&
        <form className="conversation-actions" action={`/api/admin/conversations/${conversation.id}/status`} method="post">
          {conversation.status === "open" && <Button size="sm" variant="outline" name="status" value="human_handoff">转人工</Button>}
          <Button size="sm" variant="outline" name="status" value="resolved">标记已解决</Button>
        </form>}
    </ConversationHeader>
    {consultations}
    {conversation.status === "processing" && <p className="workspace-notice">正在执行，请等待执行结束后再更新状态。</p>}
    {notice && <p className="workspace-notice" role="alert">{notice === "conflict" ? "会话状态已改变或正在执行，请刷新后重试。" : "更新失败，请稍后重试。"}</p>}
    <div className="conversation-thread">
      <section className="thread-panel" aria-label="消息记录">
        <MessageHistory key={conversation.id} approvalPanel={<ApprovalPanel approvals={approvals} conversationId={conversation.id} />} initialStatus={conversation.status} conversationId={conversation.id} initialMessages={messages.messages} initialCursor={messages.nextCursor} executions={activity} approvals={approvals.map(({ executionId, orderId }) => ({ executionId, orderId }))} />
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
