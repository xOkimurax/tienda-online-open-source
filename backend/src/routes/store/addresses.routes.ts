import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { asyncHandler, HttpError } from '@/lib/asyncHandler';
import { requireCustomer } from '@/middleware/customerAuth';

export const storeAddressesRouter = Router();

const addressSchema = z.object({
  nombre: z.string().min(1),
  ci: z.string().min(1),
  celular: z.string().min(1),
  ciudad: z.string().min(1),
  barrio: z.string().min(1),
  esPredeterminada: z.boolean().default(false),
});

async function clearOtherDefaults(customerId: string, exceptId?: string) {
  await prisma.customerAddress.updateMany({
    where: { customerId, id: exceptId ? { not: exceptId } : undefined },
    data: { esPredeterminada: false },
  });
}

storeAddressesRouter.get(
  '/',
  requireCustomer,
  asyncHandler(async (req, res) => {
    const addresses = await prisma.customerAddress.findMany({
      where: { customerId: req.customer!.id },
      orderBy: [{ esPredeterminada: 'desc' }, { createdAt: 'desc' }],
    });
    res.json(addresses);
  }),
);

storeAddressesRouter.post(
  '/',
  requireCustomer,
  asyncHandler(async (req, res) => {
    const data = addressSchema.parse(req.body);
    const address = await prisma.customerAddress.create({
      data: { ...data, customerId: req.customer!.id },
    });
    if (data.esPredeterminada) await clearOtherDefaults(req.customer!.id, address.id);
    res.status(201).json(address);
  }),
);

storeAddressesRouter.put(
  '/:id',
  requireCustomer,
  asyncHandler(async (req, res) => {
    const existing = await prisma.customerAddress.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.customerId !== req.customer!.id) throw new HttpError(404, 'Dirección no encontrada');
    const data = addressSchema.parse(req.body);
    const address = await prisma.customerAddress.update({ where: { id: existing.id }, data });
    if (data.esPredeterminada) await clearOtherDefaults(req.customer!.id, address.id);
    res.json(address);
  }),
);

storeAddressesRouter.delete(
  '/:id',
  requireCustomer,
  asyncHandler(async (req, res) => {
    const existing = await prisma.customerAddress.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.customerId !== req.customer!.id) throw new HttpError(404, 'Dirección no encontrada');
    await prisma.customerAddress.delete({ where: { id: existing.id } });
    res.status(204).end();
  }),
);
