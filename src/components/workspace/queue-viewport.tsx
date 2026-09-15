"use client";
import { useLayoutEffect, useRef, type ReactNode } from "react";

export function QueueViewport({ revision, children }: { revision: string; children: ReactNode }) {
  const element = useRef<HTMLDivElement>(null);
  const scrollTop = useRef(0);
  useLayoutEffect(() => { if (element.current) element.current.scrollTop = scrollTop.current; }, [revision]);
  return <div className="conversation-list" ref={element} onScroll={event => { scrollTop.current = event.currentTarget.scrollTop; }}>{children}</div>;
}
