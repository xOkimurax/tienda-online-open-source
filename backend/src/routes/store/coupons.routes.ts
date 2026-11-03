import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { asyncHandler, HttpError } from '@/lib/asyncHandler';

export const storeCouponsRouter = Router();

function parseProductIds(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw) return [];
  return raw.split(',').filter(Boolean);
}

// Whether ANY active coupon currently applies to this cart — either a
// store-wide (TODOS) coupon, or one specifically assigned to a product in
// it. Used to decide whether to show the coupon field at checkout at all.
storeCouponsRouter.get(
  '/applicable',
  asyncHandler(async (req, res) => {
    const productIds = parseProductIds(req.query.productIds);
    const coupon = await prisma.coupon.findFirst({
      where: {
        activo: true,
        OR: [{ alcance: 'TODOS' }, { alcance: 'PRODUCTOS', productos: { some: { productId: { in: productIds } } } }],
      },
    });
    res.json({ applicable: !!coupon });
  }),
);

const validateSchema = z.object({ codigo: z.string().min(1), productIds: z.array(z.string()).default([]) });

// Preview-only: confirms the code is usable for this cart and returns the
// discount shape so the frontend can show the resulting total before the
// customer actually submits payment. /checkout re-validates and applies it
// server-side regardless, so this isn't a trust boundary.
storeCouponsRouter.post(
  '/validate',
  asyncHandler(async (req, res) => {
    const { codigo, productIds } = validateSchema.parse(req.body);
    const coupon = await prisma.coupon.findUnique({ where: { codigo: codigo.toUpperCase() } });
    if (!coupon || !coupon.activo) throw new HttpError(400, 'Cupón inválido o inactivo');
    if (coupon.alcance === 'PRODUCTOS') {
      const applies = await prisma.couponProduct.findFirst({ where: { couponId: coupon.id, productId: { in: productIds } } });
      if (!applies) throw new HttpError(400, 'Este cupón no aplica a los productos de tu carrito');
    }
    res.json({ codigo: coupon.codigo, tipo: coupon.tipo, valor: coupon.valor });
  }),
);
