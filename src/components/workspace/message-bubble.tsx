import type { Message } from "@/modules/conversations";

export function MessageBubble({ message }: { message: Message }) {
  const label = { customer: "客户", agent: "AI 客服", human: "人工客服", system: "系统" }[message.role];
  return <article className={`message message-${message.role}`}>
    <span className="message-avatar" aria-hidden="true">{message.role === "agent" ? "✦" : message.role === "customer" ? "客" : message.role === "human" ? "A" : "·"}</span>
    <div className="message-body"><div className="message-meta"><strong>{label}</strong><time dateTime={new Date(message.createdAt).toISOString()}>{new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(message.createdAt))}</time></div><p>{message.content}</p></div>
  </article>;
}
