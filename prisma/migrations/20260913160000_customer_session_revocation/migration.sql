CREATE TABLE "RevokedCustomerSession" (
    "digest" TEXT NOT NULL PRIMARY KEY,
    "expiresAt" DATETIME NOT NULL
);
CREATE INDEX "RevokedCustomerSession_expiresAt_idx" ON "RevokedCustomerSession"("expiresAt");
