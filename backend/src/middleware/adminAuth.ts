import { NextFunction, Request, Response } from 'express';
import { AdminTokenPayload, verifyAccessToken } from '@/lib/jwt';
import { AdminRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { asyncHandler } from '@/lib/asyncHandler';

declare global {
  namespace Express {
    interface Request {
      adminUser?: { id: string; rol: AdminRole };
    }
  }
}

// Re-checks activo/rol against the DB on every request instead of trusting
// the JWT's claims for its whole lifetime — otherwise a just-suspended admin
// (or one just demoted to a lower role) would keep their old access until
// the token naturally expired (JWT_ACCESS_TTL), instead of being cut off
// immediately.
export const requireAdmin = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  let payload: AdminTokenPayload;
  try {
    payload = verifyAccessToken<AdminTokenPayload>(header.slice(7));
    if (payload.kind !== 'admin') throw new Error('wrong token kind');
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
  const user = await prisma.adminUser.findUnique({ where: { id: payload.sub } });
  if (!user || !user.activo) {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
  req.adminUser = { id: user.id, rol: user.rol };
  next();
});

export function requireRole(...roles: AdminRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.adminUser) return res.status(401).json({ error: 'No autenticado' });
    if (!roles.includes(req.adminUser.rol)) {
      return res.status(403).json({ error: 'No tenés permiso para esta acción' });
    }
    next();
  };
}
