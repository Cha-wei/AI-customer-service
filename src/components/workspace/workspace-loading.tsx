import { WorkspaceLayout } from "./workspace-layout";

export function WorkspaceLoading() {
  return <WorkspaceLayout inbox={<div className="workspace-loading"><p>正在加载会话队列…</p>{[1, 2, 3, 4].map(item => <div className="skeleton skeleton-row" key={item} />)}</div>}>
    <div className="workspace-loading" role="status" aria-label="正在加载会话" aria-busy="true"><p>正在读取消息与处理记录…</p><div className="skeleton skeleton-row" /><div className="skeleton skeleton-row" /></div>
  </WorkspaceLayout>;
}
