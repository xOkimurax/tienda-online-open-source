import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '@/env';

export type AdminTokenPayload = { sub: string; kind: 'admin'; rol: string };
export type CustomerTokenPayload = { sub: string; kind: 'customer' };

export function signAdminAccessToken(payload: AdminTokenPayload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'],
  });
}

export function signCustomerAccessToken(payload: CustomerTokenPayload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken<T extends object>(token: string): T {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as T;
}

// Refresh tokens are opaque random strings; only their sha256 hash is stored,
// so a leaked DB dump doesn't hand out valid sessions.
export function generateRefreshToken() {
  const token = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashRefreshToken(token);
  return { token, tokenHash };
}

export function hashRefreshToken(token: string) {
  return crypto.createHmac('sha256', env.JWT_REFRESH_SECRET).update(token).digest('hex');
}

// Password reset tokens follow the same opaque-token-plus-hash pattern as
// refresh tokens (see above) — the raw token only ever exists in the email
// link, and only its hash is stored on the Customer row.
export function generatePasswordResetToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashPasswordResetToken(token);
  return { token, tokenHash };
}

export function hashPasswordResetToken(token: string) {
  return crypto.createHmac('sha256', env.JWT_REFRESH_SECRET).update(`reset:${token}`).digest('hex');
}

export function refreshTtlMs() {
  const match = /^(\d+)([smhd])$/.exec(env.JWT_REFRESH_TTL);
  if (!match) return 30 * 24 * 60 * 60 * 1000;
  const n = Number(match[1]);
  const unit = match[2];
  const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit] ?? 86_400_000;
  return n * mult;
}
