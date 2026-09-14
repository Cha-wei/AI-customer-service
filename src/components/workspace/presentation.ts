import type { ConversationStatus } from "@/modules/conversations/domain";

export const statusLabels: Record<ConversationStatus, string> = {
  open: "待处理", processing: "处理中", waiting_approval: "待审批", human_handoff: "人工接管", resolved: "已解决",
};
// Display aliases for existing demo identities; never used for authorization or writes.
export const demoCustomerLabels: Record<string, { name: string; code: string }> = {
  "customer-1": { name: "陈雨", code: "C-1001" },
  "customer-2": { name: "王先生", code: "C-1002" },
};
export function customerLabel(id: string, name?: string) {
  return demoCustomerLabels[id] ?? { name: name || "未命名客户", code: id };
}
export function resolveDisplayQuery(query: string) {
  const matches = Object.entries(demoCustomerLabels).filter(([, value]) => value.name.includes(query) || value.code.toLowerCase() === query.toLowerCase());
  return query && matches.length === 1 ? matches[0][0] : query;
}
export function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}
export function relativeTime(value: Date | string, now: number) {
  const minutes = Math.max(0, Math.floor((now - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} 小时前`;
  if (minutes < 10080) return `${Math.floor(minutes / 1440)} 天前`;
  return formatDate(value);
}
