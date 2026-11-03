-- CreateEnum
CREATE TYPE "TipoEntrega" AS ENUM ('RETIRO_LOCAL', 'ENVIO_DOMICILIO');

-- AlterTable
ALTER TABLE "about_content" ADD COLUMN     "googleMapsUrl" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "envioBarrio" TEXT,
ADD COLUMN     "envioCelular" TEXT,
ADD COLUMN     "envioCi" TEXT,
ADD COLUMN     "envioCiudad" TEXT,
ADD COLUMN     "envioNombre" TEXT,
ADD COLUMN     "tipoEntrega" "TipoEntrega" NOT NULL DEFAULT 'RETIRO_LOCAL';

-- CreateTable
CREATE TABLE "customer_addresses" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ci" TEXT NOT NULL,
    "celular" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "barrio" TEXT NOT NULL,
    "esPredeterminada" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
