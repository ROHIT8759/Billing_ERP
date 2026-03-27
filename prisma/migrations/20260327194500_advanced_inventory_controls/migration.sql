ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "saltComposition" TEXT,
ADD COLUMN IF NOT EXISTS "minStockLevel" INTEGER,
ADD COLUMN IF NOT EXISTS "maxStockLevel" INTEGER,
ADD COLUMN IF NOT EXISTS "reorderQuantity" INTEGER,
ADD COLUMN IF NOT EXISTS "primarySupplierId" TEXT;

CREATE INDEX IF NOT EXISTS "Product_primarySupplierId_idx" ON "Product"("primarySupplierId");
CREATE INDEX IF NOT EXISTS "Product_saltComposition_idx" ON "Product"("saltComposition");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'Product_primarySupplierId_fkey'
      AND table_name = 'Product'
  ) THEN
    ALTER TABLE "Product"
    ADD CONSTRAINT "Product_primarySupplierId_fkey"
    FOREIGN KEY ("primarySupplierId") REFERENCES "Supplier"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "StockAudit" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "godownId" TEXT NOT NULL,
  "auditDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "notes" TEXT,
  "postedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StockAuditItem" (
  "id" TEXT NOT NULL,
  "stockAuditId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "expectedQty" INTEGER NOT NULL,
  "physicalQty" INTEGER NOT NULL DEFAULT 0,
  "differenceQty" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockAuditItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StockAudit_shopId_godownId_auditDate_idx" ON "StockAudit"("shopId", "godownId", "auditDate");
CREATE INDEX IF NOT EXISTS "StockAudit_status_idx" ON "StockAudit"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "StockAuditItem_stockAuditId_productId_key" ON "StockAuditItem"("stockAuditId", "productId");
CREATE INDEX IF NOT EXISTS "StockAuditItem_productId_idx" ON "StockAuditItem"("productId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'StockAudit_shopId_fkey'
      AND table_name = 'StockAudit'
  ) THEN
    ALTER TABLE "StockAudit"
    ADD CONSTRAINT "StockAudit_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'StockAudit_godownId_fkey'
      AND table_name = 'StockAudit'
  ) THEN
    ALTER TABLE "StockAudit"
    ADD CONSTRAINT "StockAudit_godownId_fkey"
    FOREIGN KEY ("godownId") REFERENCES "Godown"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'StockAuditItem_stockAuditId_fkey'
      AND table_name = 'StockAuditItem'
  ) THEN
    ALTER TABLE "StockAuditItem"
    ADD CONSTRAINT "StockAuditItem_stockAuditId_fkey"
    FOREIGN KEY ("stockAuditId") REFERENCES "StockAudit"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'StockAuditItem_productId_fkey'
      AND table_name = 'StockAuditItem'
  ) THEN
    ALTER TABLE "StockAuditItem"
    ADD CONSTRAINT "StockAuditItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
