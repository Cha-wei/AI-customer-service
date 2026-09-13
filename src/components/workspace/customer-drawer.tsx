"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function CustomerDrawer({ children, initialOpen = false }: { children: ReactNode; initialOpen?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (initialOpen && !element?.open) element?.showModal();
    const restore = () => trigger.current?.focus();
    element?.addEventListener("close", restore);
    return () => element?.removeEventListener("close", restore);
  }, [initialOpen]);
  return <>
    <button className="secondary-button drawer-trigger" ref={trigger} onClick={() => dialog.current?.showModal()} aria-haspopup="dialog">客户信息 <span aria-hidden="true">↗</span></button>
    <dialog className="customer-drawer" aria-labelledby="customer-drawer-title" ref={dialog} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="drawer-surface"><header className="drawer-heading"><div><p className="eyebrow">CONVERSATION DETAILS</p><h2 id="customer-drawer-title">客户信息</h2></div><button className="icon-button" aria-label="关闭客户信息" onClick={() => dialog.current?.close()}>×</button></header><div className="drawer-content">{children}</div></div>
    </dialog>
  </>;
}
