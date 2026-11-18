-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OutboxKind" ADD VALUE 'STORE_LATE_RESPONSE';
ALTER TYPE "OutboxKind" ADD VALUE 'ADMIN_LATE_RESPONSE';
