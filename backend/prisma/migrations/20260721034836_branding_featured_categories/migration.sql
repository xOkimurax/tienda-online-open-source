-- AlterTable
ALTER TABLE "branding_config" ADD COLUMN     "featuredCategoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
