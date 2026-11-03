-- CreateTable
CREATE TABLE "theme_variants" (
    "id" TEXT NOT NULL,
    "tema" "Tema" NOT NULL,
    "nombre" TEXT NOT NULL,
    "colores" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "theme_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "theme_variants_tema_idx" ON "theme_variants"("tema");

-- AlterTable
ALTER TABLE "branding_config" ADD COLUMN "temaVariantId" TEXT;

-- AddForeignKey
ALTER TABLE "branding_config" ADD CONSTRAINT "branding_config_temaVariantId_fkey" FOREIGN KEY ("temaVariantId") REFERENCES "theme_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
