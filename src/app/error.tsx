"use client";
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <main className="shell state-page"><div className="state-card error-card"><span className="state-icon" aria-hidden="true">!</span><h1>无法加载会话</h1><p>服务暂时不可用，请稍后重试。</p><button onClick={reset} type="button">重新加载</button></div></main>;
}
