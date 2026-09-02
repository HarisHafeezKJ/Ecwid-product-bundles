import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPrivateStoreTokens, privateStoreTokens, type EcwidStoreTokens } from '../ecwid.js';
import { getManifest } from '../config.js';
import { readStorageJson, writeStorageJson } from './ecwid-storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cacheFile = process.env.VERCEL
  ? path.join('/tmp', 'pb-oauth-cache.json')
  : path.resolve(__dirname, '../../../data/oauth-cache.json');

type OAuthDoc = {
  accessToken: string;
  publicToken?: string;
  updatedAt: string;
};

const memory = new Map<string, EcwidStoreTokens>();

function readFileCache(): Record<string, OAuthDoc> {
  try {
    if (!fs.existsSync(cacheFile)) return {};
    return JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as Record<string, OAuthDoc>;
  } catch {
    return {};
  }
}

function writeFileCache(data: Record<string, OAuthDoc>): void {
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2), 'utf8');
}

/** Resolve API tokens: cache first, then signed session cookie (Vercel cold starts). */
export async function resolveStoreTokens(
  storeId: string,
  sessionAccessToken?: string,
): Promise<EcwidStoreTokens> {
  const cached = await getOAuthTokens(storeId);
  if (cached?.accessToken && isPrivateStoreTokens(cached)) return cached;
  if (sessionAccessToken) {
    hydrateOAuthCache(storeId, sessionAccessToken);
    return privateStoreTokens(storeId, sessionAccessToken);
  }
  throw new Error('Store not authenticated');
}

/** Restore in-memory (and /tmp) token cache from a signed session cookie — required on Vercel cold starts. */
export function hydrateOAuthCache(
  storeId: string,
  accessToken: string,
  publicToken?: string,
): void {
  const tokens = privateStoreTokens(storeId, accessToken, publicToken);
  memory.set(storeId, tokens);

  const file = readFileCache();
  file[storeId] = {
    accessToken,
    publicToken,
    updatedAt: new Date().toISOString(),
  };
  writeFileCache(file);
}

/** Persist OAuth tokens to Ecwid app storage + local bootstrap file. */
export async function persistOAuthTokens(
  storeId: string,
  accessToken: string,
  publicToken?: string,
): Promise<void> {
  const tokens = privateStoreTokens(storeId, accessToken, publicToken);
  memory.set(storeId, tokens);

  const doc: OAuthDoc = {
    accessToken,
    publicToken,
    updatedAt: new Date().toISOString(),
  };

  await writeStorageJson(tokens, getManifest().storage.oauth, doc);

  const file = readFileCache();
  file[storeId] = doc;
  writeFileCache(file);
}

/** Resolve store API tokens (memory → local bootstrap file). */
export async function getOAuthTokens(storeId: string): Promise<EcwidStoreTokens | null> {
  const cached = memory.get(storeId);
  if (cached?.accessToken) return cached;

  const file = readFileCache();
  const doc = file[storeId];
  if (doc?.accessToken) {
    const tokens = privateStoreTokens(storeId, doc.accessToken, doc.publicToken);
    memory.set(storeId, tokens);
    return tokens;
  }

  return null;
}

/** Load OAuth from Ecwid storage when we already have a bootstrap token. */
export async function refreshOAuthFromStorage(storeId: string): Promise<EcwidStoreTokens | null> {
  const bootstrap = await getOAuthTokens(storeId);
  if (!bootstrap) return null;

  const doc = await readStorageJson<OAuthDoc>(bootstrap, getManifest().storage.oauth);
  if (!doc?.accessToken) return bootstrap;

  const tokens = privateStoreTokens(storeId, doc.accessToken, doc.publicToken);
  memory.set(storeId, tokens);

  const file = readFileCache();
  file[storeId] = doc;
  writeFileCache(file);

  return tokens;
}

/** Storefront APIs: memory/file cache, then Ecwid storage refresh. */
export async function ensureStoreTokens(storeId: string): Promise<EcwidStoreTokens | null> {
  const cached = await getOAuthTokens(storeId);
  if (cached?.accessToken) return cached;
  return refreshOAuthFromStorage(storeId);
}
