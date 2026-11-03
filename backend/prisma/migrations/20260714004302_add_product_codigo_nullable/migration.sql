-- AlterTable
ALTER TABLE "products" ADD COLUMN "codigo" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "products_codigo_key" ON "products"("codigo");
