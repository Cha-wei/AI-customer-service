import { prisma } from "@/lib/prisma";
import { getCustomerContextProvider } from "../customer-context";
import { RulePolicyEngine } from "../policy";
import { MockRefundTool } from "../tools/mock-refund-tool";
import { ApprovalService } from "./service";

export function getApprovalService() {
  const context = getCustomerContextProvider();
  return new ApprovalService(prisma, context, new RulePolicyEngine(), new MockRefundTool(context));
}
