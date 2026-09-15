import { createHash } from "node:crypto";
import type { ConversationPage } from "@/modules/conversations/repository";
import { getConversationService } from "@/modules/conversations/composition-root";
import { isConversationStatus, type ConversationStatus } from "@/modules/conversations/domain";
import { resolveDisplayQuery } from "./presentation";

export type InboxFilters = { query?: string; status?: string; page?: string };
export function normalizeInboxFilters(filters: InboxFilters): { query: string; status: ConversationStatus | ""; requestedPage: number } {
  const query = filters.query?.trim() ?? "";
  const requestedStatus = filters.status ?? "";
  const status = isConversationStatus(requestedStatus) ? requestedStatus : "";
  const requestedPage = /^\d+$/.test(filters.page ?? "") ? Number(filters.page) : 1;
  return { query, status, requestedPage };
}
export async function readQueuePage(filters: InboxFilters) {
  const { query, status, requestedPage } = normalizeInboxFilters(filters);
  return getConversationService().list({ query: resolveDisplayQuery(query), status, page: requestedPage });
}
export function queueRevision(page: ConversationPage, now: number) {
  // A minute boundary refreshes elapsed labels even when no new message arrives.
  return createHash("sha256").update(JSON.stringify([page, Math.floor(now / 60000)])).digest("hex");
}
