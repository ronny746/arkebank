import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'arke_scholars_jwt_secret_token_2026_948291048_ultra_secure';
const ALLOWED_EMAILS = ['admin@arkescholar.com', 'rohit@arkescholar.com'];

export interface TokenPayload {
  email: string;
  role: string;
  iat: number;
  exp: number;
}

/**
 * Signs a URL-safe HMAC-SHA256 JWT token valid for 7 days
 */
export function signToken(email: string, expiresInSeconds = 7 * 24 * 3600): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    email: email.toLowerCase().trim(),
    role: 'Authorized Administrator',
    iat: now,
    exp: now + expiresInSeconds,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');

  return `${header}.${body}.${signature}`;
}

/**
 * Verifies the token signature, expiration, and authorized email whitelist
 */
export function verifyToken(token: string | null | undefined): TokenPayload | null {
  if (!token || typeof token !== 'string') return null;

  try {
    const parts = token.trim().split('.');
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');

    // Constant-time check to prevent timing attacks
    if (signature.length !== expectedSignature.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const payload: TokenPayload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));

    // Check expiration timestamp
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    // Check strict whitelist
    if (!ALLOWED_EMAILS.includes(payload.email.toLowerCase().trim())) {
      return null;
    }

    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Extracts and verifies token from Authorization header (Bearer <token>) OR Cookie (arke_session_token)
 */
export function extractAndVerifyToken(req: Request): TokenPayload | null {
  // 1. Check Bearer token in Authorization header
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const payload = verifyToken(token);
    if (payload) return payload;
  }

  // 2. Check HTTP-Only Cookie
  const cookieHeader = req.headers.get('cookie');
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map((c) => {
        const [k, ...v] = c.trim().split('=');
        return [k, v.join('=')];
      })
    );
    if (cookies.arke_session_token) {
      const payload = verifyToken(cookies.arke_session_token);
      if (payload) return payload;
    }
  }

  return null;
}
