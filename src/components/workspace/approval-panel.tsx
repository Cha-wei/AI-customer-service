import type { Approval } from "@prisma/client";
import { Button } from "@/components/ui/button";

export function ApprovalPanel({ approvals, conversationId }: { approvals: Approval[]; conversationId: string }) {
  return approvals.length > 0 && <section className="approval-panel" aria-label="退款审批"><div className="panel-heading"><h2>退款审批</h2></div>
      {approvals.map(approval => <article className="execution" key={approval.id}>
        <p>订单：{approval.orderId} · 客户：{approval.customerId}</p>
        <p>审批原因：{approval.reason}</p>
        <p>状态：{({ pending: "待审批", approved: "已批准并退款", rejected: "已拒绝", failed: "批准后执行失败" } as Record<string, string>)[approval.status]}</p>
        {approval.result && <p>退款结果：{approval.result}</p>}
        {approval.status === "pending" && <form action={`/api/admin/conversations/${conversationId}/approvals`} method="post">
          <input type="hidden" name="approvalId" value={approval.id} />
          <Button size="sm" name="decision" value="approve">批准退款</Button> <Button size="sm" variant="outline" name="decision" value="reject">拒绝退款</Button>
        </form>}
      </article>)}
    </section>;
}
