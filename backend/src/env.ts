import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  // Where the customer-facing storefront lives — used to build Stripe
  // Checkout's success_url/cancel_url. Distinct from CORS_ORIGIN in case
  // they ever diverge, but should match it in practice.
  STORE_APP_URL: z.string().default('http://localhost:3000'),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  // Only the Client ID is needed — we verify Google Identity Services ID
  // tokens client-side, no server-side OAuth redirect flow / secret involved.
  GOOGLE_CLIENT_ID: z.string().optional().default(''),

  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
  STRIPE_CURRENCY: z.string().default('pyg'),

  // Brevo transactional email (app.brevo.com -> SMTP & API -> API Keys).
  // Left empty, the mailer just logs to console instead of sending.
  BREVO_API_KEY: z.string().optional().default(''),
  BREVO_SENDER_EMAIL: z.string().optional().default('no-reply@tienda.com'),
  BREVO_SENDER_NAME: z.string().optional().default('Tienda Online'),

  UPLOAD_DIR: z.string().default('./uploads'),
  PUBLIC_UPLOAD_BASE_URL: z.string().default('http://localhost:4000/uploads'),

  SEED_SUPER_ADMIN_EMAIL: z.string().email().default('admin@tienda.com'),
  SEED_SUPER_ADMIN_PASSWORD: z.string().default('CambiarEsta123!'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;
