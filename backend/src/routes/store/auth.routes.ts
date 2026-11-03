import { Router } from 'express';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '@/lib/prisma';
import { comparePassword, hashPassword } from '@/lib/password';
import {
  generatePasswordResetToken,
  generateRefreshToken,
  hashPasswordResetToken,
  hashRefreshToken,
  refreshTtlMs,
  signCustomerAccessToken,
} from '@/lib/jwt';
import { asyncHandler, HttpError } from '@/lib/asyncHandler';
import { requireCustomer } from '@/middleware/customerAuth';
import { sendMail } from '@/lib/mailer';
import { renderEmailHtml } from '@/lib/emailTemplate';
import { env } from '@/env';
import { authRateLimiter, loginRateLimiter } from '@/lib/rateLimit';

export const storeAuthRouter = Router();
const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

const REFRESH_COOKIE = 'customer_refresh_token';
const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/api/store/auth',
};

async function issueSession(customerId: string, res: import('express').Response) {
  const accessToken = signCustomerAccessToken({ sub: customerId, kind: 'customer' });
  const { token, tokenHash } = generateRefreshToken();
  await prisma.customerRefreshToken.create({
    data: { customerId, tokenHash, expiresAt: new Date(Date.now() + refreshTtlMs()) },
  });
  res.cookie(REFRESH_COOKIE, token, { ...cookieOpts, maxAge: refreshTtlMs() });
  return accessToken;
}

function toPublicCustomer(c: { id: string; nombre: string; email: string; avatarUrl: string | null }) {
  return { id: c.id, nombre: c.nombre, email: c.email, avatarUrl: c.avatarUrl };
}

const registerSchema = z.object({
  nombre: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

storeAuthRouter.post(
  '/register',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const existing = await prisma.customer.findUnique({ where: { email: data.email } });
    if (existing) throw new HttpError(409, 'Ya existe una cuenta con ese email');
    const passwordHash = await hashPassword(data.password);
    const customer = await prisma.customer.create({
      data: { nombre: data.nombre, email: data.email, passwordHash },
    });
    const accessToken = await issueSession(customer.id, res);
    res.status(201).json({ accessToken, customer: toPublicCustomer(customer) });
  }),
);

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

storeAuthRouter.post(
  '/login',
  loginRateLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const customer = await prisma.customer.findUnique({ where: { email } });
    if (!customer?.passwordHash) throw new HttpError(401, 'Credenciales inválidas');
    const ok = await comparePassword(password, customer.passwordHash);
    if (!ok) throw new HttpError(401, 'Credenciales inválidas');
    const accessToken = await issueSession(customer.id, res);
    res.json({ accessToken, customer: toPublicCustomer(customer) });
  }),
);

// Frontend uses Google Identity Services to get an ID token client-side,
// then hands it here — no server-side OAuth redirect dance needed.
const googleSchema = z.object({ idToken: z.string().min(1) });

storeAuthRouter.post(
  '/google',
  asyncHandler(async (req, res) => {
    const { idToken } = googleSchema.parse(req.body);
    if (!env.GOOGLE_CLIENT_ID) throw new HttpError(500, 'Google OAuth no está configurado');

    const ticket = await googleClient.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID }).catch(() => null);
    const payload = ticket?.getPayload();
    if (!payload?.email) throw new HttpError(401, 'Token de Google inválido');

    const customer = await prisma.customer.upsert({
      where: { email: payload.email },
      update: { googleId: payload.sub, avatarUrl: payload.picture ?? undefined },
      create: {
        email: payload.email,
        nombre: payload.name ?? payload.email,
        googleId: payload.sub,
        avatarUrl: payload.picture,
      },
    });
    const accessToken = await issueSession(customer.id, res);
    res.json({ accessToken, customer: toPublicCustomer(customer) });
  }),
);

storeAuthRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new HttpError(401, 'Sesión no encontrada');
    const tokenHash = hashRefreshToken(token);
    const stored = await prisma.customerRefreshToken.findUnique({ where: { tokenHash }, include: { customer: true } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new HttpError(401, 'Sesión inválida o expirada');
    }
    await prisma.customerRefreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    const accessToken = await issueSession(stored.customerId, res);
    res.json({ accessToken, customer: toPublicCustomer(stored.customer) });
  }),
);

storeAuthRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) {
      const tokenHash = hashRefreshToken(token);
      await prisma.customerRefreshToken.updateMany({ where: { tokenHash }, data: { revokedAt: new Date() } });
    }
    res.clearCookie(REFRESH_COOKIE, cookieOpts);
    res.json({ ok: true });
  }),
);

storeAuthRouter.get(
  '/me',
  requireCustomer,
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findUnique({ where: { id: req.customer!.id } });
    if (!customer) throw new HttpError(404, 'No encontrado');
    res.json(toPublicCustomer(customer));
  }),
);

const forgotPasswordSchema = z.object({ email: z.string().email() });

// Always responds the same way (200, generic body) whether or not the email
// belongs to an account — never reveals existence, so this can't be used to
// enumerate registered customers. The actual outcome (token issued + email
// sent, or nothing) only ever happens server-side.
storeAuthRouter.post(
  '/forgot-password',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    const customer = await prisma.customer.findUnique({ where: { email } });

    if (customer) {
      const { token, tokenHash } = generatePasswordResetToken();
      await prisma.customer.update({
        where: { id: customer.id },
        data: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: new Date(Date.now() + 60 * 60 * 1000) },
      });
      const resetUrl = `${env.STORE_APP_URL}/auth/restablecer?token=${token}`;
      const branding = await prisma.brandingConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
      const html = renderEmailHtml({
        brandName: branding.nombre,
        logoUrl: branding.logoUrl,
        heading: 'Recuperá tu contraseña',
        paragraphs: [
          `Recibimos un pedido para restablecer la contraseña de tu cuenta en ${branding.nombre}.`,
          'Hacé clic en el botón de abajo para elegir una nueva contraseña. Este enlace vence en 1 hora.',
        ],
        cta: { label: 'Restablecer contraseña', url: resetUrl },
        footerNote: 'Si no pediste este cambio, podés ignorar este correo — tu contraseña actual sigue funcionando.',
      });
      await sendMail(customer.email, 'Recuperá tu contraseña', html);
    }

    res.json({ ok: true });
  }),
);

const resetPasswordSchema = z.object({ token: z.string().min(1), password: z.string().min(8) });

storeAuthRouter.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const { token, password } = resetPasswordSchema.parse(req.body);
    const tokenHash = hashPasswordResetToken(token);
    const customer = await prisma.customer.findUnique({ where: { passwordResetTokenHash: tokenHash } });
    if (!customer || !customer.passwordResetExpiresAt || customer.passwordResetExpiresAt < new Date()) {
      throw new HttpError(400, 'El enlace de recuperación es inválido o expiró');
    }
    const passwordHash = await hashPassword(password);
    await prisma.customer.update({
      where: { id: customer.id },
      data: { passwordHash, passwordResetTokenHash: null, passwordResetExpiresAt: null },
    });
    res.json({ ok: true });
  }),
);
