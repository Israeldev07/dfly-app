-- Verificación propia (sin Google): códigos por email y WhatsApp, y enlaces de recuperación de contraseña.
-- Los códigos pendientes del flujo anterior (el cliente escribía a Dfly) se descartan.
-- CreateEnum
CREATE TYPE "VerificationPurpose" AS ENUM ('EMAIL', 'PHONE', 'PASSWORD_RESET');

-- DropIndex
DROP INDEX "users_phoneCode_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "phoneCode",
DROP COLUMN "phoneCodeExpiresAt";

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "VerificationPurpose" NOT NULL,
    "target" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "verification_codes_codeHash_key" ON "verification_codes"("codeHash");

-- CreateIndex
CREATE INDEX "verification_codes_expiresAt_idx" ON "verification_codes"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "verification_codes_userId_purpose_key" ON "verification_codes"("userId", "purpose");

-- AddForeignKey
ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
