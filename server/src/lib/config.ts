import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import type { Request } from 'express';
import manifestJson from '../app.manifest.json' with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

function pathExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/** Monorepo root — resolves correctly on Vercel and locally. */
export function getRepoRoot(): string {
  const candidates = [
    path.resolve(__dirname, '../../..'),
    path.resolve(__dirname, '../..'),
    path.resolve(process.cwd(), '..'),
    process.cwd(),
  ];

  for (const root of candidates) {
    if (
      pathExists(path.join(root, 'admin', 'dist', 'index.html')) ||
      pathExists(path.join(root, 'storefront', 'dist', 'pb-bundles.js')) ||
      pathExists(path.join(root, 'app.manifest.json'))
    ) {
      return root;
    }
  }

  return path.resolve(__dirname, '../../..');
}

/** Load secrets from .env files (does not override Vercel/host env vars). */
export function loadEnvFiles(): void {
  if (envLoaded) return;
  const root = getRepoRoot();
  const candidates = [
    path.join(root, '.env'),
    path.join(root, 'server', '.env'),
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'server', '.env'),
  ];
  for (const file of candidates) {
    if (pathExists(file)) {
      dotenv.config({ path: file, override: false });
    }
  }
  envLoaded = true;
}

let manifestCache: AppManifest | null = null;

export function getManifest(): AppManifest {
  if (manifestCache) return manifestCache;

  const candidates = [
    path.join(getRepoRoot(), 'app.manifest.json'),
    path.join(process.cwd(), 'app.manifest.json'),
    path.join(process.cwd(), '..', 'app.manifest.json'),
    path.join(__dirname, '../app.manifest.json'),
  ];

  for (const manifestPath of candidates) {
    if (pathExists(manifestPath)) {
      manifestCache = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as AppManifest;
      return manifestCache;
    }
  }

  manifestCache = manifestJson as AppManifest;
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
  if (!id) {
    throw new Error('ECWID_CLIENT_ID is missing. Add it to .env or Vercel Environment Variables.');
  }
  return id;
}

export function getEcwidClientSecret(): string {
  loadEnvFiles();
  const secret = process.env.ECWID_CLIENT_SECRET?.trim();
  if (!secret) {
    throw new Error('ECWID_CLIENT_SECRET is missing. Add it to .env or Vercel Environment Variables.');
  }
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
