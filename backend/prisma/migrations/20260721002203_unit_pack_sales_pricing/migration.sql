-- CreateEnum
CREATE TYPE "VentaModo" AS ENUM ('UNIDAD', 'PAQUETE');

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "tipoVenta" "VentaModo" NOT NULL DEFAULT 'UNIDAD';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "precioCostoPaquete" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "precioPaquete" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ventaUnidadActiva" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "restocks" ADD COLUMN     "precioCosto" INTEGER,
ADD COLUMN     "precioVenta" INTEGER;
