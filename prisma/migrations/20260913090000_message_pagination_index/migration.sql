DROP INDEX IF EXISTS "Message_conversationId_createdAt_idx";
CREATE INDEX "Message_conversationId_createdAt_id_idx" ON "Message"("conversationId", "createdAt", "id");
