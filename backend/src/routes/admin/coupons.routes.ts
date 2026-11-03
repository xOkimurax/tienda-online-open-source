import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { asyncHandler, HttpError } from '@/lib/asyncHandler';
import { requireRole } from '@/middleware/adminAuth';

export const adminCouponsRouter = Router();
const CATALOG_ROLES = ['SUPER_ADMIN', 'ADMIN', 'EDITOR_CATALOGO'] as const;

adminCouponsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const coupons = await prisma.coupon.findMany({
      include: { productos: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(
      coupons.map((c) => ({
        id: c.id,
        codigo: c.codigo,
        tipo: c.tipo,
        valor: c.valor,
        activo: c.activo,
        usos: c.usos,
        alcance: c.alcance,
        productos: c.productos.map((p) => p.productId),
      })),
    );
  }),
);

const couponSchema = z.object({
  codigo: z.string().min(1),
  tipo: z.enum(['PORCENTAJE', 'MONTO_FIJO', 'ENVIO_GRATIS']),
  valor: z.coerce.number().int().min(0).default(0),
  alcance: z.enum(['TODOS', 'PRODUCTOS']).default('TODOS'),
  productos: z.array(z.string()).default([]),
});

adminCouponsRouter.post(
  '/',
  requireRole(...CATALOG_ROLES),
  asyncHandler(async (req, res) => {
    const data = couponSchema.parse(req.body);
    const coupon = await prisma.coupon.create({
      data: {
        codigo: data.codigo.toUpperCase(),
        tipo: data.tipo,
        valor: data.valor,
        alcance: data.alcance,
        productos: { create: data.productos.map((productId) => ({ productId })) },
      },
    });
    res.status(201).json(coupon);
  }),
);

adminCouponsRouter.put(
  '/:id',
  requireRole(...CATALOG_ROLES),
  asyncHandler(async (req, res) => {
    const data = couponSchema.parse(req.body);
    const coupon = await prisma.$transaction(async (tx) => {
      await tx.couponProduct.deleteMany({ where: { couponId: req.params.id } });
      return tx.coupon.update({
        where: { id: req.params.id },
        data: {
          codigo: data.codigo.toUpperCase(),
          tipo: data.tipo,
          valor: data.valor,
          alcance: data.alcance,
          productos: { create: data.productos.map((productId) => ({ productId })) },
        },
      });
    });
    res.json(coupon);
  }),
);

adminCouponsRouter.patch(
  '/:id/toggle-activo',
  requireRole(...CATALOG_ROLES),
  asyncHandler(async (req, res) => {
    const existing = await prisma.coupon.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new HttpError(404, 'Cupón no encontrado');
    const coupon = await prisma.coupon.update({ where: { id: req.params.id }, data: { activo: !existing.activo } });
    res.json(coupon);
  }),
);

adminCouponsRouter.delete(
  '/:id',
  requireRole(...CATALOG_ROLES),
  asyncHandler(async (req, res) => {
    await prisma.coupon.delete({ where: { id: req.params.id } }).catch(() => {
      throw new HttpError(404, 'Cupón no encontrado');
    });
    res.json({ ok: true });
  }),
);
