import Stripe from 'stripe';
import { env } from '@/env';

export const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;

// PYG (Guaraní) is one of Stripe's zero-decimal currencies (like JPY), so the
// integer Gs amount maps straight to `unit_amount` — no *100 conversion.
export function toStripeAmount(gs: number) {
  return Math.round(gs);
}
