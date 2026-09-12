export default function Loading() {
  return <main className="shell" aria-busy="true" aria-label="正在加载会话"><div className="skeleton skeleton-title" /><div className="panel skeleton-panel">{[1, 2, 3].map((item) => <div className="skeleton skeleton-row" key={item} />)}</div></main>;
}
