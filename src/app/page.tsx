import { requireAdminSession } from "@/modules/admin-auth";
import { ConversationList, type InboxFilters } from "@/components/workspace/conversation-list";
import { WorkspaceLayout, WorkspaceEmpty } from "@/components/workspace/workspace-layout";
export const dynamic = "force-dynamic";
export default async function Home({ searchParams }: { searchParams: Promise<InboxFilters> }) {
  await requireAdminSession();
  const filters = await searchParams;
  const inbox = await ConversationList({ filters });
  return <WorkspaceLayout inbox={inbox} filter={filters.status}><WorkspaceEmpty /></WorkspaceLayout>;
}
