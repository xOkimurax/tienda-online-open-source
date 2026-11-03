import { Router } from 'express';
import { prisma } from '@/lib/prisma';
import { asyncHandler } from '@/lib/asyncHandler';
import { requireCustomer } from '@/middleware/customerAuth';

export const storeFavoritesRouter = Router();

async function favoriteIds(customerId: string) {
  const favs = await prisma.customerFavorite.findMany({ where: { customerId }, select: { productId: true } });
  return favs.map((f) => f.productId);
}

storeFavoritesRouter.get(
  '/',
  requireCustomer,
  asyncHandler(async (req, res) => {
    res.json(await favoriteIds(req.customer!.id));
  }),
);

storeFavoritesRouter.post(
  '/:productId/toggle',
  requireCustomer,
  asyncHandler(async (req, res) => {
    const existing = await prisma.customerFavorite.findUnique({
      where: { customerId_productId: { customerId: req.customer!.id, productId: req.params.productId } },
    });
    if (existing) {
      await prisma.customerFavorite.delete({ where: { id: existing.id } });
    } else {
      await prisma.customerFavorite.create({ data: { customerId: req.customer!.id, productId: req.params.productId } });
    }
    res.json(await favoriteIds(req.customer!.id));
  }),
);
