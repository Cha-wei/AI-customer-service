import { MessageSquare, Inbox, ShieldCheck, UserRound, CircleCheck, BookOpen, Bot, Settings2, PanelLeftClose, List, PanelRight, Search } from "lucide-react";
const icons = { conversations: MessageSquare, queue: Inbox, approval: ShieldCheck, human: UserRound, resolved: CircleCheck, knowledge: BookOpen, agent: Bot, settings: Settings2, collapse: PanelLeftClose, list: List, context: PanelRight, search: Search };
export type WorkspaceIconName = keyof typeof icons;
export function WorkspaceIcon({ name }: { name: WorkspaceIconName }) {
  const Icon = icons[name];
  return <Icon className="workspace-icon" aria-hidden="true" strokeWidth={1.6} />;
}
