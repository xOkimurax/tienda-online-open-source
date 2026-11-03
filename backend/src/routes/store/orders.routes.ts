import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { asyncHandler, HttpError } from '@/lib/asyncHandler';
import { requireCustomer } from '@/middleware/customerAuth';
import { uploadComprobante, publicUrlFor } from '@/lib/upload';
import { stripe, toStripeAmount } from '@/lib/stripe';
import { env } from '@/env';
import { transitionOrderStatus, clearCartItemsForOrder } from '@/lib/orderStock';
import { renderOrderTicketPdf } from '@/lib/orderTicket';

export const storeOrdersRouter = Router();

storeOrdersRouter.get(
  '/',
  requireCustomer,
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: { customerId: req.customer!.id },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  }),
);

storeOrdersRouter.get(
  '/:id',
  requireCustomer,
  asyncHandler(async (req, res) => {
    // Pulls in each line item's current product photos (nullable — the
    // product may have since been edited or deleted) so the order detail
    // page can show a thumbnail next to its name and open a full-screen
    // lightbox on click, same as the admin review dialog.
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: {
            product: {
              include: {
                imagenes: { orderBy: { orden: 'asc' } },
                category: true,
              },
            },
          },
        },
      },
    });
    if (!order || order.customerId !== req.customer!.id) throw new HttpError(404, 'Orden no encontrada');
    res.json(order);
  }),
);

// Only offered once a pedido is genuinely ENTREGADO — this is meant as a
// finished purchase's proof-of-purchase, not a running receipt for an order
// still in flight. If the customer later disputes something, support looks
// up this same numero in /admin/pedidos and compares against what's printed
// here — it's a paper trail, not a signed/tamper-proof document.
storeOrdersRouter.get(
  '/:id/ticket',
  requireCustomer,
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true, customer: true },
    });
    if (!order || order.customerId !== req.customer!.id) throw new HttpError(404, 'Orden no encontrada');
    if (order.estado !== 'ENTREGADO') throw new HttpError(400, 'El ticket solo está disponible una vez que el pedido fue entregado');

    const branding = await prisma.brandingConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ticket-${order.numero}.pdf"`);
    const doc = renderOrderTicketPdf(
      { ...order, customer: order.customer ? { nombre: order.customer.nombre, email: order.customer.email } : null },
      branding.nombre,
    );
    doc.pipe(res);
  }),
);

const updateOrderSchema = z.object({
  metodoPago: z.enum(['tarjeta', 'transferencia']).optional(),
  tipoEntrega: z.enum(['RETIRO_LOCAL', 'ENVIO_DOMICILIO']).optional(),
  addressId: z.string().optional(),
});

// While an order is still PENDIENTE, nothing has actually been charged or
// processed yet — so the customer can freely change delivery and payment
// method when resuming from "Continuar con el pago", not just re-submit
// whatever was picked originally.
storeOrdersRouter.patch(
  '/:id',
  requireCustomer,
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order || order.customerId !== req.customer!.id) throw new HttpError(404, 'Orden no encontrada');
    if (order.estado !== 'PENDIENTE') throw new HttpError(400, 'Esta orden ya no admite cambios');
    const data = updateOrderSchema.parse(req.body);

    if (data.metodoPago) {
      const branding = await prisma.brandingConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
      if (data.metodoPago === 'tarjeta' && !branding.pagoTarjetaActivo) {
        throw new HttpError(400, 'El pago con tarjeta no está disponible en este momento');
      }
      if (data.metodoPago === 'transferencia' && !branding.pagoTransferenciaActivo) {
        throw new HttpError(400, 'El pago por transferencia no está disponible en este momento');
      }
    }

    let shippingSnapshot: {
      envioNombre?: string | null;
      envioCi?: string | null;
      envioCelular?: string | null;
      envioCiudad?: string | null;
      envioBarrio?: string | null;
    } = {};
    if (data.tipoEntrega === 'ENVIO_DOMICILIO') {
      if (!data.addressId) throw new HttpError(400, 'Falta la dirección de envío');
      const address = await prisma.customerAddress.findUnique({ where: { id: data.addressId } });
      if (!address || address.customerId !== req.customer!.id) throw new HttpError(400, 'Dirección de envío inválida');
      shippingSnapshot = {
        envioNombre: address.nombre,
        envioCi: address.ci,
        envioCelular: address.celular,
        envioCiudad: address.ciudad,
        envioBarrio: address.barrio,
      };
    } else if (data.tipoEntrega === 'RETIRO_LOCAL') {
      shippingSnapshot = { envioNombre: null, envioCi: null, envioCelular: null, envioCiudad: null, envioBarrio: null };
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        ...(data.metodoPago ? { metodoPago: data.metodoPago === 'tarjeta' ? 'TARJETA' : 'TRANSFERENCIA' } : {}),
        ...(data.tipoEntrega ? { tipoEntrega: data.tipoEntrega } : {}),
        ...shippingSnapshot,
      },
      include: { items: true },
    });
    res.json(updated);
  }),
);

storeOrdersRouter.post(
  '/:id/pay',
  requireCustomer,
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!order || order.customerId !== req.customer!.id) throw new HttpError(404, 'Orden no encontrada');
    if (order.estado !== 'PENDIENTE' || order.metodoPago !== 'TARJETA') {
      throw new HttpError(400, 'Esta orden no admite continuar el pago con tarjeta en este momento');
    }
    if (!stripe) throw new HttpError(500, 'Stripe no está configurado');

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      currency: env.STRIPE_CURRENCY,
      line_items: order.items.map((it) => ({
        price_data: {
          currency: env.STRIPE_CURRENCY,
          unit_amount: toStripeAmount(it.precio),
          product_data: { name: it.nombre },
        },
        quantity: it.cantidad,
      })),
      metadata: { orderId: order.id, orderNumero: order.numero },
      success_url: `${env.STORE_APP_URL}/pedidos/${order.id}?pago=exito`,
      cancel_url: `${env.STORE_APP_URL}/pedidos/${order.id}?pago=cancelado`,
    });
    await prisma.order.update({ where: { id: order.id }, data: { stripeCheckoutSessionId: session.id } });
    res.json({ checkoutUrl: session.url });
  }),
);

// Called when the customer lands back on /pedidos/:id?pago=cancelado from
// Stripe's cancel_url — an abandoned card checkout otherwise leaves the order
// stuck PENDIENTE forever with a "Continuar con el pago" button. Only cancels
// orders that are still genuinely pending card payment, so a race where the
// payment actually went through (webhook beat the redirect) is never clobbered.
storeOrdersRouter.post(
  '/:id/cancel-abandoned',
  requireCustomer,
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!order || order.customerId !== req.customer!.id) throw new HttpError(404, 'Orden no encontrada');
    if (order.estado === 'PENDIENTE' && order.metodoPago === 'TARJETA') {
      await transitionOrderStatus(order.id, 'CANCELADO');
      const updated = await prisma.order.findUnique({ where: { id: order.id }, include: { items: true } });
      return res.json(updated);
    }
    res.json(order);
  }),
);

storeOrdersRouter.post(
  '/:id/comprobante',
  requireCustomer,
  ...uploadComprobante.single('comprobante'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'No se recibió un archivo');
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!order || order.customerId !== req.customer!.id) throw new HttpError(404, 'Orden no encontrada');

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { comprobanteUrl: publicUrlFor(req.file.filename), estado: 'PROCESANDO' },
    });
    // Nothing left for the customer to do until an admin reviews the
    // transfer — same reasoning as the existence-review case in
    // checkout.routes.ts.
    await clearCartItemsForOrder(order);
    res.json(updated);
  }),
);
