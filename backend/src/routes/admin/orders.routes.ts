import { Router } from 'express';
import { z } from 'zod';
import { OrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { asyncHandler, HttpError } from '@/lib/asyncHandler';
import { requireRole } from '@/middleware/adminAuth';
import { sendMail } from '@/lib/mailer';
import { renderEmailHtml } from '@/lib/emailTemplate';
import { CUSTOMER_ORDER_STATE_LABEL } from '@/lib/labels';
import { transitionOrderStatus } from '@/lib/orderStock';
import { env } from '@/env';

export const adminOrdersRouter = Router();
const ORDER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SOPORTE'] as const;

// Line items snapshot nombre/precio at sale time, but the admin review
// dialog also wants the product's current photo/código/categoría for
// quick visual identification — pulled in via the (nullable) product
// relation, since the product may since have been edited or deleted. All
// images (not just the first) are fetched so the review dialog's lightbox
// can page through them like the customer-facing product page.
const include = {
  customer: true,
  items: {
    include: {
      product: {
        include: {
          imagenes: { orderBy: { orden: 'asc' as const } },
          category: true,
        },
      },
    },
  },
};

const OTRAS_EXCLUDED: OrderStatus[] = ['VERIFICANDO_EXISTENCIA', 'PROCESANDO'];

adminOrdersRouter.get(
  '/',
  requireRole(...ORDER_ROLES),
  asyncHandler(async (req, res) => {
    const { estado, q, metodoPago, desde, hasta, cuponCode, soloConCupon } = req.query as Record<string, string | undefined>;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 15));

    const estadoWhere =
      estado && estado !== 'Todas'
        ? estado === 'Otras'
          ? { estado: { notIn: OTRAS_EXCLUDED } }
          : { estado: estado as OrderStatus }
        : {};

    const couponWhere =
      soloConCupon === 'true'
        ? { couponCode: { not: null } }
        : cuponCode
          ? { couponCode: { contains: cuponCode, mode: 'insensitive' as const } }
          : {};

    const createdAtWhere: { gte?: Date; lte?: Date } = {};
    if (desde) createdAtWhere.gte = new Date(desde);
    if (hasta) createdAtWhere.lte = new Date(`${hasta}T23:59:59.999`);

    const where = {
      ...estadoWhere,
      ...couponWhere,
      metodoPago: metodoPago ? (metodoPago as 'TARJETA' | 'TRANSFERENCIA') : undefined,
      createdAt: Object.keys(createdAtWhere).length ? createdAtWhere : undefined,
      ...(q
        ? {
            OR: [
              { numero: { contains: q, mode: 'insensitive' as const } },
              { customer: { nombre: { contains: q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.order.findMany({ where, include, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.order.count({ where }),
    ]);

    res.json({ items, total, page, pageSize });
  }),
);

adminOrdersRouter.get(
  '/:id',
  requireRole(...ORDER_ROLES),
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include });
    if (!order) throw new HttpError(404, 'Orden no encontrada');
    res.json(order);
  }),
);

// Every order-status email shares the same branded shell (logo, colors,
// footer) and a "Ver mi pedido" link straight to that order's detail page —
// the previous version just said "your order is now X", forcing the
// customer to log in and hunt for it themselves.
async function notifyCustomer(
  orderId: string,
  opts: { subject: string; heading: string; paragraphs: string[]; includeItems?: boolean },
) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { customer: true, items: true } });
  if (!order?.customer?.email) return;
  const branding = await prisma.brandingConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  const html = renderEmailHtml({
    brandName: branding.nombre,
    logoUrl: branding.logoUrl,
    preheader: opts.paragraphs[0],
    heading: opts.heading,
    paragraphs: opts.paragraphs,
    items: opts.includeItems
      ? order.items.map((it) => ({ nombre: it.nombre, variante: it.variante || undefined, cantidad: it.cantidad, precio: it.precio }))
      : undefined,
    itemsTotal: opts.includeItems ? order.total : undefined,
    cta: { label: 'Ver mi pedido', url: `${env.STORE_APP_URL}/pedidos/${order.id}` },
  });
  await sendMail(order.customer.email, opts.subject, html);
}

adminOrdersRouter.post(
  '/:id/confirm-existence',
  requireRole(...ORDER_ROLES),
  asyncHandler(async (req, res) => {
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { estado: 'PENDIENTE', existenciaConfirmadaAt: new Date() },
    });
    await notifyCustomer(order.id, {
      subject: `Disponibilidad confirmada — pedido ${order.numero}`,
      heading: '¡Buenas noticias! Confirmamos tu pedido',
      paragraphs: [
        `Confirmamos la disponibilidad de todos los productos de tu pedido ${order.numero}. Ya podés continuar con el pago cuando quieras.`,
      ],
      includeItems: true,
    });
    res.json(order);
  }),
);

adminOrdersRouter.post(
  '/:id/reject-existence',
  requireRole(...ORDER_ROLES),
  asyncHandler(async (req, res) => {
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { estado: 'CANCELADO' },
    });
    await notifyCustomer(order.id, {
      subject: `Producto no disponible — pedido ${order.numero}`,
      heading: 'Tu pedido fue cancelado',
      paragraphs: [
        `Lamentablemente no pudimos confirmar la disponibilidad de uno o más productos de tu pedido ${order.numero}, así que lo cancelamos. No se te realizó ningún cobro.`,
      ],
      includeItems: true,
    });
    res.json(order);
  }),
);

adminOrdersRouter.post(
  '/:id/confirm-payment',
  requireRole(...ORDER_ROLES),
  asyncHandler(async (req, res) => {
    const order = await transitionOrderStatus(req.params.id, 'PAGO_CONFIRMADO');
    if (!order) throw new HttpError(404, 'Orden no encontrada');
    await notifyCustomer(order.id, {
      subject: `Pago confirmado — pedido ${order.numero}`,
      heading: '¡Confirmamos tu pago!',
      paragraphs: [`Recibimos el pago de tu pedido ${order.numero}. Ya estamos preparando todo para el envío.`],
      includeItems: true,
    });
    res.json(order);
  }),
);

const statusSchema = z.object({
  estado: z.enum([
    'VERIFICANDO_EXISTENCIA',
    'PENDIENTE',
    'PROCESANDO',
    'PAGO_CONFIRMADO',
    'ENVIADO',
    'ENTREGADO',
    'CANCELADO',
    'REEMBOLSADO',
  ]),
});

adminOrdersRouter.patch(
  '/:id/estado',
  requireRole(...ORDER_ROLES),
  asyncHandler(async (req, res) => {
    const { estado } = statusSchema.parse(req.body);
    const order = await transitionOrderStatus(req.params.id, estado);
    if (!order) throw new HttpError(404, 'Orden no encontrada');
    const label = CUSTOMER_ORDER_STATE_LABEL[estado];
    await notifyCustomer(order.id, {
      subject: `Novedades sobre tu pedido ${order.numero}`,
      heading: `Tu pedido ahora está "${label}"`,
      paragraphs: [`El estado de tu pedido ${order.numero} cambió a "${label}".`],
      includeItems: true,
    });
    res.json(order);
  }),
);
