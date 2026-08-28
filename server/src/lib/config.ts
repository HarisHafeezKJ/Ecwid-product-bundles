import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import type { Request } from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Monorepo root — works locally and on Vercel (Root Directory = server). */
export function getRepoRoot(): string {
  if (process.env.VERCEL) {
    return path.resolve(process.cwd(), '..');
  }
  return path.resolve(__dirname, '../../..');
}

const repoRoot = getRepoRoot();

export interface AppManifest {
  name: string;
  version: string;
  description?: string;
  scopes: string[];
  paths: {
    oauthCallback: string;
    oauthInstall: string;
    webhook: string;
    storefrontScript: string;
    storefrontApi: string;
    dashboardApi: string;
    adminMount: string;
    health: string;
  };
  storage: {
    rules: string;
    settings: string;
    impressions: string;
    oauth: string;
    public: string;
  };
}

let envLoaded = false;

/** Load secrets from .env files only (host env vars are not required). */
export function loadEnvFiles(): void {
  if (envLoaded) return;
  const candidates = [
    path.join(repoRoot, '.env'),
    path.join(repoRoot, 'server', '.env'),
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'server', '.env'),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      dotenv.config({ path: file, override: false });
    }
  }
  envLoaded = true;
}

let manifestCache: AppManifest | null = null;

export function getManifest(): AppManifest {
  if (manifestCache) return manifestCache;
  const manifestPath = path.join(repoRoot, 'app.manifest.json');
  const raw = fs.readFileSync(manifestPath, 'utf8');
  manifestCache = JSON.parse(raw) as AppManifest;
  return manifestCache;
}

export function getPort(): number {
  loadEnvFiles();
  const port = Number(process.env.PORT ?? 3001);
  return Number.isFinite(port) && port > 0 ? port : 3001;
}

export function getEcwidClientId(): string {
  loadEnvFiles();
  const id = process.env.ECWID_CLIENT_ID?.trim();
  if (!id) throw new Error('ECWID_CLIENT_ID is missing from .env');
  return id;
}

export function getEcwidClientSecret(): string {
  loadEnvFiles();
  const secret = process.env.ECWID_CLIENT_SECRET?.trim();
  if (!secret) throw new Error('ECWID_CLIENT_SECRET is missing from .env');
  return secret;
}

/** HMAC signing key derived from app secret (no separate SESSION_SECRET). */
export function getSigningSecret(): string {
  return getEcwidClientSecret();
}

export function isProduction(): boolean {
  loadEnvFiles();
  return process.env.NODE_ENV === 'production';
}

/** Detect public base URL from the incoming request (supports reverse proxies). */
export function getRequestBaseUrl(req: Request): string {
  const forwardedProto = req.get('x-forwarded-proto');
  const proto = forwardedProto ? forwardedProto.split(',')[0]!.trim() : req.protocol;
  const forwardedHost = req.get('x-forwarded-host');
  const host = forwardedHost ? forwardedHost.split(',')[0]!.trim() : req.get('host');
  if (!host) return `http://localhost:${getPort()}`;
  return `${proto}://${host}`;
}

export function urlFromRequest(req: Request, pathname: string): string {
  const base = getRequestBaseUrl(req);
  const pathPart = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${base}${pathPart}`;
}

export function getOAuthRedirectUri(req: Request): string {
  return urlFromRequest(req, getManifest().paths.oauthCallback);
}

export function getAdminUrl(req: Request): string {
  return urlFromRequest(req, getManifest().paths.adminMount);
}

export function getStorefrontScriptUrl(req: Request): string {
  return urlFromRequest(req, getManifest().paths.storefrontScript);
}

export function getStorefrontApiUrl(req: Request): string {
  return urlFromRequest(req, getManifest().paths.storefrontApi);
}

export function getWebhookUrl(req: Request): string {
  return urlFromRequest(req, getManifest().paths.webhook);
}

export function getOAuthScopeString(): string {
  return getManifest().scopes.join('+');
}
