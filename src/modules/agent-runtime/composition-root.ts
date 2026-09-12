import { getConversationService } from "../conversations/composition-root";
import { getOrderQueryTool } from "../tools";
import { prisma } from "@/lib/prisma";
import { PrismaExecutionStore } from "./prisma-execution-store";
import { CustomerServiceRuntime, type AgentRuntime } from "./runtime";
import { createIntentProvider } from "./intent-composition";

let runtime: AgentRuntime | undefined;
export function getAgentRuntime(): AgentRuntime {
  return runtime ??= new CustomerServiceRuntime(
    getConversationService(), createIntentProvider(), { orderQuery: getOrderQueryTool() },
    new PrismaExecutionStore(prisma),
  );
}
