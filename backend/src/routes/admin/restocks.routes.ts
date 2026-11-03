import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { asyncHandler, HttpError } from '@/lib/asyncHandler';
import { requireRole } from '@/middleware/adminAuth';
import { computeStockIncrementPaquetes, computeStockIncrementUnidades } from '@/lib/stock';

export const adminRestocksRouter = Router();
const CATALOG_ROLES = ['SUPER_ADMIN', 'ADMIN', 'EDITOR_CATALOGO'] as const;

adminRestocksRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { productId, q, categoria, desde, hasta } = req.query as Record<string, string | undefined>;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 15));

    const createdAtWhere: { gte?: Date; lte?: Date } = {};
    if (desde) createdAtWhere.gte = new Date(desde);
    if (hasta) createdAtWhere.lte = new Date(`${hasta}T23:59:59.999`);

    const productWhere =
      q || categoria
        ? {
            categoryId: categoria || undefined,
            ...(q
              ? {
                  OR: [
                    { nombre: { contains: q, mode: 'insensitive' as const } },
                    { codigo: { contains: q, mode: 'insensitive' as const } },
                  ],
                }
              : {}),
          }
        : undefined;

    const where = {
      productId: productId || undefined,
      createdAt: Object.keys(createdAtWhere).length ? createdAtWhere : undefined,
      product: productWhere,
    };

    const [items, total] = await Promise.all([
      prisma.restock.findMany({
        where,
        include: { product: { select: { nombre: true, codigo: true } }, adminUser: { select: { nombre: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.restock.count({ where }),
    ]);
    res.json({ items, total, page, pageSize });
  }),
);

const lineSchema = z.object({
  productId: z.string(),
  tipo: z.enum(['UNIDADES', 'PAQUETES']),
  cantidad: z.number().int().min(1),
  // Optional price correction applied together with this restock — refers
  // to precio/precioCosto (tipo UNIDADES) or precioPaquete/precioCostoPaquete
  // (tipo PAQUETES). Omitted means "don't touch the price this time".
  precioCosto: z.number().int().min(0).optional(),
  precioVenta: z.number().int().min(0).optional(),
  // Lets the admin set/change/clear which supplier restocked this product,
  // right from the same dialog — omitted means "leave it as is".
  supplierId: z.string().nullable().optional(),
});
const restockSchema = z.object({ lines: z.array(lineSchema).min(1) });

adminRestocksRouter.post(
  '/',
  requireRole(...CATALOG_ROLES),
  asyncHandler(async (req, res) => {
    const { lines } = restockSchema.parse(req.body);
    const products = await prisma.product.findMany({ where: { id: { in: lines.map((l) => l.productId) } } });
    if (products.length !== new Set(lines.map((l) => l.productId)).size) {
      throw new HttpError(400, 'Uno o más productos no existen');
    }
    const supplierIds = lines.map((l) => l.supplierId).filter((id): id is string => !!id);
    if (supplierIds.length) {
      const supplierCount = await prisma.supplier.count({ where: { id: { in: supplierIds } } });
      if (supplierCount !== new Set(supplierIds).size) throw new HttpError(400, 'Uno o más proveedores no existen');
    }
    for (const line of lines) {
      const product = products.find((p) => p.id === line.productId)!;
      if (line.tipo === 'PAQUETES' && !product.ventaConjuntoActivo) {
        throw new HttpError(400, `"${product.nombre}" no se vende por pack — reponé por unidades`);
      }
      if (line.tipo === 'UNIDADES' && product.ventaConjuntoActivo && !product.ventaUnidadActiva) {
        throw new HttpError(400, `"${product.nombre}" se vende solo por paquete — no maneja unidades sueltas`);
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const line of lines) {
        const product = products.find((p) => p.id === line.productId)!;
        const next =
          line.tipo === 'PAQUETES'
            ? computeStockIncrementPaquetes(product, line.cantidad)
            : computeStockIncrementUnidades(product, line.cantidad);
        const unidadesAgregadas = line.tipo === 'PAQUETES' ? line.cantidad * product.ventaConjuntoUnidades : line.cantidad;

        const priceUpdate =
          line.tipo === 'PAQUETES'
            ? {
                ...(line.precioCosto !== undefined ? { precioCostoPaquete: line.precioCosto } : {}),
                ...(line.precioVenta !== undefined ? { precioPaquete: line.precioVenta } : {}),
              }
            : {
                ...(line.precioCosto !== undefined ? { precioCosto: line.precioCosto } : {}),
                ...(line.precioVenta !== undefined ? { precio: line.precioVenta } : {}),
              };

        const supplierUpdate = line.supplierId !== undefined ? { supplierId: line.supplierId } : {};
        await tx.product.update({ where: { id: product.id }, data: { ...next, ...priceUpdate, ...supplierUpdate } });
        const restock = await tx.restock.create({
          data: {
            productId: product.id,
            tipo: line.tipo,
            cantidad: line.cantidad,
            unidadesAgregadas,
            precioCosto: line.precioCosto,
            precioVenta: line.precioVenta,
            adminUserId: req.adminUser!.id,
          },
          include: { product: { select: { nombre: true, codigo: true } }, adminUser: { select: { nombre: true } } },
        });
        results.push(restock);
      }
      return results;
    });

    res.status(201).json(created);
  }),
);
