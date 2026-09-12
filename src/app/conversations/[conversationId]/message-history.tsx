"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { Message } from "@/modules/conversations";

interface MessageHistoryProps {
  conversationId: string;
  initialMessages: Message[];
  initialCursor: string | null;
}

export function MessageHistory({ conversationId, initialMessages, initialCursor }: MessageHistoryProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const previousHeight = useRef<number | null>(null);
  const initialized = useRef(false);

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
      setMessages((current) => [...page.data, ...current]);
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
        <div className="message-meta"><strong>{message.role === "customer" ? "客户" : message.role === "agent" ? "AI 客服" : "系统"}</strong><time dateTime={new Date(message.createdAt).toISOString()}>{formatDate(new Date(message.createdAt))}</time></div>
        <p>{message.content}</p>
      </article>)}
    </div>
  </>;
}

function EmptyMessages() { return <div className="state-card compact"><span className="state-icon" aria-hidden="true">◎</span><p>暂无消息记录</p></div>; }
function formatDate(date: Date): string { return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(date); }
