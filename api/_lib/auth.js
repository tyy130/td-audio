import crypto from 'node:crypto';

const SESSION_COOKIE = 'slughouse_admin_session';
const STATE_COOKIE = 'slughouse_oauth_state';
const NONCE_COOKIE = 'slughouse_oauth_nonce';
const VERIFIER_COOKIE = 'slughouse_oauth_verifier';

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8');
}

function randomString(size = 32) {
  return base64UrlEncode(crypto.randomBytes(size));
}

function sha256Base64Url(value) {
  return crypto
    .createHash('sha256')
    .update(value)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret) throw new Error('SESSION_SECRET not set');
  return secret;
}

function sign(value) {
  return crypto.createHmac('sha256', getSessionSecret()).update(value).digest('hex');
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const pairs = header.split(/;\s*/).filter(Boolean);
  const cookies = {};
  for (const pair of pairs) {
    const index = pair.indexOf('=');
    if (index === -1) continue;
    const key = decodeURIComponent(pair.slice(0, index));
    const value = decodeURIComponent(pair.slice(index + 1));
    cookies[key] = value;
  }
  return cookies;
}

function appendSetCookie(res, cookieValue) {
  const current = res.getHeader('Set-Cookie');
  if (!current) {
    res.setHeader('Set-Cookie', [cookieValue]);
    return;
  }
  const next = Array.isArray(current) ? current.concat(cookieValue) : [current, cookieValue];
  res.setHeader('Set-Cookie', next);
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || '/'}`);
  if (options.httpOnly !== false) parts.push('HttpOnly');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push('Secure');
  if (typeof options.maxAge === 'number') parts.push(`Max-Age=${options.maxAge}`);
  return parts.join('; ');
}

export function getBaseUrl(req) {
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL.trim().replace(/\/$/, '');
  }
  const proto = req.headers['x-forwarded-proto'] || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

export function getAllowedEmail() {
  return (process.env.AUTHORIZED_ADMIN_EMAIL || '1forfunnn@gmail.com').trim().toLowerCase();
}

export function createPkceBundle() {
  const state = randomString(32);
  const nonce = randomString(32);
  const codeVerifier = randomString(48);
  const codeChallenge = sha256Base64Url(codeVerifier);
  return { state, nonce, codeVerifier, codeChallenge };
}

export function setOAuthCookies(res, bundle) {
  const secure = process.env.NODE_ENV === 'production';
  appendSetCookie(res, serializeCookie(STATE_COOKIE, bundle.state, { secure, sameSite: 'Lax', maxAge: 600 }));
  appendSetCookie(res, serializeCookie(NONCE_COOKIE, bundle.nonce, { secure, sameSite: 'Lax', maxAge: 600 }));
  appendSetCookie(res, serializeCookie(VERIFIER_COOKIE, bundle.codeVerifier, { secure, sameSite: 'Lax', maxAge: 600 }));
}

export function clearOAuthCookies(res) {
  const secure = process.env.NODE_ENV === 'production';
  appendSetCookie(res, serializeCookie(STATE_COOKIE, '', { secure, sameSite: 'Lax', maxAge: 0 }));
  appendSetCookie(res, serializeCookie(NONCE_COOKIE, '', { secure, sameSite: 'Lax', maxAge: 0 }));
  appendSetCookie(res, serializeCookie(VERIFIER_COOKIE, '', { secure, sameSite: 'Lax', maxAge: 0 }));
}

export function getOAuthCookies(req) {
  const cookies = parseCookies(req);
  return {
    state: cookies[STATE_COOKIE],
    nonce: cookies[NONCE_COOKIE],
    codeVerifier: cookies[VERIFIER_COOKIE],
  };
}

export function decodeJwtPayload(token) {
  const payload = token.split('.')[1];
  if (!payload) throw new Error('Invalid id_token');
  return JSON.parse(base64UrlDecode(payload));
}

export function setSessionCookie(res, session) {
  const secure = process.env.NODE_ENV === 'production';
  const encoded = base64UrlEncode(JSON.stringify(session));
  const signature = sign(encoded);
  const token = `${encoded}.${signature}`;
  appendSetCookie(res, serializeCookie(SESSION_COOKIE, token, { secure, sameSite: 'Lax', maxAge: 60 * 60 * 24 * 7 }));
}

export function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production';
  appendSetCookie(res, serializeCookie(SESSION_COOKIE, '', { secure, sameSite: 'Lax', maxAge: 0 }));
}

export function readSession(req) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  const valid =
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encoded));
    if (!payload?.exp || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function requireAdmin(req, res) {
  const session = readSession(req);
  if (!session) {
    res.status(401).json({ message: 'Sign in required' });
    return null;
  }
  if (!session.email || session.email.toLowerCase() !== getAllowedEmail()) {
    res.status(403).json({ message: 'Forbidden' });
    return null;
  }
  return session;
}
