import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { asyncHandler, HttpError } from '@/lib/asyncHandler';
import { optionalCustomer } from '@/middleware/customerAuth';
import { stripe, toStripeAmount } from '@/lib/stripe';
import { env } from '@/env';
import { disponibleParaVenta } from '@/lib/stock';
import { clearCartItemsForOrder } from '@/lib/orderStock';

export const storeCheckoutRouter = Router();

const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string(),
        cantidad: z.number().int().min(1),
        variante: z.string().default(''),
        tipoVenta: z.enum(['UNIDAD', 'PAQUETE']).default('UNIDAD'),
      }),
    )
    .min(1),
  metodoPago: z.enum(['tarjeta', 'transferencia']),
  couponCode: z.string().optional(),
  tipoEntrega: z.enum(['RETIRO_LOCAL', 'ENVIO_DOMICILIO']).default('RETIRO_LOCAL'),
  addressId: z.string().optional(),
});

type CheckoutItem = z.infer<typeof checkoutSchema>['items'][number];
type Product = Awaited<ReturnType<typeof prisma.product.findMany>>[number];

async function nextOrderNumero() {
  const count = await prisma.order.count();
  return `ORD-${1000 + count + 1}`;
}

function buildItemsData(items: CheckoutItem[], products: Product[]) {
  return items.map((item) => {
    const product = products.find((p) => p.id === item.productId)!;
    const precio = item.tipoVenta === 'PAQUETE' ? product.precioPaquete : product.precio;
    return {
      productId: product.id,
      nombre: product.nombre,
      variante: item.variante,
      tipoVenta: item.tipoVenta,
      cantidad: item.cantidad,
      precio,
    };
  });
}

function subtotalOf(itemsData: ReturnType<typeof buildItemsData>) {
  return itemsData.reduce((sum, it) => sum + it.precio * it.cantidad, 0);
}

