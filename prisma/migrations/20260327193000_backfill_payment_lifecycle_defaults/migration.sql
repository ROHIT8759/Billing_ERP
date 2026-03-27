DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Invoice'
      AND column_name = 'paidAmount'
  ) THEN
    UPDATE "Invoice"
    SET "paidAmount" = 0
    WHERE "paidAmount" IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Invoice'
      AND column_name = 'outstandingAmount'
  ) THEN
    UPDATE "Invoice"
    SET "outstandingAmount" = GREATEST(COALESCE("totalAmount", 0), 0)
    WHERE "outstandingAmount" IS NULL
       OR "outstandingAmount" = 0;

    UPDATE "Invoice"
    SET "outstandingAmount" = 0
    WHERE "outstandingAmount" < 0;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Invoice'
      AND column_name = 'paymentStatus'
  ) THEN
    UPDATE "Invoice"
    SET "paymentStatus" = 'UNPAID'
    WHERE "paymentStatus" IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Purchase'
      AND column_name = 'paidAmount'
  ) THEN
    UPDATE "Purchase"
    SET "paidAmount" = 0
    WHERE "paidAmount" IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Purchase'
      AND column_name = 'outstandingAmount'
  ) THEN
    UPDATE "Purchase"
    SET "outstandingAmount" = GREATEST(COALESCE("totalAmount", 0), 0)
    WHERE "outstandingAmount" IS NULL
       OR "outstandingAmount" = 0;

    UPDATE "Purchase"
    SET "outstandingAmount" = 0
    WHERE "outstandingAmount" < 0;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Purchase'
      AND column_name = 'paymentStatus'
  ) THEN
    UPDATE "Purchase"
    SET "paymentStatus" = 'UNPAID'
    WHERE "paymentStatus" IS NULL;
  END IF;
END $$;
