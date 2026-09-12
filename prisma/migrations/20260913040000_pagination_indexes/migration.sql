CREATE INDEX "Conversation_updatedAt_id_idx" ON "Conversation"("updatedAt", "id");
CREATE INDEX "Conversation_status_updatedAt_id_idx" ON "Conversation"("status", "updatedAt", "id");
CREATE INDEX "Conversation_customerId_updatedAt_id_idx" ON "Conversation"("customerId", "updatedAt", "id");
CREATE INDEX "RuntimeExecution_conversationId_createdAt_id_idx" ON "RuntimeExecution"("conversationId", "createdAt", "id");