storeCheckoutRouter.post(
  '/',
  optionalCustomer,
  asyncHandler(async (req, res) => {
    const data = checkoutSchema.parse(req.body);

    // Defense in depth — the storefront UI only ever offers enabled methods,
    // but a crafted request could still ask for a disabled one directly.
    const branding = await prisma.brandingConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
    if (data.metodoPago === 'tarjeta' && !branding.pagoTarjetaActivo) {
      throw new HttpError(400, 'El pago con tarjeta no está disponible en este momento');
    }
    if (data.metodoPago === 'transferencia' && !branding.pagoTransferenciaActivo) {
      throw new HttpError(400, 'El pago por transferencia no está disponible en este momento');
    }

    let shippingSnapshot: {
      envioNombre?: string;
      envioCi?: string;
      envioCelular?: string;
      envioCiudad?: string;
      envioBarrio?: string;
    } = {};
    if (data.tipoEntrega === 'ENVIO_DOMICILIO') {
      if (!data.addressId) throw new HttpError(400, 'Falta la dirección de envío');
      const address = await prisma.customerAddress.findUnique({ where: { id: data.addressId } });
      if (!address || address.customerId !== req.customer?.id) throw new HttpError(400, 'Dirección de envío inválida');
      shippingSnapshot = {
        envioNombre: address.nombre,
        envioCi: address.ci,
        envioCelular: address.celular,
        envioCiudad: address.ciudad,
        envioBarrio: address.barrio,
      };
    }

    const products = await prisma.product.findMany({
      where: { id: { in: data.items.map((i) => i.productId) } },
    });
    if (products.length !== data.items.length) throw new HttpError(400, 'Uno o más productos no existen');

    const stockProblems = data.items
      .map((item) => {
        const product = products.find((p) => p.id === item.productId)!;
        const disponible = disponibleParaVenta(product, item.tipoVenta);
        if (disponible >= item.cantidad) return null;
        return { productId: product.id, nombre: product.nombre, disponible, solicitado: item.cantidad };
      })
      .filter((p): p is { productId: string; nombre: string; disponible: number; solicitado: number } => p !== null);
    if (stockProblems.length > 0) {
      const detalle = stockProblems.map((p) => `"${p.nombre}" (disponible: ${p.disponible}, solicitado: ${p.solicitado})`).join(', ');
      throw new HttpError(400, `Stock insuficiente para ${detalle}`, { problems: stockProblems });
    }

    // A cart can be a mix of "needs existence verification" and "doesn't" —
    // that used to lump everything into a single VERIFICANDO_EXISTENCIA
    // order, stalling items that could've been paid immediately. Now it
    // splits into up to two separate orders: one holding only the
    // verification-required items (VERIFICANDO_EXISTENCIA), and one with
    // everything else, which proceeds through the normal payment flow
    // exactly like a cart that never needed verification at all.
    const verifInput = data.items.filter((item) => products.find((p) => p.id === item.productId)!.requiereVerificacion);
    const normalInput = data.items.filter((item) => !products.find((p) => p.id === item.productId)!.requiereVerificacion);

    const verifItemsData = buildItemsData(verifInput, products);
    const normalItemsData = buildItemsData(normalInput, products);
    const subtotalVerif = subtotalOf(verifItemsData);
    const subtotalNormal = subtotalOf(normalItemsData);
    const subtotalAll = subtotalVerif + subtotalNormal;

    let coupon = null as Awaited<ReturnType<typeof prisma.coupon.findUnique>> | null;
    let discountVerif = 0;
    let discountNormal = 0;
    if (data.couponCode) {
      coupon = await prisma.coupon.findUnique({ where: { codigo: data.couponCode.toUpperCase() } });
      if (!coupon || !coupon.activo) throw new HttpError(400, 'Cupón inválido');
      let discountTotal = 0;
      if (coupon.tipo === 'PORCENTAJE') discountTotal = Math.round(subtotalAll * (coupon.valor / 100));
      if (coupon.tipo === 'MONTO_FIJO') discountTotal = Math.min(coupon.valor, subtotalAll);
      // ENVIO_GRATIS doesn't discount the product subtotal here — shipping isn't priced in this model.
      // Split proportionally by each side's share of the combined subtotal so
      // the two orders' totals still add up to exactly what one unified
      // order would've charged — a flat MONTO_FIJO discount applied in full
      // to both sides would double-discount the customer.
      if (subtotalAll > 0 && discountTotal > 0) {
        discountVerif = Math.round(discountTotal * (subtotalVerif / subtotalAll));
        discountNormal = discountTotal - discountVerif;
      }
    }

    const totalVerif = subtotalVerif - discountVerif;
    const totalNormal = subtotalNormal - discountNormal;

    const response: { verificationOrder?: unknown; normalOrder?: unknown; checkoutUrl?: string } = {};

    if (verifInput.length > 0) {
      const numero = await nextOrderNumero();
      const order = await prisma.order.create({
        data: {
          numero,
          customerId: req.customer?.id,
          total: totalVerif,
          couponCode: coupon?.codigo,
          estado: 'VERIFICANDO_EXISTENCIA',
          metodoPago: null,
          tipoEntrega: data.tipoEntrega,
          ...shippingSnapshot,
          items: { create: verifItemsData },
        },
        include: { items: true },
      });
      response.verificationOrder = order;
      // Nothing left for the customer to do until an admin reviews it — keeping
      // these items in the cart too would just invite adding them again.
      await clearCartItemsForOrder(order);
    }

    if (normalInput.length > 0) {
      const numero = await nextOrderNumero();
      const order = await prisma.order.create({
        data: {
          numero,
          customerId: req.customer?.id,
          total: totalNormal,
          couponCode: coupon?.codigo,
          estado: 'PENDIENTE',
          metodoPago: data.metodoPago === 'tarjeta' ? 'TARJETA' : 'TRANSFERENCIA',
          tipoEntrega: data.tipoEntrega,
          ...shippingSnapshot,
          items: { create: normalItemsData },
        },
        include: { items: true },
      });
      response.normalOrder = order;

      if (data.metodoPago === 'tarjeta') {
        if (!stripe) throw new HttpError(500, 'Stripe no está configurado');
        const session = await stripe.checkout.sessions.create({
          mode: 'payment',
          payment_method_types: ['card'],
          currency: env.STRIPE_CURRENCY,
          line_items: normalItemsData.map((it) => ({
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
        response.checkoutUrl = session.url ?? undefined;
      }
    }

    // Stock is intentionally NOT decremented here — only once an order's
    // payment is actually confirmed (see src/lib/orderStock.ts), so an
    // abandoned checkout never makes a product look unavailable.
    // Counted once per checkout attempt, not once per resulting order —
    // splitting a cart shouldn't let one customer action burn two uses.
    if (coupon) await prisma.coupon.update({ where: { id: coupon.id }, data: { usos: { increment: 1 } } });

    res.status(201).json(response);
  }),
);
