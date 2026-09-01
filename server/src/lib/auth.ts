import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import {
  getAdminUrl,
  getEcwidClientId,
  getOAuthRedirectUri,
  getOAuthScopeString,
  getSigningSecret,
  isProduction,
  loadEnvFiles,
} from './config.js';
import type { EcwidStoreTokens } from './ecwid.js';
import {
  getOAuthTokens,
  hydrateOAuthCache,
  persistOAuthTokens,
  refreshOAuthFromStorage,
  ensureStoreTokens,
} from './storage/oauth-cache.js';

loadEnvFiles();

const SESSION_COOKIE = 'pb_session';

export interface PbSession {
  storeId?: string;
  accessToken?: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    session?: PbSession;
  }
}

function sign(value: string): string {
  return crypto.createHmac('sha256', getSigningSecret()).update(value).digest('hex').slice(0, 16);
}

function encodeSessionPayload(storeId: string, accessToken: string): string {
  const payload = Buffer.from(JSON.stringify({ storeId, accessToken }), 'utf8').toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function decodeSessionPayload(raw: string): PbSession | undefined {
  const [payload, sig] = raw.split('.');
  if (!payload || !sig || sign(payload) !== sig) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as PbSession;
    if (!parsed.storeId || !parsed.accessToken) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function parseSessionCookie(cookieHeader: string | undefined): PbSession | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!match) return undefined;
  const raw = decodeURIComponent(match.split('=')[1] ?? '');
  return decodeSessionPayload(raw);
}

function sessionCookieOptions(): {
  httpOnly: boolean;
  sameSite: 'lax' | 'none';
  secure: boolean;
  maxAge: number;
  partitioned?: boolean;
} {
  if (isProduction()) {
    return {
      httpOnly: true,
      // Required when Ecwid admin embeds this app in a cross-site iframe (Chrome blocks Lax cookies).
      sameSite: 'none',
      secure: true,
      partitioned: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };
  }
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

function parseBearerSession(authHeader: string | undefined): PbSession | undefined {
  if (!authHeader?.startsWith('Bearer ')) return undefined;
  return decodeSessionPayload(authHeader.slice(7).trim());
}

export function sessionMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const fromCookie = parseSessionCookie(req.headers.cookie);
  const fromBearer = parseBearerSession(req.headers.authorization);
  req.session = fromCookie ?? fromBearer ?? {};

  if (req.session.storeId && req.session.accessToken) {
    hydrateOAuthCache(req.session.storeId, req.session.accessToken);
  }
  next();
}

export function createSessionToken(storeId: string, accessToken: string): string {
  return encodeSessionPayload(storeId, accessToken);
}

export function setSession(res: Response, storeId: string, accessToken: string): string {
  const value = createSessionToken(storeId, accessToken);
  res.cookie(SESSION_COOKIE, value, sessionCookieOptions());
  return value;
}

export function clearSession(res: Response): void {
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
}

export function ecwidInstallUrl(req: Request): string {
  const clientId = getEcwidClientId();
  const redirectUri = encodeURIComponent(getOAuthRedirectUri(req));
  const scope = getOAuthScopeString();
  return `https://my.ecwid.com/api/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
}

export async function exchangeOAuthCode(
  req: Request,
  storeId: string,
  code: string,
): Promise<{ storeId: string; accessToken: string; publicToken?: string }> {
  const body = new URLSearchParams({
    client_id: getEcwidClientId(),
    client_secret: getSigningSecret(),
    code,
    redirect_uri: getOAuthRedirectUri(req),
    grant_type: 'authorization_code',
  });

  const res = await fetch(`https://my.ecwid.com/api/oauth/token/${storeId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OAuth exchange failed: ${text || res.statusText}`);
  }

  const data = (await res.json()) as {
    store_id?: number;
    storeId?: number;
    access_token: string;
    public_token?: string;
  };

  return {
    storeId: String(data.store_id ?? data.storeId ?? storeId),
    accessToken: data.access_token,
    publicToken: data.public_token,
  };
}

export async function persistStoreAuth(
  storeId: string,
  accessToken: string,
  publicToken?: string,
): Promise<void> {
  await persistOAuthTokens(storeId, accessToken, publicToken);
}

export async function getStoreTokens(storeId: string): Promise<EcwidStoreTokens | null> {
  return ensureStoreTokens(storeId);
}

export function requireDashboardAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.storeId || !req.session.accessToken) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }
  next();
}

export function getAdminRedirectUrl(req: Request, storeId: string): string {
  return `${getAdminUrl(req)}?storeId=${encodeURIComponent(storeId)}`;
}
