import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import { env } from '@/env';
import { adminRouter } from '@/routes/admin';
import { storeRouter } from '@/routes/store';
import { stripeWebhookRouter } from '@/routes/store/stripeWebhook.routes';
import { errorHandler } from '@/middleware/errorHandler';

export const app = express();

// Traffic arrives via the Cloudflare tunnel (cloudflared), which sets
// X-Forwarded-For to the real client IP — without this, req.ip would always
// be the tunnel's loopback address, and per-IP rate limiting would lump
// every visitor into one shared bucket instead of isolating attackers.
app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cookieParser());

// Must be mounted before express.json() — Stripe needs the raw request body
// to verify the webhook signature.
app.use('/api/store/stripe-webhook', stripeWebhookRouter);

app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR)));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/admin', adminRouter);
app.use('/api/store', storeRouter);

app.use(errorHandler);
