import { render, screen } from "@testing-library/react";
import type { Approval } from "@prisma/client";
import type { ExecutionRecord } from "@/modules/agent-runtime/execution-reader";
import { MOCK_ORDERS } from "@/modules/customer-context/mock-data";
import { CustomerOrders, relatedOrderIds } from "./customer-orders";
const approval = { id: "a", conversationId: "c", customerId: "customer-1", orderId: "order-1001", executionId: "e", status: "pending", reason: "需要人工审批", result: null, createdAt: new Date(), decidedAt: null } as Approval;
const execution = { id: "e", toolResult: { toolName: "query_customer_orders", ok: true, data: { orders: MOCK_ORDERS } } } as ExecutionRecord;
it("does not guess an order from customer ownership or malformed/failed tool output", () => {
  expect(relatedOrderIds("customer-1", []).size).toBe(0);
  expect(relatedOrderIds("customer-1", [], { ...execution, toolResult: { toolName: "query_customer_orders", ok: false, data: { orders: MOCK_ORDERS } } }).size).toBe(0);
  expect(relatedOrderIds("customer-2", [approval], execution).size).toBe(0);
});
it("labels multiple query results honestly and prioritizes pending approvals", () => {
  const result = relatedOrderIds("customer-1", [approval, { ...approval, status: "rejected" }], execution);
  expect(result.get("order-1001")).toBe("待审批订单");
  expect(result.get("order-1002")).toContain("非客户选定");
});
it("groups logistics and refund records and folds unrelated orders", () => {
  render(<CustomerOrders customerId="customer-1" orders={[...MOCK_ORDERS]} approvals={[approval]} />);
  expect(screen.getByText("MOCK1001")).toBeVisible();
  expect(screen.getByText("等待人工审批")).toBeVisible();
  expect(screen.getByText("MOCK1002")).not.toBeVisible();
  expect(screen.getByText("其他客户订单 · 1")).toBeVisible();
});
it("preserves failed refund evidence when the order provider is unavailable", () => {
  render(<CustomerOrders customerId="customer-1" orders={null} approvals={[{ ...approval, status: "failed", result: "Mock 退款失败" }]} />);
  expect(screen.getByText("退款执行失败")).toBeVisible();
  expect(screen.getByText("Mock 退款失败")).toBeVisible();
  expect(screen.getByText("订单资料暂不可用")).toBeVisible();
});
