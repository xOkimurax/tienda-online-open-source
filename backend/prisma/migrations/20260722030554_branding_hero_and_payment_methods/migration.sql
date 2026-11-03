-- AlterTable
ALTER TABLE "branding_config" ADD COLUMN     "heroImageUrl" TEXT,
ADD COLUMN     "pagoTarjetaActivo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pagoTransferenciaActivo" BOOLEAN NOT NULL DEFAULT true;
