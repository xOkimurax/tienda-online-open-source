import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { asyncHandler, HttpError } from '@/lib/asyncHandler';
import { requireCustomer } from '@/middleware/customerAuth';

export const storeCartRouter = Router();

const include = {
  product: {
    select: {
      nombre: true,
      precio: true,
      precioPaquete: true,
      categoryId: true,
      icon: true,
      requiereVerificacion: true,
    },
  },
};

function listCart(customerId: string) {
  return prisma.cartItem.findMany({ where: { customerId }, include, orderBy: { createdAt: 'asc' } });
}

storeCartRouter.get(
  '/',
  requireCustomer,
  asyncHandler(async (req, res) => {
    res.json(await listCart(req.customer!.id));
  }),
);

const addSchema = z.object({
  productId: z.string(),
  varianteLabel: z.string().default(''),
  tipoVenta: z.enum(['UNIDAD', 'PAQUETE']).default('UNIDAD'),
});

// Adding an already-in-cart product+variante+tipoVenta combo just bumps its
// cantidad by one, matching the old localStorage cart's behaviour.
storeCartRouter.post(
  '/',
  requireCustomer,
  asyncHandler(async (req, res) => {
    const data = addSchema.parse(req.body);
    const product = await prisma.product.findUnique({ where: { id: data.productId } });
    if (!product) throw new HttpError(404, 'Producto no encontrado');

    const existing = await prisma.cartItem.findUnique({
      where: {
        customerId_productId_varianteLabel_tipoVenta: {
          customerId: req.customer!.id,
          productId: data.productId,
          varianteLabel: data.varianteLabel,
          tipoVenta: data.tipoVenta,
        },
      },
    });
    if (existing) {
      await prisma.cartItem.update({ where: { id: existing.id }, data: { cantidad: { increment: 1 } } });
    } else {
      await prisma.cartItem.create({
        data: { customerId: req.customer!.id, productId: data.productId, varianteLabel: data.varianteLabel, tipoVenta: data.tipoVenta },
      });
    }
    res.status(201).json(await listCart(req.customer!.id));
  }),
);

const updateSchema = z.object({ cantidad: z.number().int().min(1) });

storeCartRouter.patch(
  '/:id',
  requireCustomer,
  asyncHandler(async (req, res) => {
    const { cantidad } = updateSchema.parse(req.body);
    const item = await prisma.cartItem.findUnique({ where: { id: req.params.id } });
    if (!item || item.customerId !== req.customer!.id) throw new HttpError(404, 'No encontrado en el carrito');
    await prisma.cartItem.update({ where: { id: item.id }, data: { cantidad } });
    res.json(await listCart(req.customer!.id));
  }),
);

storeCartRouter.delete(
  '/:id',
  requireCustomer,
  asyncHandler(async (req, res) => {
    const item = await prisma.cartItem.findUnique({ where: { id: req.params.id } });
    if (!item || item.customerId !== req.customer!.id) throw new HttpError(404, 'No encontrado en el carrito');
    await prisma.cartItem.delete({ where: { id: item.id } });
    res.json(await listCart(req.customer!.id));
  }),
);

storeCartRouter.delete(
  '/',
  requireCustomer,
  asyncHandler(async (req, res) => {
    await prisma.cartItem.deleteMany({ where: { customerId: req.customer!.id } });
    res.status(204).end();
  }),
);
