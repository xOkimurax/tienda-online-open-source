-- AlterTable
ALTER TABLE "customers" ADD COLUMN "passwordResetTokenHash" TEXT,
ADD COLUMN "passwordResetExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "customers_passwordResetTokenHash_key" ON "customers"("passwordResetTokenHash");
