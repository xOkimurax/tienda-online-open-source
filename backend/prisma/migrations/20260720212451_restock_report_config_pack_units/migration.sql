-- CreateEnum
CREATE TYPE "RestockTipo" AS ENUM ('UNIDADES', 'PAQUETES');

-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN     "recibeReporteStock" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "stockMinimo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unidadesSueltas" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "restocks" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "tipo" "RestockTipo" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "unidadesAgregadas" INTEGER NOT NULL,
    "adminUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "diaSemana" INTEGER NOT NULL DEFAULT 1,
    "hora" TEXT NOT NULL DEFAULT '08:00',
    "incluirMasVendidos" BOOLEAN NOT NULL DEFAULT false,
    "incluirMenosVendidos" BOOLEAN NOT NULL DEFAULT false,
    "ultimoEnvio" TIMESTAMP(3),

    CONSTRAINT "report_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "restocks_productId_idx" ON "restocks"("productId");

-- CreateIndex
CREATE INDEX "restocks_createdAt_idx" ON "restocks"("createdAt");

-- AddForeignKey
ALTER TABLE "restocks" ADD CONSTRAINT "restocks_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restocks" ADD CONSTRAINT "restocks_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
