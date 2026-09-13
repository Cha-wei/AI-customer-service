import ChatClient from "./chat-client";

export default function ChatPage() {
  return <main className="shell chat-shell"><header className="topbar"><div><p className="eyebrow">Customer Support</p><h1>在线客服</h1><p className="muted">查询订单，申请退款，随时查看处理进度。</p></div></header><ChatClient /></main>;
}
