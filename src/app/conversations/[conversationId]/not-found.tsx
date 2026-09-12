import Link from "next/link";
export default function NotFound() { return <main className="shell state-page"><div className="state-card"><span className="state-icon" aria-hidden="true">?</span><h1>会话不存在</h1><p>该会话可能已被删除或链接有误。</p><Link className="button" href="/">返回会话列表</Link></div></main>; }
