CREATE TABLE "RuntimeExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "toolResult" TEXT,
    "errorCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "RuntimeExecution_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RuntimeExecution_messageId_key" ON "RuntimeExecution"("messageId");
CREATE INDEX "RuntimeExecution_status_createdAt_idx" ON "RuntimeExecution"("status", "createdAt");
