PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Client" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "phone" TEXT,
  "phoneNormalized" TEXT,
  "defaultVehicle" TEXT,
  "notes" TEXT,
  "searchText" TEXT NOT NULL DEFAULT '',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_Client" ("id", "name", "phone", "phoneNormalized", "defaultVehicle", "notes", "searchText", "createdAt", "updatedAt")
SELECT "id", "name", "phone", "phoneNormalized", "defaultVehicle", "notes", "searchText", "createdAt", "updatedAt" FROM "Client";

DROP TABLE "Client";
ALTER TABLE "new_Client" RENAME TO "Client";
CREATE UNIQUE INDEX "Client_phoneNormalized_key" ON "Client"("phoneNormalized");
CREATE INDEX "Client_createdAt_idx" ON "Client"("createdAt");

CREATE TABLE "new_Order" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "type" TEXT NOT NULL DEFAULT 'REGULAR',
  "status" TEXT NOT NULL,
  "clientId" INTEGER NOT NULL,
  "pickupAddress" TEXT,
  "destinationAddress" TEXT,
  "vehicle" TEXT,
  "amountCents" INTEGER,
  "paidAmountCents" INTEGER NOT NULL DEFAULT 0,
  "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
  "paymentMethod" TEXT,
  "source" TEXT NOT NULL DEFAULT 'Другое',
  "notes" TEXT,
  "searchText" TEXT NOT NULL DEFAULT '',
  "scheduledAt" DATETIME,
  "startedAt" DATETIME,
  "completedAt" DATETIME,
  "cancelledAt" DATETIME,
  "createdById" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Order_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_Order" ("id", "type", "status", "clientId", "pickupAddress", "destinationAddress", "vehicle", "amountCents", "paidAmountCents", "paymentStatus", "paymentMethod", "source", "notes", "searchText", "scheduledAt", "startedAt", "completedAt", "cancelledAt", "createdById", "createdAt", "updatedAt")
SELECT "id", "type", "status", "clientId", "pickupAddress", "destinationAddress", "vehicle", "amountCents", "paidAmountCents", "paymentStatus", "paymentMethod", "source", "notes", "searchText", "scheduledAt", "startedAt", "completedAt", "cancelledAt", "createdById", "createdAt", "updatedAt" FROM "Order";

DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
CREATE INDEX "Order_scheduledAt_idx" ON "Order"("scheduledAt");
CREATE INDEX "Order_completedAt_idx" ON "Order"("completedAt");
CREATE INDEX "Order_clientId_createdAt_idx" ON "Order"("clientId", "createdAt");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
