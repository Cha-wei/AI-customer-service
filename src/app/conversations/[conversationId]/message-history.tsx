"use client";

import { type ReactNode, Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { MessageBubble } from "@/components/workspace/message-bubble";
import { AIStatus } from "@/components/workspace/ai-status";
import { MessageComposer } from "@/components/workspace/message-composer";
import { AIActivity, type ActivityApproval } from "@/components/workspace/ai-activity";
import type { ExecutionRecord } from "@/modules/agent-runtime/execution-reader";
import type { Message } from "@/modules/conversations";

interface MessageHistoryProps {
  approvalPanel?: ReactNode;
  conversationId: string;
  initialMessages: Message[];
  initialCursor: string | null;
  initialStatus?: string;
  executions?: ExecutionRecord[];
  approvals?: ActivityApproval[];
}

export function MessageHistory({ approvalPanel, conversationId, initialMessages, initialCursor, initialStatus, executions = [], approvals = [] }: MessageHistoryProps) {
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
  const followLatest = useRef(true);

  // RSC refreshes merge messages without resetting drafts or older loaded pages.
  const [serverSnapshot, setServerSnapshot] = useState({ initialMessages, initialStatus });
  if (serverSnapshot.initialMessages !== initialMessages || serverSnapshot.initialStatus !== initialStatus) {
    setServerSnapshot({ initialMessages, initialStatus });
    setMessages(current => mergeMessages(current, initialMessages));
    setStatus(initialStatus);
  }

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
      followLatest.current = true;
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
    } else if (followLatest.current) list.scrollTop = list.scrollHeight;
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


  return <>
    <AIStatus status={status ?? ""} />
    <div className="message-page-controls">
      {cursor ? <button className="secondary-button" disabled={loading} onClick={loadEarlier}>{loading ? "加载中…" : "加载更早消息"}</button> : <span>已到达最早消息</span>}
      <button className="secondary-button" onClick={() => { followLatest.current = true; if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }}>查看最新消息</button>
      {error && <span role="alert">加载失败，请重试。</span>}
    </div>
    <div className="message-list" ref={listRef} onScroll={event => { const list = event.currentTarget; followLatest.current = list.scrollHeight - list.scrollTop - list.clientHeight < 40; }}>
      <div className="message-stream">{messages.length === 0 ? <EmptyMessages /> : messages.map(message => <Fragment key={message.id}><MessageBubble message={message} />{executions.filter(execution => execution.messageId === message.id).map(execution => <AIActivity key={execution.id} execution={execution} approval={approvals.find(approval => approval.executionId === execution.id)} />)}</Fragment>)}</div>
    </div>
    {approvalPanel}
    {(status === "human_handoff" || draft.length > 0) && <MessageComposer draft={draft} sending={sending} active={status === "human_handoff"} error={replyError} onChange={value => { setDraft(value); baseline.current = null; }} onSubmit={reply} />}
    {status !== "human_handoff" && draft.length === 0 && <div className="composer-idle"><span className="ai-badge" aria-hidden="true">AI</span><p>{status === "resolved" ? "会话已结束，消息记录已保留" : status === "waiting_approval" ? "请先处理上方的退款审批" : "AI 正在负责此会话，转人工后可发送回复"}</p><span className="idle-send" aria-hidden="true">↑</span></div>}
  </>;
}

function EmptyMessages() { return <div className="state-card compact"><span className="state-icon" aria-hidden="true">◎</span><p>暂无消息记录</p></div>; }

function mergeMessages(current: Message[], incoming: Message[]) {
  const byId = new Map(current.map(message => [message.id, message]));
  incoming.forEach(message => byId.set(message.id, message));
  return [...byId.values()].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
