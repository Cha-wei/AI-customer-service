import { activitySteps, approvalStep } from "./ai-activity";
import type { ExecutionRecord } from "@/modules/agent-runtime/execution-reader";

const execution: ExecutionRecord = { id: "e", conversationId: "c", messageId: "m", status: "completed", toolResult: null, errorCode: null, createdAt: new Date(), finishedAt: new Date() };

it("does not invent tools or intent recognition from a completed execution", () => {
  expect(activitySteps(execution)).toEqual([{ label: "生成客户回复", detail: "回复已写入会话记录", state: "done" }]);
});
it("distinguishes an empty order result from an unsuccessful tool call", () => {
  const empty = activitySteps({ ...execution, toolResult: { ok: true, toolName: "query_customer_orders", data: { orders: [] } } });
  expect(empty[0]).toMatchObject({ label: "查询订单", detail: "未找到匹配订单", state: "warning" });
  const failure = activitySteps({ ...execution, toolResult: { ok: false, toolName: "query_customer_orders" } });
  expect(failure[0].detail).toBe("查询未成功，请人工核实");
});
it("does not claim a generated reply or successful query for running or malformed records", () => {
  expect(activitySteps({ ...execution, status: "running", toolResult: { toolName: "query_customer_orders", ok: true, data: "bad" } })).toEqual([{ label: "处理请求", detail: "执行记录尚未完成，可刷新查看结果", state: "pending" }]);
});
it("only shows an approval action when the approval references this execution", () => {
  expect(activitySteps(execution, { executionId: "other", orderId: "o" })).toHaveLength(1);
  expect(activitySteps(execution, { executionId: "e", orderId: "order-1001" })[0]).toMatchObject({ label: "提交退款审批", state: "done" });
});

it("keeps approval decisions distinct from refund execution success", () => {
  expect(approvalStep({ status: "pending", orderId: "o" })).toMatchObject({ state: "pending", detail: "订单 o 尚未执行退款" });
  expect(approvalStep({ status: "failed", orderId: "o" })).toMatchObject({ state: "warning", label: "退款执行失败" });
  expect(approvalStep({ status: "rejected", orderId: "o" }).detail).toContain("未执行退款");
  expect(approvalStep({ status: "approved", orderId: "o" }).state).toBe("done");
  expect(approvalStep({ status: "unknown", orderId: "o" }).state).toBe("warning");
});
