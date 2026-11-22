-- AlterTable
ALTER TABLE "users" ADD COLUMN     "phoneCode" TEXT,
ADD COLUMN     "phoneCodeExpiresAt" TIMESTAMP(3),
ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "users_phoneCode_key" ON "users"("phoneCode");
