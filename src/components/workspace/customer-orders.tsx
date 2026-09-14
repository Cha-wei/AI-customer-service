import type { Approval } from "@prisma/client";
import type { Order } from "@/modules/customer-context/domain";
import type { ExecutionRecord } from "@/modules/agent-runtime/execution-reader";
import { approvalStep } from "./ai-activity";
import { formatDate } from "./presentation";

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function relatedOrderIds(customerId: string, approvals: Approval[], execution?: ExecutionRecord | null) {
  const reasons = new Map<string, string>();
  const tool = record(execution?.toolResult);
  const data = record(tool?.data);
  if (tool?.toolName === "query_customer_orders" && tool.ok === true && Array.isArray(data?.orders)) {
    for (const value of data.orders) {
      const order = record(value);
      if (order?.customerId === customerId && typeof order.id === "string") reasons.set(order.id, "最近查询结果 · 非客户选定");
    }
  }
  for (const approval of approvals) {
    if (approval.customerId !== customerId) continue;
    if (approval.executionId === execution?.id) reasons.set(approval.orderId, "最近执行关联的退款申请");

  }
  for (const approval of approvals) if (approval.customerId === customerId && approval.status === "pending") reasons.set(approval.orderId, "待审批订单");
  return reasons;
}

export function CustomerOrders({ customerId, orders, approvals, execution }: { customerId: string; orders: Order[] | null; approvals: Approval[]; execution?: ExecutionRecord | null }) {
  const ownApprovals = approvals.filter(item => item.customerId === customerId);
  const reasons = relatedOrderIds(customerId, ownApprovals, execution);
  const ownOrders = (orders ?? []).filter(order => order.customerId === customerId);
  const related = ownOrders.filter(order => reasons.has(order.id)).sort((a, b) => Number(reasons.get(b.id) === "待审批订单") - Number(reasons.get(a.id) === "待审批订单"));
  const others = ownOrders.filter(order => !reasons.has(order.id));
  const missing = [...new Set(ownApprovals.map(item => item.orderId))].filter(id => !ownOrders.some(order => order.id === id));
  const renderOrder = (order: Order) => <OrderDetails key={order.id} order={order} reason={reasons.get(order.id)} approvals={ownApprovals.filter(item => item.orderId === order.id)} />;
  return <section className="context-section customer-orders" aria-label="订单与退款"><h3>订单与退款</h3>
    {orders === null ? <p className="muted">暂时无法读取订单，审批记录仍可查阅。</p> : ownOrders.length === 0 ? <p className="muted">暂无关联订单</p> : related.length === 0 ? <p className="muted">暂无明确关联订单，请展开客户订单核对。</p> : related.map(renderOrder)}
    {missing.map(id => <article className="order-detail" key={id}><strong>{id}</strong><p className="muted">订单资料暂不可用</p><OrderApprovals approvals={ownApprovals.filter(item => item.orderId === id)} /></article>)}
    {others.length > 0 && <details className="other-orders"><summary>{related.length ? "其他客户订单" : "客户订单"} · {others.length}</summary>{others.map(renderOrder)}</details>}
  </section>;
}

function OrderDetails({ order, reason, approvals }: { order: Order; reason?: string; approvals: Approval[] }) {
  const logistics = order.logistics;
  return <article className="order-detail" aria-label={`订单 ${order.id}`}>
    <header><strong>{order.id}</strong><span>{({ processing: "处理中", shipped: "已发货", delivered: "已送达", cancelled: "已取消" })[order.status]}</span></header>
    {reason && <p className="order-reason">{reason}</p>}
    <p className="order-items">{order.items.map(item => `${item.name} × ${item.quantity}`).join("、")}</p>
    <dl><dt>物流</dt><dd>{({ not_shipped: "未发货", in_transit: "运输中", out_for_delivery: "派送中", delivered: "已签收", exception: "物流异常" })[logistics.status]}</dd><dt>承运商</dt><dd>{logistics.carrier || "暂无"}</dd><dt>运单号</dt><dd className="mono">{logistics.trackingNumber || "暂无"}</dd>{logistics.estimatedDeliveryAt && logistics.status !== "delivered" && <><dt>预计送达</dt><dd>{formatDate(logistics.estimatedDeliveryAt)}</dd></>}<dt>物流更新</dt><dd>{formatDate(logistics.updatedAt)}</dd></dl>
    <OrderApprovals approvals={approvals} />
  </article>;
}
function OrderApprovals({ approvals }: { approvals: Approval[] }) {
  if (!approvals.length) return <p className="order-no-refund">本会话暂无退款申请</p>;
  return <div className="order-approvals">{approvals.map(approval => <div key={approval.id} className={`order-approval activity-${approvalStep(approval).state}`}><strong>{approvalStep(approval).label}</strong><p>{approval.reason}</p>{approval.result && <p>{approval.result}</p>}<small>{approval.decidedAt ? "处理于" : "申请于"} {formatDate(approval.decidedAt ?? approval.createdAt)}</small>{approval.status === "pending" && <p>请在对话底部核对并处理审批</p>}</div>)}</div>;
}
