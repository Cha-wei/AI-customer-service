import { getConversationService } from "../conversations/composition-root";
import { getOrderQueryTool } from "../tools";
import { prisma } from "@/lib/prisma";
import { PrismaExecutionStore } from "./prisma-execution-store";
import { CustomerServiceRuntime, RuleIntentProvider, type AgentRuntime } from "./runtime";

let runtime: AgentRuntime | undefined;
export function getAgentRuntime(): AgentRuntime {
  return runtime ??= new CustomerServiceRuntime(
    getConversationService(), new RuleIntentProvider(), { orderQuery: getOrderQueryTool() },
    new PrismaExecutionStore(prisma),
  );
}
