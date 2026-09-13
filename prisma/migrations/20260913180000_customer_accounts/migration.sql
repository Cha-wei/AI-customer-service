CREATE TABLE "CustomerAccount" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "loginName" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sessionVersion" INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX "CustomerAccount_loginName_key" ON "CustomerAccount"("loginName");
CREATE UNIQUE INDEX "CustomerAccount_customerId_key" ON "CustomerAccount"("customerId");
