import rateLimit from 'express-rate-limit';

// Keyed by req.ip, which only reflects the real client (instead of the
// Cloudflare tunnel's loopback address) once app.set('trust proxy', ...) is
// configured in app.ts — see the comment there.

// Login endpoints are the classic brute-force target: no CAPTCHA, no account
// lockout, so this is the only thing standing between a leaked/weak password
// and an attacker just trying every guess back to back.
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Probá de nuevo en unos minutos.' },
});

// Looser limit for register/forgot-password — abuse here looks more like
// spam/enumeration than credential-guessing, so a higher ceiling is fine.
export const authRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Probá de nuevo más tarde.' },
});
