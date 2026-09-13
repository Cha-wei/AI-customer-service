import type { FormEvent } from "react";
import { QuickReplies } from "./quick-replies";

export function MessageComposer({ draft, sending, active, error, onChange, onSubmit }: {
  draft: string; sending: boolean; active: boolean; error: string;
  onChange: (value: string) => void; onSubmit: (event: FormEvent) => void;
}) {
  return <form className="chat-composer" onSubmit={onSubmit}>
    <p role="status">{active ? "人工接管中，AI 已暂停。客户消息将自动更新。" : "会话已结束或状态改变，不能继续回复。"}</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <QuickReplies disabled={sending || !active} onSelect={text => { onChange(text); document.getElementById("human-reply")?.focus(); }} />
    <label htmlFor="human-reply">人工回复</label>
    <textarea id="human-reply" placeholder="输入回复，与客户继续对话…" maxLength={10000} value={draft} disabled={sending || !active} onChange={event => onChange(event.target.value)} />
    <button disabled={sending || !active || !draft.trim()}>{sending ? "发送中…" : "发送人工回复"}<span className="send-arrow" aria-hidden="true">↑</span></button>
  </form>;
}
