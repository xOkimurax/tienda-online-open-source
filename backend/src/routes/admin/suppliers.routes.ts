import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { asyncHandler, HttpError } from '@/lib/asyncHandler';
import { requireRole } from '@/middleware/adminAuth';

export const adminSuppliersRouter = Router();
const CATALOG_ROLES = ['SUPER_ADMIN', 'ADMIN', 'EDITOR_CATALOGO'] as const;

adminSuppliersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(500, Math.max(1, Number(req.query.pageSize) || 15));

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        include: { _count: { select: { products: true } } },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.supplier.count(),
    ]);
    res.json({ items: suppliers.map((s) => ({ ...s, count: s._count.products })), total, page, pageSize });
  }),
);

const supplierSchema = z.object({
  nombre: z.string().min(1),
  contacto: z.string().default(''),
  telefono: z.string().default(''),
});

adminSuppliersRouter.post(
  '/',
  requireRole(...CATALOG_ROLES),
  asyncHandler(async (req, res) => {
    const data = supplierSchema.parse(req.body);
    const supplier = await prisma.supplier.create({ data });
    res.status(201).json(supplier);
  }),
);

adminSuppliersRouter.put(
  '/:id',
  requireRole(...CATALOG_ROLES),
  asyncHandler(async (req, res) => {
    const data = supplierSchema.parse(req.body);
    const supplier = await prisma.supplier.update({ where: { id: req.params.id }, data });
    res.json(supplier);
  }),
);

adminSuppliersRouter.delete(
  '/:id',
  requireRole(...CATALOG_ROLES),
  asyncHandler(async (req, res) => {
    await prisma.supplier.delete({ where: { id: req.params.id } }).catch(() => {
      throw new HttpError(404, 'Proveedor no encontrado');
    });
    res.json({ ok: true });
  }),
);
