import { getConversationService } from "../conversations/composition-root";
import { getOrderQueryTool } from "../tools";
import { CustomerServiceRuntime, RuleIntentProvider, type AgentRuntime } from "./runtime";

let runtime: AgentRuntime | undefined;
export function getAgentRuntime(): AgentRuntime {
  return runtime ??= new CustomerServiceRuntime(
    getConversationService(), new RuleIntentProvider(), { orderQuery: getOrderQueryTool() },
  );
}
