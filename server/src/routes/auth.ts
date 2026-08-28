import { Router } from 'express';
import {
  clearSession,
  ecwidInstallUrl,
  exchangeOAuthCode,
  getAdminRedirectUrl,
  persistStoreAuth,
  sessionMiddleware,
  setSession,
} from '../lib/auth.js';
import { jsonResponse } from '../lib/api-response.js';
import { getManifest, getRequestBaseUrl, isProduction } from '../lib/config.js';

export const authRouter = Router();

authRouter.get('/install', (req, res) => {
  res.redirect(ecwidInstallUrl(req));
});

authRouter.get('/callback', async (req, res) => {
  try {
    const code = String(req.query.code ?? '');
    const storeId = String(req.query.store_id ?? req.query.storeId ?? '');
    if (!code || !storeId) {
      res.status(400).send('Missing code or store_id');
      return;
    }

    const tokens = await exchangeOAuthCode(req, storeId, code);
    await persistStoreAuth(tokens.storeId, tokens.accessToken, tokens.publicToken);
    setSession(res, tokens.storeId, tokens.accessToken);

    res.redirect(getAdminRedirectUrl(req, tokens.storeId));
  } catch (err) {
    console.error('OAuth callback failed', err);
    res.status(500).send('Authentication failed');
  }
});

authRouter.post('/logout', (req, res) => {
  clearSession(res);
  jsonResponse(res, req, { ok: true });
});

authRouter.get('/session', sessionMiddleware, (req, res) => {
  jsonResponse(res, req, {
    authenticated: Boolean(req.session?.storeId),
    storeId: req.session?.storeId ?? null,
  });
});

/** Local development — authenticate with storeId + accessToken in JSON body. */
authRouter.post('/dev-login', async (req, res) => {
  if (isProduction()) {
    res.status(404).end();
    return;
  }

  const storeId = String(req.body?.storeId ?? '').trim();
  const accessToken = String(req.body?.accessToken ?? '').trim();
  if (!storeId || !accessToken) {
    res.status(400).json({
      ok: false,
      error: 'Pass storeId and accessToken in the request body',
    });
    return;
  }

  await persistStoreAuth(storeId, accessToken);
  setSession(res, storeId, accessToken);
  jsonResponse(res, req, { ok: true, storeId });
});

authRouter.get('/manifest', (req, res) => {
  const manifest = getManifest();
  const baseUrl = getRequestBaseUrl(req);
  jsonResponse(res, req, {
    ...manifest,
    urls: {
      baseUrl,
      admin: `${baseUrl}${manifest.paths.adminMount}`,
      oauthCallback: `${baseUrl}${manifest.paths.oauthCallback}`,
      oauthInstall: `${baseUrl}${manifest.paths.oauthInstall}`,
      storefrontScript: `${baseUrl}${manifest.paths.storefrontScript}`,
      storefrontApi: `${baseUrl}${manifest.paths.storefrontApi}`,
      webhook: `${baseUrl}${manifest.paths.webhook}`,
    },
  });
});
