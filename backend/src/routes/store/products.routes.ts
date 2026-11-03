import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { asyncHandler, HttpError } from '@/lib/asyncHandler';
import { disponibleParaVenta, totalUnidadesDisponibles } from '@/lib/stock';

export const storeProductsRouter = Router();

// Customers always buy in plain units, so every product the storefront
// returns carries a computed `stockDisponible` (total sellable units) —
// never the raw `stock` column, which for pack-sold products only counts
// whole packs (see lib/stock.ts).
function withStockDisponible<T extends Parameters<typeof totalUnidadesDisponibles>[0]>(product: T) {
  return { ...product, stockDisponible: totalUnidadesDisponibles(product) };
}

const include = {
  category: true,
  subcategory: true,
  variantes: true,
  imagenes: { orderBy: { orden: 'asc' as const } },
};

const SORT_MAP = {
  precio_asc: { precio: 'asc' as const },
  precio_desc: { precio: 'desc' as const },
  nombre: { nombre: 'asc' as const },
  relevancia: { createdAt: 'desc' as const },
};

storeProductsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { categoria, subcategoria, q, destacado, onlyInStock, minPrecio, maxPrecio, sort } = req.query as Record<
      string,
      string | undefined
    >;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(500, Math.max(1, Number(req.query.pageSize) || 15));
    const precioFilter: { gte?: number; lte?: number } = {};
    if (minPrecio) precioFilter.gte = Number(minPrecio);
    if (maxPrecio) precioFilter.lte = Number(maxPrecio);

    const where = {
      // A pack-sold product can be at stock=0 (no whole packs left) while
      // still having sellable loose units — either counts as "in stock".
      ...(onlyInStock === 'true' ? { OR: [{ stock: { gt: 0 } }, { unidadesSueltas: { gt: 0 } }] } : {}),
      categoryId: categoria || undefined,
      subcategoryId: subcategoria || undefined,
      destacado: destacado === 'true' ? true : undefined,
      nombre: q ? { contains: q, mode: 'insensitive' as const } : undefined,
      precio: Object.keys(precioFilter).length ? precioFilter : undefined,
    };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include,
        orderBy: SORT_MAP[sort as keyof typeof SORT_MAP] ?? SORT_MAP.relevancia,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);
    res.json({ items: items.map(withStockDisponible), total, page, pageSize });
  }),
);

// Registered before /:id so "price-range" doesn't get swallowed as an id.
storeProductsRouter.get(
  '/price-range',
  asyncHandler(async (_req, res) => {
    const result = await prisma.product.aggregate({ _max: { precio: true } });
    res.json({ max: result._max.precio ?? 0 });
  }),
);

storeProductsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({ where: { id: req.params.id }, include });
    if (!product) throw new HttpError(404, 'Producto no encontrado');
    res.json(withStockDisponible(product));
  }),
);

const HELD_STATES = ['PAGO_CONFIRMADO', 'ENVIADO', 'ENTREGADO'] as const;

// "Similar" ranks candidates by subcategory match first (same subcategory
// beats same category-but-different-subcategory), then by how much each
// candidate has actually sold — so within a tier, what other customers
// bought together with this kind of product bubbles up over what merely
// shares a category label. Backfills with the best-selling products overall
// if the product's own category doesn't have 6 other items.
storeProductsRouter.get(
  '/:id/similares',
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) throw new HttpError(404, 'Producto no encontrado');

    const LIMIT = 6;

    async function salesCounts(productIds: string[]): Promise<Map<string, number>> {
      if (productIds.length === 0) return new Map();
      const rows = await prisma.orderItem.groupBy({
        by: ['productId'],
        where: { productId: { in: productIds }, order: { estado: { in: [...HELD_STATES] } } },
        _sum: { cantidad: true },
      });
      return new Map(rows.map((r) => [r.productId as string, r._sum.cantidad ?? 0]));
    }

    const sameCategory = await prisma.product.findMany({
      where: { categoryId: product.categoryId, id: { not: product.id } },
      include,
    });

    const sales = await salesCounts(sameCategory.map((p) => p.id));
    const ranked = sameCategory
      .map((p) => ({
        product: p,
        score: (p.subcategoryId && p.subcategoryId === product.subcategoryId ? 1_000_000 : 0) + (sales.get(p.id) ?? 0),
      }))
      .sort((a, b) => b.score - a.score)
      .map((r) => r.product);

    let picked = ranked.slice(0, LIMIT);

    if (picked.length < LIMIT) {
      const excludeIds = [product.id, ...picked.map((p) => p.id)];
      const fallback = await prisma.product.findMany({
        where: { id: { notIn: excludeIds } },
        include,
        take: LIMIT - picked.length + 20,
      });
      const fallbackSales = await salesCounts(fallback.map((p) => p.id));
      const rankedFallback = fallback
        .map((p) => ({ product: p, score: fallbackSales.get(p.id) ?? 0 }))
        .sort((a, b) => b.score - a.score)
        .map((r) => r.product);
      picked = picked.concat(rankedFallback.slice(0, LIMIT - picked.length));
    }

    res.json(picked.map(withStockDisponible));
  }),
);

const stockCheckSchema = z.object({
  items: z
    .array(z.object({ productId: z.string(), cantidad: z.number().int().min(1), tipoVenta: z.enum(['UNIDAD', 'PAQUETE']).default('UNIDAD') }))
    .min(1),
});

// Pre-flight validation for the cart/checkout pages — lets the frontend show
// exactly which product(s) are short and by how much before the customer
// even reaches the payment step, instead of only finding out from a generic
// checkout-time error.
storeProductsRouter.post(
  '/stock-check',
  asyncHandler(async (req, res) => {
    const { items } = stockCheckSchema.parse(req.body);
    const products = await prisma.product.findMany({ where: { id: { in: items.map((i) => i.productId) } } });

    const problems = items
      .map((item) => {
        const product = products.find((p) => p.id === item.productId);
        if (!product) return { productId: item.productId, nombre: 'Producto', disponible: 0, solicitado: item.cantidad };
        const disponible = disponibleParaVenta(product, item.tipoVenta);
        if (disponible >= item.cantidad) return null;
        return { productId: product.id, nombre: product.nombre, disponible, solicitado: item.cantidad };
      })
      .filter((p): p is { productId: string; nombre: string; disponible: number; solicitado: number } => p !== null);

    res.json({ ok: problems.length === 0, problems });
  }),
);
