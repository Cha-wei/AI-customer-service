"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Message } from "@/modules/conversations";

interface MessageHistoryProps {
  conversationId: string;
  initialMessages: Message[];
  initialCursor: string | null;
  initialStatus?: string;
}

export function MessageHistory({ conversationId, initialMessages, initialCursor, initialStatus }: MessageHistoryProps) {
  const [status, setStatus] = useState(initialStatus);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState("");
  const sendLock = useRef(false);
  const baseline = useRef<string | null>(null);
  const [messages, setMessages] = useState(initialMessages);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const previousHeight = useRef<number | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialStatus !== "human_handoff") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const response = await fetch(`/api/admin/conversations/${encodeURIComponent(conversationId)}/messages`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
        if (!response.ok || response.redirected) throw new Error();
        const page = await response.json();
        if (!cancelled) {
          setMessages(current => mergeMessages(current, page.data));
          setStatus(page.status);
          setError(false);
        }
      } catch { if (!cancelled) setError(true); }
      if (!cancelled) timer = setTimeout(refresh, 2500);
    }
    void refresh();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [conversationId, initialStatus]);

  async function reply(event: React.FormEvent) {
    event.preventDefault();
    if (sendLock.current || !draft.trim() || status !== "human_handoff") return;
    sendLock.current = true; setSending(true); setReplyError("");
    baseline.current ??= messages.at(-1)?.id ?? null;
    try {
      const response = await fetch(`/api/admin/conversations/${encodeURIComponent(conversationId)}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(15000), body: JSON.stringify({ content: draft, lastMessageId: baseline.current }) });
      if (response.redirected) throw new Error("管理员登录已失效，请重新登录。");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setMessages(current => mergeMessages(current, [result.message]));
      setDraft(""); baseline.current = null;
    } catch (error) { setReplyError(`${(error as Error).message} 请核对记录后编辑草稿再发送。`); }
    finally { sendLock.current = false; setSending(false); }
  }

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (!initialized.current) {
      list.scrollTop = list.scrollHeight;
      initialized.current = true;
    } else if (previousHeight.current !== null) {
      list.scrollTop += list.scrollHeight - previousHeight.current;
      previousHeight.current = null;
    }
  }, [messages]);

  async function loadEarlier() {
    if (!cursor || loading) return;
    setLoading(true);
    setError(false);
    const list = listRef.current;
    previousHeight.current = list?.scrollHeight ?? null;
    try {
      const response = await fetch(`/api/admin/conversations/${encodeURIComponent(conversationId)}/messages?before=${encodeURIComponent(cursor)}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const page = await response.json() as { data: Message[]; nextCursor: string | null };
      setMessages((current) => [...page.data.filter(message => !current.some(existing => existing.id === message.id)), ...current]);
      setCursor(page.nextCursor);
    } catch {
      previousHeight.current = null;
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (messages.length === 0) return <EmptyMessages />;
  return <>
    <div className="message-page-controls">
      {cursor ? <button className="secondary-button" disabled={loading} onClick={loadEarlier}>{loading ? "加载中…" : "加载更早消息"}</button> : <span>已到达最早消息</span>}
      {error && <span role="alert">加载失败，请重试。</span>}
    </div>
    <div className="message-list" ref={listRef}>
      {messages.map((message) => <article className={`message message-${message.role}`} key={message.id}>
        <div className="message-meta"><strong>{message.role === "customer" ? "客户" : message.role === "agent" ? "AI 客服" : message.role === "human" ? "人工客服" : "系统"}</strong><time dateTime={new Date(message.createdAt).toISOString()}>{formatDate(new Date(message.createdAt))}</time></div>
        <p>{message.content}</p>
      </article>)}
    </div>
    {initialStatus === "human_handoff" && <form className="chat-composer" onSubmit={reply}>
      <p role="status">{status === "human_handoff" ? "人工接管中，AI 已暂停。客户消息将自动更新。" : "会话已结束或状态改变，不能继续回复。"}</p>
      {replyError && <p className="form-error" role="alert">{replyError}</p>}
      <label htmlFor="human-reply">人工回复</label>
      <textarea id="human-reply" maxLength={10000} value={draft} disabled={sending || status !== "human_handoff"} onChange={event => { setDraft(event.target.value); baseline.current = null; }} />
      <button disabled={sending || status !== "human_handoff" || !draft.trim()}>{sending ? "发送中…" : "发送人工回复"}</button>
    </form>}
  </>;
}

function EmptyMessages() { return <div className="state-card compact"><span className="state-icon" aria-hidden="true">◎</span><p>暂无消息记录</p></div>; }
function formatDate(date: Date): string { return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(date); }

function mergeMessages(current: Message[], incoming: Message[]) {
  const byId = new Map(current.map(message => [message.id, message]));
  incoming.forEach(message => byId.set(message.id, message));
  return [...byId.values()].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
