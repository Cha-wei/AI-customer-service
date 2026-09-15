"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function WorkspaceSync({ conversationId, requestUrl, revision }: { revision: string } & ({ conversationId: string; requestUrl?: never } | { requestUrl: string; conversationId?: never })) {
  const endpoint = requestUrl ?? `/api/admin/conversations/${encodeURIComponent(conversationId!)}/revision`;
  const router = useRouter();
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    let disposed = false;
    let busy = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    async function check() {
      clearTimeout(timer);
      if (disposed || busy || document.hidden) return;
      busy = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 10000);
      try {
        const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
        if (!response.ok || response.redirected) throw new Error();
        const data = await response.json();
        if (typeof data.revision !== "string") throw new Error();
        if (!disposed) {
          failures = 0;
          setError(false);
          // Compare with the rendered revision so an interrupted refresh is retried.
          if (data.revision !== revision) startTransition(() => router.refresh());
        }
      } catch {
        if (!disposed) { failures++; setError(true); }
      } finally {
        clearTimeout(timeout);
        busy = false;
        if (!disposed) timer = setTimeout(check, Math.min(3000 * 2 ** failures, 30000));
      }
    }
    const resume = () => { if (!document.hidden) void check(); else clearTimeout(timer); };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    void check();
    return () => { disposed = true; clearTimeout(timer); controller?.abort(); document.removeEventListener("visibilitychange", resume); window.removeEventListener("online", resume); };
  }, [endpoint, revision, router]);
  return <p className="workspace-sync" role={error ? "alert" : "status"}>{error ? "同步暂时中断，当前信息可能已过期；正在自动重试。" : pending ? "正在更新会话…" : "自动同步已开启 · 每 3 秒检查状态变化"}</p>;
}
