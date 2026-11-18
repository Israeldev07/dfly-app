-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailCodeAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "emailCodeExpiresAt" TIMESTAMP(3),
ADD COLUMN     "emailCodeHash" TEXT;
