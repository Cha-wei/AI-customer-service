export interface PolicyEngine {
  evaluate(action: string): { decision: "allow" | "approval" | "handoff"; reason: string };
}

export class RulePolicyEngine implements PolicyEngine {
  evaluate(action: string): ReturnType<PolicyEngine["evaluate"]> {
    if (action === "refund") return { decision: "approval", reason: "退款属于高风险操作，必须由人工审批。" };
    if (action === "query_customer_orders") return { decision: "allow", reason: "只读查询。" };
    return { decision: "handoff", reason: "未知操作交由人工处理。" };
  }
}
