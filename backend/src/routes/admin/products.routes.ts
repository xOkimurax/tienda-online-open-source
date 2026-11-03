import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { asyncHandler, HttpError } from '@/lib/asyncHandler';
import { requireRole } from '@/middleware/adminAuth';
import { uploadImage, publicUrlFor } from '@/lib/upload';
import { totalUnidadesDisponibles } from '@/lib/stock';

export const adminProductsRouter = Router();

const CATALOG_ROLES = ['SUPER_ADMIN', 'ADMIN', 'EDITOR_CATALOGO'] as const;

const include = {
  category: true,
  subcategory: true,
  supplier: true,
  variantes: true,
  imagenes: { orderBy: { orden: 'asc' as const } },
};

const SORT_MAP = {
  recientes: { createdAt: 'desc' as const },
  nombre_asc: { nombre: 'asc' as const },
  precio_asc: { precio: 'asc' as const },
  precio_desc: { precio: 'desc' as const },
  stock_asc: { stock: 'asc' as const },
  stock_desc: { stock: 'desc' as const },
};

adminProductsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { q, categoria, subcategoria, stockFilter, verificacion, destacado, sort } = req.query as Record<string, string | undefined>;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 15));

    const stockWhere =
      stockFilter === 'sin_stock'
        ? { stock: 0 }
        : stockFilter === 'bajo'
          ? { stock: { gt: 0, lte: 8 } }
          : stockFilter === 'con_stock'
            ? { stock: { gt: 0 } }
            : undefined;

    const where = {
      ...(q
        ? {
            OR: [
              { nombre: { contains: q, mode: 'insensitive' as const } },
              { codigo: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      categoryId: categoria || undefined,
      subcategoryId: subcategoria || undefined,
      requiereVerificacion: verificacion === 'requiere' ? true : verificacion === 'no_requiere' ? false : undefined,
      destacado: destacado === 'destacado' ? true : destacado === 'no_destacado' ? false : undefined,
      ...(stockWhere ? { stock: stockWhere.stock } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include,
        orderBy: SORT_MAP[sort as keyof typeof SORT_MAP] ?? SORT_MAP.recientes,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);

    res.json({ items: items.map((p) => ({ ...p, stockDisponible: totalUnidadesDisponibles(p) })), total, page, pageSize });
  }),
);

// Suggests the next sequential code (PRD-0001, PRD-0002, ...) so the "nuevo
// producto" form can prefill it — still editable, since codes may follow the
// merchant's own supplier/barcode scheme instead.
adminProductsRouter.get(
  '/next-code',
  asyncHandler(async (_req, res) => {
    const withCodes = await prisma.product.findMany({
      where: { codigo: { startsWith: 'PRD-' } },
      select: { codigo: true },
    });
    const maxN = withCodes.reduce((max, p) => {
      const n = Number(p.codigo.slice(4));
      return Number.isFinite(n) && n > max ? n : max;
    }, 0);
    res.json({ codigo: `PRD-${String(maxN + 1).padStart(4, '0')}` });
  }),
);

const variantSchema = z.object({ tipo: z.string().min(1), valores: z.array(z.string()) });

const productSchema = z.object({
  codigo: z.string().min(1),
  nombre: z.string().min(1),
  marca: z.string().default(''),
  descripcion: z.string().default(''),
  precio: z.coerce.number().int().min(0),
  precioCosto: z.coerce.number().int().min(0),
  precioPaquete: z.coerce.number().int().min(0).default(0),
  precioCostoPaquete: z.coerce.number().int().min(0).default(0),
  stock: z.coerce.number().int().min(0),
  unidadesSueltas: z.coerce.number().int().min(0).default(0),
  stockMinimo: z.coerce.number().int().min(0).default(0),
  icon: z.string().default('camisa'),
  requiereVerificacion: z.coerce.boolean().default(false),
  destacado: z.coerce.boolean().default(false),
  categoryId: z.string().min(1),
  subcategoryId: z.string().nullable().optional(),
  supplierId: z.string().nullable().optional(),
  ventaConjuntoActivo: z.coerce.boolean().default(false),
  ventaUnidadActiva: z.coerce.boolean().default(true),
  ventaConjuntoUnidades: z.coerce.number().int().min(1).default(1),
  variantes: z.array(variantSchema).default([]),
});

// A "solo por paquete" product (ventaConjuntoActivo && !ventaUnidadActiva)
// never tracks loose units — force unidadesSueltas to 0 regardless of what
// the form happened to submit, so it can't silently accumulate stale data.
function normalizeVentaFields<T extends { ventaConjuntoActivo: boolean; ventaUnidadActiva: boolean; unidadesSueltas: number }>(data: T): T {
  if (data.ventaConjuntoActivo && !data.ventaUnidadActiva) {
    return { ...data, unidadesSueltas: 0 };
  }
  return data;
}

function isDuplicateCodigo(err: unknown) {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'P2002' &&
    JSON.stringify((err as { meta?: unknown }).meta ?? '').includes('codigo')
  );
}

adminProductsRouter.post(
  '/',
  requireRole(...CATALOG_ROLES),
  asyncHandler(async (req, res) => {
    const data = normalizeVentaFields(productSchema.parse(req.body));
    const product = await prisma.product
      .create({
        data: {
          ...data,
          variantes: { create: data.variantes },
        },
        include,
      })
      .catch((err) => {
        if (isDuplicateCodigo(err)) throw new HttpError(409, `Ya existe un producto con el código "${data.codigo}"`);
        throw err;
      });
    res.status(201).json(product);
  }),
);

adminProductsRouter.put(
  '/:id',
  requireRole(...CATALOG_ROLES),
  asyncHandler(async (req, res) => {
    const data = normalizeVentaFields(productSchema.parse(req.body));
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new HttpError(404, 'Producto no encontrado');

    const product = await prisma
      .$transaction(async (tx) => {
        await tx.productVariant.deleteMany({ where: { productId: req.params.id } });
        return tx.product.update({
          where: { id: req.params.id },
          data: {
            ...data,
            variantes: { create: data.variantes },
          },
          include,
        });
      })
      .catch((err) => {
        if (isDuplicateCodigo(err)) throw new HttpError(409, `Ya existe un producto con el código "${data.codigo}"`);
        throw err;
      });
    res.json(product);
  }),
);

adminProductsRouter.delete(
  '/:id',
  requireRole(...CATALOG_ROLES),
  asyncHandler(async (req, res) => {
    await prisma.product.delete({ where: { id: req.params.id } }).catch(() => {
      throw new HttpError(404, 'Producto no encontrado');
    });
    res.json({ ok: true });
  }),
);

adminProductsRouter.patch(
  '/:id/verificacion',
  requireRole(...CATALOG_ROLES),
  asyncHandler(async (req, res) => {
    const { requiereVerificacion } = z.object({ requiereVerificacion: z.boolean() }).parse(req.body);
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { requiereVerificacion },
    });
    res.json(product);
  }),
);

