-- Old conversations have no reliable handoff timestamp; do not infer one.
ALTER TABLE "Conversation" ADD COLUMN "humanHandoffAt" DATETIME;
