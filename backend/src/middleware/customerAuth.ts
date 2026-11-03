import { NextFunction, Request, Response } from 'express';
import { CustomerTokenPayload, verifyAccessToken } from '@/lib/jwt';

declare global {
  namespace Express {
    interface Request {
      customer?: { id: string };
    }
  }
}

function extractPayload(req: Request): CustomerTokenPayload | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const payload = verifyAccessToken<CustomerTokenPayload>(header.slice(7));
    if (payload.kind !== 'customer') return null;
    return payload;
  } catch {
    return null;
  }
}

export function requireCustomer(req: Request, res: Response, next: NextFunction) {
  const payload = extractPayload(req);
  if (!payload) return res.status(401).json({ error: 'No autenticado' });
  req.customer = { id: payload.sub };
  next();
}

// Lets guest checkout pass through while still identifying logged-in customers.
export function optionalCustomer(req: Request, _res: Response, next: NextFunction) {
  const payload = extractPayload(req);
  if (payload) req.customer = { id: payload.sub };
  next();
}