const bulkSchema = z.object({ ids: z.array(z.string()).min(1), requiereVerificacion: z.boolean() });

adminProductsRouter.post(
  '/bulk-verificacion',
  requireRole(...CATALOG_ROLES),
  asyncHandler(async (req, res) => {
    const { ids, requiereVerificacion } = bulkSchema.parse(req.body);
    await prisma.product.updateMany({ where: { id: { in: ids } }, data: { requiereVerificacion } });
    res.json({ ok: true });
  }),
);

adminProductsRouter.post(
  '/:id/images',
  requireRole(...CATALOG_ROLES),
  ...uploadImage.array('images', 8),
  asyncHandler(async (req, res) => {
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (!files.length) throw new HttpError(400, 'No se recibieron imágenes');
    const currentCount = await prisma.productImage.count({ where: { productId: req.params.id } });
    const created = await prisma.$transaction(
      files.map((f, i) =>
        prisma.productImage.create({
          data: { productId: req.params.id, url: publicUrlFor(f.filename), orden: currentCount + i },
        }),
      ),
    );
    res.status(201).json(created);
  }),
);

adminProductsRouter.delete(
  '/:id/images/:imageId',
  requireRole(...CATALOG_ROLES),
  asyncHandler(async (req, res) => {
    await prisma.productImage.delete({ where: { id: req.params.imageId } }).catch(() => {
      throw new HttpError(404, 'Imagen no encontrada');
    });
    res.json({ ok: true });
  }),
);

const reorderSchema = z.object({ order: z.array(z.string()).min(1) });

// `order` is the full list of this product's image IDs in the desired
// display order — order[0] becomes the primary photo shown in the storefront.
adminProductsRouter.patch(
  '/:id/images/reorder',
  requireRole(...CATALOG_ROLES),
  asyncHandler(async (req, res) => {
    const { order } = reorderSchema.parse(req.body);
    await prisma.$transaction(
      order.map((imageId, i) =>
        prisma.productImage.updateMany({ where: { id: imageId, productId: req.params.id }, data: { orden: i } }),
      ),
    );
    const imagenes = await prisma.productImage.findMany({ where: { productId: req.params.id }, orderBy: { orden: 'asc' } });
    res.json(imagenes);
  }),
);
