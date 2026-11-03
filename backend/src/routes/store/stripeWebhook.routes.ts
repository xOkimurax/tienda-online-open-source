import { Router } from 'express';
import express from 'express';
import { stripe } from '@/lib/stripe';
import { env } from '@/env';
import { prisma } from '@/lib/prisma';
import { transitionOrderStatus } from '@/lib/orderStock';

export const stripeWebhookRouter = Router();

// Mounted with express.raw() (not json()) — Stripe signature verification
// needs the exact original request body bytes.
stripeWebhookRouter.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) return res.status(500).send('Stripe no configurado');

  let event;
  try {
    const signature = req.headers['stripe-signature'] as string;
    event = stripe.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook signature error: ${(err as Error).message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as { metadata?: { orderId?: string } };
    const orderId = session.metadata?.orderId;
    if (orderId) {
      await transitionOrderStatus(orderId, 'PAGO_CONFIRMADO');
    }
  }

  // Fallback for silent abandonment (tab/browser closed without ever hitting
  // cancel_url): Stripe expires an unpaid session on its own after checkout
  // Session's expiry window, so this is the safety net that eventually
  // un-sticks an order the client-side cancel_url redirect never got to run.
  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as { metadata?: { orderId?: string } };
    const orderId = session.metadata?.orderId;
    if (orderId) {
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (order && order.estado === 'PENDIENTE' && order.metodoPago === 'TARJETA') {
        await transitionOrderStatus(orderId, 'CANCELADO');
      }
    }
  }

  res.json({ received: true });
});
