const paths = {
  conversations: "M4 4h16v12H9l-5 4V4Zm4 4h8M8 12h5",
  queue: "M4 5h16M4 12h10M4 19h10m4-9 3 3-3 3",
  approval: "M9 12l2 2 4-4M6 3h12v18H6V3Z",
  human: "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m9 3v7m-3-4h6",
  resolved: "m7 12 3 3 7-7M21 12a9 9 0 1 1-5-8",
  knowledge: "M12 5v15M3 4h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v15h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3V4Z",
  agent: "M8 3h8v4H8V3ZM4 9h16v12H4V9Zm4 5h1m6 0h1m-8 4h8",
  settings: "M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6",
  collapse: "M4 3h16v18H4V3Zm5 0v18m7-13-3 4 3 4",
  list: "M9 5h11M9 12h11M9 19h11M4 5h1m-1 7h1m-1 7h1",
  context: "M4 3h16v18H4V3Zm11 0v18M7 8h5m-5 4h5",
  search: "M16 16l5 5M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14",
} as const;
export type WorkspaceIconName = keyof typeof paths;
export function WorkspaceIcon({ name }: { name: WorkspaceIconName }) {
  return <svg className="workspace-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}
