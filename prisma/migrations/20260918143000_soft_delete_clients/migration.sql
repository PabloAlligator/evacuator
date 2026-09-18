-- Preserve order history while allowing clients to be removed from the active CRM list.
ALTER TABLE "Client" ADD COLUMN "deletedAt" DATETIME;

CREATE INDEX "Client_deletedAt_updatedAt_idx" ON "Client"("deletedAt", "updatedAt");
