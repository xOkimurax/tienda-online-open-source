import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { asyncHandler, HttpError } from '@/lib/asyncHandler';
import { requireRole } from '@/middleware/adminAuth';

export const adminCategoriesRouter = Router();
const CATALOG_ROLES = ['SUPER_ADMIN', 'ADMIN', 'EDITOR_CATALOGO'] as const;

adminCategoriesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(500, Math.max(1, Number(req.query.pageSize) || 15));

    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        include: { subcategorias: true, _count: { select: { products: true } } },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.category.count(),
    ]);
    res.json({
      items: categories.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        subcategorias: c.subcategorias.map((s) => ({ id: s.id, nombre: s.nombre })),
        count: c._count.products,
      })),
      total,
      page,
      pageSize,
    });
  }),
);

const categorySchema = z.object({
  nombre: z.string().min(1),
  subcategorias: z.array(z.string().min(1)).default([]),
});

adminCategoriesRouter.post(
  '/',
  requireRole(...CATALOG_ROLES),
  asyncHandler(async (req, res) => {
    const data = categorySchema.parse(req.body);
    const category = await prisma.category.create({
      data: { nombre: data.nombre, subcategorias: { create: data.subcategorias.map((nombre) => ({ nombre })) } },
      include: { subcategorias: true },
    });
    res.status(201).json(category);
  }),
);

adminCategoriesRouter.put(
  '/:id',
  requireRole(...CATALOG_ROLES),
  asyncHandler(async (req, res) => {
    const data = categorySchema.parse(req.body);
    const category = await prisma.$transaction(async (tx) => {
      await tx.subcategory.deleteMany({ where: { categoryId: req.params.id } });
      return tx.category.update({
        where: { id: req.params.id },
        data: { nombre: data.nombre, subcategorias: { create: data.subcategorias.map((nombre) => ({ nombre })) } },
        include: { subcategorias: true },
      });
    });
    res.json(category);
  }),
);

adminCategoriesRouter.delete(
  '/:id',
  requireRole(...CATALOG_ROLES),
  asyncHandler(async (req, res) => {
    const category = await prisma.category.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { products: true } } },
    });
    if (!category) throw new HttpError(404, 'Categoría no encontrada');
    // Product.categoryId is required (not nullable) — deleting a category
    // with products would either violate that FK or silently orphan them,
    // so this has to be caught with a clear reason instead of the delete
    // just failing (or, worse, the old code masking it as "not found").
    if (category._count.products > 0) {
      throw new HttpError(
        409,
        `No se puede eliminar "${category.nombre}": tiene ${category._count.products} producto(s) asociado(s). Reasigná o eliminá esos productos primero.`,
      );
    }
    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);
