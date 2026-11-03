import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { comparePassword, hashPassword } from '@/lib/password';
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshTtlMs,
  signAdminAccessToken,
} from '@/lib/jwt';
import { asyncHandler, HttpError } from '@/lib/asyncHandler';
import { requireAdmin } from '@/middleware/adminAuth';
import { loginRateLimiter } from '@/lib/rateLimit';

export const adminAuthRouter = Router();

const REFRESH_COOKIE = 'admin_refresh_token';
const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/api/admin/auth',
};

async function issueSession(adminUser: { id: string; rol: string }, res: import('express').Response) {
  const accessToken = signAdminAccessToken({ sub: adminUser.id, kind: 'admin', rol: adminUser.rol });
  const { token, tokenHash } = generateRefreshToken();
  await prisma.adminRefreshToken.create({
    data: {
      adminUserId: adminUser.id,
      tokenHash,
      expiresAt: new Date(Date.now() + refreshTtlMs()),
    },
  });
  res.cookie(REFRESH_COOKIE, token, { ...cookieOpts, maxAge: refreshTtlMs() });
  return accessToken;
}

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

adminAuthRouter.post(
  '/login',
  loginRateLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.adminUser.findUnique({ where: { email } });
    if (!user || !user.passwordHash || !user.activo) {
      throw new HttpError(401, 'Credenciales inválidas');
    }
    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) throw new HttpError(401, 'Credenciales inválidas');

    const accessToken = await issueSession(user, res);
    res.json({
      accessToken,
      user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
    });
  }),
);

adminAuthRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new HttpError(401, 'Sesión no encontrada');
    const tokenHash = hashRefreshToken(token);
    const stored = await prisma.adminRefreshToken.findUnique({ where: { tokenHash }, include: { adminUser: true } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date() || !stored.adminUser.activo) {
      throw new HttpError(401, 'Sesión inválida o expirada');
    }
    // Rotate: revoke the old refresh token and issue a new pair.
    await prisma.adminRefreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    const accessToken = await issueSession(stored.adminUser, res);
    res.json({
      accessToken,
      user: {
        id: stored.adminUser.id,
        nombre: stored.adminUser.nombre,
        email: stored.adminUser.email,
        rol: stored.adminUser.rol,
      },
    });
  }),
);

adminAuthRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) {
      const tokenHash = hashRefreshToken(token);
      await prisma.adminRefreshToken.updateMany({ where: { tokenHash }, data: { revokedAt: new Date() } });
    }
    res.clearCookie(REFRESH_COOKIE, cookieOpts);
    res.json({ ok: true });
  }),
);

adminAuthRouter.get(
  '/me',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const user = await prisma.adminUser.findUnique({ where: { id: req.adminUser!.id } });
    if (!user) throw new HttpError(404, 'No encontrado');
    res.json({ id: user.id, nombre: user.nombre, email: user.email, rol: user.rol });
  }),
);

// Invited users receive a one-time link (see admin/users.routes.ts + mailer
// stub) carrying this token, and use it here to set their own password.
const acceptInviteSchema = z.object({ token: z.string().min(1), password: z.string().min(8) });

adminAuthRouter.post(
  '/accept-invite',
  asyncHandler(async (req, res) => {
    const { token, password } = acceptInviteSchema.parse(req.body);
    const user = await prisma.adminUser.findUnique({ where: { inviteToken: token } });
    if (!user) throw new HttpError(400, 'Invitación inválida o expirada');
    const passwordHash = await hashPassword(password);
    await prisma.adminUser.update({
      where: { id: user.id },
      data: { passwordHash, inviteToken: null, activo: true },
    });
    res.json({ ok: true });
  }),
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

adminAuthRouter.post(
  '/change-password',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const user = await prisma.adminUser.findUnique({ where: { id: req.adminUser!.id } });
    if (!user?.passwordHash) throw new HttpError(404, 'No encontrado');
    const ok = await comparePassword(currentPassword, user.passwordHash);
    if (!ok) throw new HttpError(401, 'La contraseña actual no es correcta');
    const passwordHash = await hashPassword(newPassword);
    await prisma.adminUser.update({ where: { id: user.id }, data: { passwordHash } });
    res.json({ ok: true });
  }),
);

export function generateInviteToken() {
  return crypto.randomBytes(24).toString('hex');
}
