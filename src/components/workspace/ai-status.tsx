const states: Record<string, { title: string; detail: string }> = {
  open: { title: "AI 客服", detail: "自动服务中 · 需要时可转交人工" },
  processing: { title: "AI 正在处理", detail: "正在处理客户请求，请稍候" },
  waiting_approval: { title: "等待人工审批", detail: "请核对退款申请，再决定是否执行" },
  human_handoff: { title: "人工接管中", detail: "AI 已暂停 · 由客服继续回复" },
  resolved: { title: "会话已解决", detail: "本次服务已结束，消息保留供查阅" },
};

export function AIStatus({ status }: { status: string }) {
  const state = states[status];
  if (!state) return null;
  return <div className={`ai-status ai-status-${status}`} role="status"><span className="ai-status-symbol" aria-hidden="true">{status === "resolved" ? "✓" : "✦"}</span><div><strong>{state.title}</strong><span>{state.detail}</span></div>{status === "processing" && <span className="processing-dot" aria-hidden="true" />}</div>;
}
