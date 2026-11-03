import { Router } from 'express';
import { prisma } from '@/lib/prisma';
import { asyncHandler } from '@/lib/asyncHandler';
import { resolveFeaturedCategoryIds } from '@/lib/featuredCategories';

export const storeContentRouter = Router();

storeContentRouter.get(
  '/branding',
  asyncHandler(async (_req, res) => {
    // temaVariant included so the root layout (fetchBranding) can apply its
    // custom colors as inline CSS vars alongside data-theme — see
    // frontend/app/layout.tsx.
    const branding = await prisma.brandingConfig.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
      include: { temaVariant: true },
    });
    res.json(branding);
  }),
);

storeContentRouter.get(
  '/about',
  asyncHandler(async (_req, res) => {
    const about = await prisma.aboutContent.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
    res.json(about);
  }),
);

// Bank details are only meant to surface once a customer picks "transferencia"
// at checkout (and, if the product needs it, after existence is confirmed) —
// this is intentionally public since it's just where to send money, not a secret.
storeContentRouter.get(
  '/bank-info',
  asyncHandler(async (_req, res) => {
    const bankInfo = await prisma.bankInfo.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
    res.json(bankInfo);
  }),
);

// Lets checkout explain, in concrete terms, how long a confirmed
// verification-required item stays payable before it needs re-verification.
storeContentRouter.get(
  '/verification-settings',
  asyncHandler(async (_req, res) => {
    const settings = await prisma.verificationSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
    res.json({ toleranciaHoras: settings.toleranciaHoras });
  }),
);

storeContentRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({ include: { subcategorias: true } });
    res.json(categories);
  }),
);

// Powers the home page's "Categorías destacadas" tiles: up to 3 admin-picked
// categories (see resolveFeaturedCategoryIds), each with a handful of real
// product photos for the tile's rotating carousel.
storeContentRouter.get(
  '/featured-categories',
  asyncHandler(async (_req, res) => {
    const ids = await resolveFeaturedCategoryIds();
    const categories = await prisma.category.findMany({ where: { id: { in: ids } } });
    const withImages = await Promise.all(
      ids
        .map((id) => categories.find((c) => c.id === id))
        .filter((c): c is (typeof categories)[number] => Boolean(c))
        .map(async (category) => {
          const products = await prisma.product.findMany({
            where: { categoryId: category.id },
            orderBy: { createdAt: 'desc' },
            take: 8,
            include: { imagenes: { orderBy: { orden: 'asc' as const }, take: 1 } },
          });
          const images = products.map((p) => p.imagenes[0]?.url).filter((url): url is string => Boolean(url));
          return { id: category.id, nombre: category.nombre, images };
        }),
    );
    res.json(withImages);
  }),
);
