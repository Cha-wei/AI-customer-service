"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Message = { id: string; role: string; content: string };
type History = { id: string; status: string; messages: Message[]; nextCursor: string | null };
type Inbox = { conversations: { id: string; latestMessage: Message | null }[]; orders: { id: string; label: string }[]; page: number; pageSize: number; total: number };
const statuses: Record<string, string> = { open: "可以继续提问", processing: "正在处理", waiting_approval: "等待人工审批，结果将自动更新", human_handoff: "已转交人工客服", resolved: "会话已解决" };
async function api(path: string, options?: RequestInit) {
  const response = await fetch(`/api/chat${path}`, { ...options, cache: "no-store", signal: AbortSignal.timeout(45000) });
  if (response.status === 401) throw new Error("客户登录已失效，请从已登录的客户入口重新进入。");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? "服务暂不可用，请重试。");
  return data;
}

export default function ChatClient() {
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [orderId, setOrderId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const generation = useRef(0);
  const sending = useRef(false);
  const pageRef = useRef(1);
  const refund = /退款|refund/i.test(content) && !/人工|human/i.test(content);
  const refreshInbox = useCallback(async (page = pageRef.current) => {
    const data = await api(`?page=${page}`);
    pageRef.current = data.page;
    setInbox(data);
  }, []);
  useEffect(() => { refreshInbox().catch(e => setError(e.message)); }, [refreshInbox]);
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const data: History = await api(`?id=${encodeURIComponent(selected)}`);
        if (!cancelled) setHistory(previous => {
          if (!previous || previous.id !== data.id) return data;
          const merged = new Map(previous.messages.map(m => [m.id, m]));
          data.messages.forEach(m => merged.set(m.id, m));
          return { ...data, messages: [...merged.values()], nextCursor: previous.nextCursor };
        });
      } catch (e) { if (!cancelled) setError((e as Error).message); }
      if (!cancelled) timer = setTimeout(refresh, 2500);
    };
    void refresh();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [selected]);
  function select(id: string | null) {
    generation.current++;
    setSelected(id); setHistory(null); setError(""); setContent(""); setOrderId("");
  }
  async function older() {
    if (!history?.nextCursor) return;
    const current = generation.current;
    setLoadingOlder(true);
    try {
      const data: History = await api(`?id=${encodeURIComponent(history.id)}&before=${encodeURIComponent(history.nextCursor)}`);
      if (current === generation.current) setHistory(previous => previous && ({ ...previous, messages: [...data.messages.filter(m => !previous.messages.some(p => p.id === m.id)), ...previous.messages], nextCursor: data.nextCursor }));
    } catch (e) { setError((e as Error).message); }
    finally { setLoadingOlder(false); }
  }
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (sending.current || !content.trim() || (refund && !orderId)) return;
    sending.current = true; setBusy(true); setError("");
    try {
      const result = await api("", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...(selected ? { conversationId: selected } : {}), content, ...(refund ? { orderId } : {}) }) });
      setSelected(result.id); setContent(""); setOrderId("");
      if (result.warning) setError(result.warning);
      const data = await api(`?id=${encodeURIComponent(result.id)}`);
      setHistory(data);
      await refreshInbox();
    } catch (e) { setError(`${(e as Error).message} 如发送结果不确定，请先刷新历史确认，避免重复申请。`); }
    finally { sending.current = false; setBusy(false); }
  }
  const locked = busy || !inbox || (!!selected && (!history || history.status !== "open" || history.messages.at(-1)?.role === "customer"));
  return <div className="chat-grid"><aside className="panel chat-sidebar"><h2>我的会话</h2><button disabled={busy} onClick={() => select(null)}>新建会话</button>
    {!inbox && <p>正在加载客户会话…</p>}
    {inbox?.conversations.length === 0 && <p className="muted">还没有会话，发送消息开始咨询。</p>}
    {inbox?.conversations.map(c => <button className="chat-conversation secondary-button" aria-pressed={selected === c.id} disabled={busy} key={c.id} onClick={() => select(c.id)}>{c.latestMessage?.content ?? "客服会话"}</button>)}
    {inbox && <nav aria-label="会话分页"><button className="secondary-button" disabled={busy || inbox.page <= 1} onClick={() => refreshInbox(inbox.page - 1).catch(e => setError(e.message))}>上一页</button><span> {inbox.page} </span><button className="secondary-button" disabled={busy || inbox.page * inbox.pageSize >= inbox.total} onClick={() => refreshInbox(inbox.page + 1).catch(e => setError(e.message))}>下一页</button></nav>}
  </aside><section className="panel"><div className="panel-heading"><h2>客服消息</h2><span role="status">{history ? statuses[history.status] : selected ? "正在加载历史…" : "新的咨询"}</span></div>
    {error && <div className="form-error" role="alert">{error} <button className="secondary-button" onClick={() => { setError(""); refreshInbox().catch(e => setError(e.message)); }}>重新加载</button></div>}
    <div className="message-list chat-messages" aria-label="消息历史" aria-live="polite">{history?.nextCursor && <button disabled={loadingOlder} className="secondary-button" onClick={older}>{loadingOlder ? "加载中…" : "加载更早消息"}</button>}
      {!selected && <p className="muted">您好！可以询问订单物流，或选择订单申请退款。</p>}
      {history?.messages.map(m => <article key={m.id} className={`message message-${m.role}`}><div className="message-meta">{m.role === "customer" ? "我" : m.role === "agent" ? "客服" : "服务通知"}</div><p>{m.content}</p></article>)}
    </div><form className="chat-composer" onSubmit={send}><div><button type="button" className="secondary-button" disabled={locked} onClick={() => setContent("我的订单什么时候到？")}>查询订单</button> <button type="button" className="secondary-button" disabled={locked} onClick={() => setContent("申请退款")}>申请退款</button></div>
      <label htmlFor="chat-message">消息</label><textarea id="chat-message" maxLength={10000} value={content} disabled={locked} onChange={e => setContent(e.target.value)} placeholder="请输入您的问题" />
      {refund && <><label htmlFor="refund-order">请选择退款订单（必选）</label><select id="refund-order" disabled={locked} value={orderId} onChange={e => setOrderId(e.target.value)}><option value="">请选择订单</option>{inbox?.orders.map(o => <option key={o.id} value={o.id}>{o.id} · {o.label}</option>)}</select>{!inbox?.orders.length && <p>暂无可申请退款的订单。</p>}<p className="muted">提交后需人工审批，当前为模拟退款。</p></>}
      <button disabled={locked || !content.trim() || (refund && !orderId)}>{busy ? "发送中…" : "发送消息"}</button>
    </form></section></div>;
}
