-- AlterTable
ALTER TABLE "orders" ADD COLUMN "existenciaConfirmadaAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "verification_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "toleranciaHoras" INTEGER NOT NULL DEFAULT 24,

    CONSTRAINT "verification_settings_pkey" PRIMARY KEY ("id")
);
