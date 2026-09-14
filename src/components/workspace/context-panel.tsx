import { CustomerOrders } from "./customer-orders";
import type { Approval } from "@prisma/client";
import Link from "next/link";
import type { ExecutionPage, ExecutionRecord } from "@/modules/agent-runtime/execution-reader";
import type { ConversationHeader } from "@/modules/conversations/repository";
import { getCustomerContextProvider } from "@/modules/customer-context/composition-root";
import { activitySteps, ActivityTimeline, approvalStep } from "./ai-activity";
import { customerLabel, demoCustomerLabels, formatDate, statusLabels } from "./presentation";
import { AIStatus } from "./ai-status";
import type { InboxFilters } from "./conversation-list";

export async function ContextPanel({ conversation, page, executionPage, filters = {}, approvals = [], latestExecution }: { conversation: ConversationHeader; page: ExecutionPage; executionPage: number; filters?: InboxFilters; approvals?: Approval[]; latestExecution?: ExecutionRecord | null }) {
  const provider = getCustomerContextProvider();
  const [profile, orders] = await Promise.allSettled([provider.getCustomer(conversation.customerId), provider.listOrders(conversation.customerId)]);
  const customer = profile.status === "fulfilled" ? profile.value : null;
  const label = customerLabel(conversation.customerId, customer?.name);
  const latest = latestExecution === undefined ? page.executions.at(-1) : latestExecution;
  const matchingApproval = approvals.find(approval => approval.executionId === latest?.id);
  const steps = latest ? activitySteps(latest, matchingApproval) : [];
  if (matchingApproval) steps.push(approvalStep(matchingApproval));
  const pageHref = (target: number) => {
    const query = new URLSearchParams({ executionPage: String(target) });
    for (const key of ["query", "status", "page"] as const) if (filters[key]) query.set(key, filters[key]!);
    return `/conversations/${conversation.id}?${query}`;
  };
  return <div className="context-content">
    <section className="context-section"><h3>客户信息</h3><div className="context-customer"><span className="avatar">{label.name.slice(0, 1)}</span><div><strong>{label.name}</strong><small>客户编号 {label.code}</small></div></div>
      {demoCustomerLabels[conversation.customerId] && <span className="demo-label">演示客户</span>}
      <dl><dt>联系方式</dt><dd>{customer?.email || "暂无联系方式"}</dd><dt>客户等级</dt><dd>{customer ? ({ standard: "普通客户", premium: "优享客户", vip: "贵宾客户" }[customer.tier]) : "暂无资料"}</dd></dl>
    </section>

    <section className="context-section" aria-label="AI 协作"><h3>AI 协作</h3><AIStatus status={conversation.status} /><p className="context-next-action">{conversation.status === "waiting_approval" ? "待办：核对对话底部的退款申请，批准或拒绝。" : conversation.status === "human_handoff" ? "待办：核对处理记录，继续人工回复。" : conversation.status === "processing" ? "AI 正在执行，请等待结果；无需重复操作。" : conversation.status === "resolved" ? "本次服务已结束，无待处理操作。" : "AI 自动服务中，留意客户后续问题。"}</p>{latest ? <><p className="execution-scope">{latestExecution === undefined ? "本页最近执行" : "最近执行"} · {formatDate(latest.createdAt)}<br />执行记录随会话自动同步</p><ActivityTimeline steps={steps} /></> : <p className="muted">暂无执行记录</p>}<p className="muted">依据与引用 · 暂无已记录的知识来源</p></section>
    <CustomerOrders customerId={conversation.customerId} orders={orders.status === "fulfilled" ? orders.value : null} approvals={approvals} execution={latest} />
    <section className="context-section"><details><summary>会话详细信息</summary><dl><dt>状态</dt><dd><span className={`status status-${conversation.status}`}>{statusLabels[conversation.status]}</span></dd><dt>开始时间</dt><dd>{formatDate(conversation.createdAt)}</dd><dt>最近更新</dt><dd>{formatDate(conversation.updatedAt)}</dd><dt>会话编号</dt><dd className="mono">{conversation.id}</dd></dl></details></section>
    <section className="context-section"><h3>执行记录</h3><p className="muted">第 {executionPage} 页 · {page.executions.length} 条</p>{page.executions.map(execution => <details className="execution-detail" key={execution.id}><summary>{({ running: "执行中", completed: "已完成", failed: "失败" })[execution.status]}<time>{formatDate(execution.createdAt)}</time></summary><dl><dt>工具结果</dt><dd className="mono">{execution.toolResult == null ? "暂无工具结果" : typeof execution.toolResult === "string" ? execution.toolResult : JSON.stringify(execution.toolResult, null, 2)}</dd>{execution.errorCode && <><dt>失败代码</dt><dd>{execution.errorCode}</dd></>}</dl></details>)}
      <nav className="queue-pagination" aria-label="执行记录分页">{executionPage > 1 ? <Link href={pageHref(executionPage - 1)}>上一页</Link> : <span />}<span>{executionPage}</span>{page.nextOffset !== null ? <Link href={pageHref(executionPage + 1)}>下一页</Link> : <span />}</nav>
    </section>
  </div>;
}
