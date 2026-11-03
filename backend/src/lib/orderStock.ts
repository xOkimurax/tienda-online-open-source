import { OrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  computeStockDecrement,
  computeStockDecrementPaquetes,
  computeStockIncrementPaquetes,
  computeStockIncrementUnidades,
} from '@/lib/stock';

// Stock is only "spent" once an order's payment is actually confirmed —
// never at checkout time, so an abandoned bank transfer or a Stripe session
// the customer never completes doesn't make a product look sold out.
const STOCK_HELD_STATES: OrderStatus[] = ['PAGO_CONFIRMADO', 'ENVIADO', 'ENTREGADO'];

// Removes exactly the product/variante/tipoVenta combos this order covers
// from the customer's cart — not the whole cart, so anything added
// afterward is left alone. Shared by every point where an order stops being
// something the customer could still retry/abandon and becomes something
// only the store can act on next: existence review, transfer proof
// submitted, or payment actually confirmed. Deliberately NOT called while an
// order is still plain PENDIENTE (unpaid tarjeta or transferencia before a
// comprobante exists) — that's the abandonable state where the customer
// might resume the same checkout, so their cart has to still be there.
export async function clearCartItemsForOrder(order: { customerId: string | null; items: { productId: string | null; variante: string; tipoVenta: 'UNIDAD' | 'PAQUETE' }[] }) {
  if (!order.customerId) return;
  const keys = order.items.filter((it) => it.productId);
  if (keys.length === 0) return;
  await prisma.cartItem.deleteMany({
    where: {
      customerId: order.customerId,
      OR: keys.map((it) => ({ productId: it.productId!, varianteLabel: it.variante, tipoVenta: it.tipoVenta })),
    },
  });
}

// Moves an order to `estado`, decrementing stock the first time it reaches a
// held state and restocking it if it later leaves one (cancelled/refunded
// after having been confirmed) — idempotent either way via stockDecremented.
// Each item's tipoVenta decides which pair of helpers applies: UNIDAD drains/
// replenishes unidadesSueltas first (breaking/merging whole packs only as
// needed), while PAQUETE moves whole sealed packs and never touches
// unidadesSueltas (see lib/stock.ts).
export async function transitionOrderStatus(orderId: string, estado: OrderStatus) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return null;

  const shouldHold = STOCK_HELD_STATES.includes(estado);
  const direction = shouldHold && !order.stockDecremented ? 'consume' : !shouldHold && order.stockDecremented ? 'restock' : null;

  const result = await prisma.$transaction(async (tx) => {
    if (direction) {
      for (const item of order.items) {
        if (!item.productId) continue;
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) continue;
        const next =
          item.tipoVenta === 'PAQUETE'
            ? direction === 'consume'
              ? computeStockDecrementPaquetes(product, item.cantidad)
              : computeStockIncrementPaquetes(product, item.cantidad)
            : direction === 'consume'
              ? computeStockDecrement(product, item.cantidad)
              : computeStockIncrementUnidades(product, item.cantidad);
        await tx.product.update({ where: { id: item.productId }, data: next });
      }
    }
    return tx.order.update({ where: { id: orderId }, data: { estado, stockDecremented: shouldHold } });
  });

  if (estado === 'PAGO_CONFIRMADO' && direction === 'consume') {
    await clearCartItemsForOrder(order);
  }

  return result;
}
