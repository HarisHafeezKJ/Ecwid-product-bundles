import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { corsHeaders, isAllowedOrigin, jsonResponse } from './lib/api-response.js';
import { getAdminDistPath, getManifest, getPort, getStorefrontDistPath, loadEnvFiles } from './lib/config.js';
import { sessionMiddleware, persistStoreAuth, setSession } from './lib/auth.js';
import { getEcwidClientSecret } from './lib/config.js';
import { decryptEcwidPayload } from './lib/ecwid-payload.js';
import { authRouter } from './routes/auth.js';
import { rulesRouter } from './routes/dashboard/rules.js';
import { settingsRouter } from './routes/dashboard/settings.js';
import { productsRouter } from './routes/dashboard/products.js';
import { offerRouter } from './routes/storefront/offer.js';
import { addDiscountedRouter } from './routes/storefront/add-discounted.js';
import { cartUpsellRouter } from './routes/storefront/cart-upsell.js';
import { syncVolumeCartRouter } from './routes/storefront/sync-volume-cart.js';
import { ordersWebhookRouter } from './routes/webhooks/orders.js';

loadEnvFiles();

const manifest = getManifest();
const adminDist = getAdminDistPath();
const storefrontDist = getStorefrontDistPath();

// #region agent log
fetch('http://127.0.0.1:7627/ingest/17a22ea5-cb1e-474a-bba3-194752c05bb0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c36960'},body:JSON.stringify({sessionId:'c36960',location:'server/src/index.ts:static-paths',message:'Resolved static asset paths',data:{cwd:process.cwd(),vercel:!!process.env.VERCEL,adminDist,storefrontDist,adminExists:fs.existsSync(adminDist),storefrontExists:fs.existsSync(storefrontDist)},timestamp:Date.now(),hypothesisId:'G',runId:'post-fix'})}).catch(()=>{});
// #endregion

const app = express();
const port = getPort();

const apiCors = cors({
  origin(origin, callback) {
    if (!origin || isAllowedOrigin(origin)) callback(null, true);
    else callback(null, false);
  },
  credentials: true,
});

// Static assets (admin/storefront) must not fail when Ecwid iframe sends a foreign Origin header.
app.use('/storefront', express.static(storefrontDist));
app.use('/admin/assets', express.static(path.join(adminDist, 'assets')));

app.use(apiCors);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(sessionMiddleware);

app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.status(204).set(corsHeaders(req)).end();
    return;
  }
  next();
});

app.get('/health', (req, res) => {
  jsonResponse(res, req, { ok: true, service: 'pb-server' });
});

app.use('/api/auth', authRouter);
app.use('/api/dashboard/rules', rulesRouter);
app.use('/api/dashboard/settings', settingsRouter);
app.use('/api/dashboard/products', productsRouter);
app.use('/api/storefront/offer', offerRouter);
app.use('/api/storefront/add-discounted', addDiscountedRouter);
app.use('/api/storefront/cart-upsell', cartUpsellRouter);
app.use('/api/storefront/sync-volume-cart', syncVolumeCartRouter);
app.use('/api/webhooks/orders', ordersWebhookRouter);

const adminDistPath = adminDist;

async function serveAdminEntry(
  req: express.Request,
  res: express.Response,
): Promise<void> {
  const encrypted =
    typeof req.query.payload === 'string' ? req.query.payload.trim() : '';
  if (encrypted) {
    try {
      const decoded = decryptEcwidPayload(encrypted, getEcwidClientSecret());
      const storeId = String(decoded.store_id);
      await persistStoreAuth(storeId, decoded.access_token, decoded.public_token);
      const sessionToken = setSession(res, storeId, decoded.access_token);
      const params = new URLSearchParams();
      if (typeof req.query.lang === 'string' && req.query.lang) {
        params.set('lang', req.query.lang);
      }
      params.set('bootstrap', sessionToken);
      // #region agent log
      fetch('http://127.0.0.1:7627/ingest/17a22ea5-cb1e-474a-bba3-194752c05bb0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c36960'},body:JSON.stringify({sessionId:'c36960',location:'server/src/index.ts:admin-entry',message:'Ecwid payload decrypted; redirecting to clean admin URL',data:{storeId,lang:decoded.lang},timestamp:Date.now(),hypothesisId:'K',runId:'post-fix'})}).catch(()=>{});
      // #endregion
      res.redirect(302, `${manifest.paths.adminMount}?${params.toString()}`);
      return;
    } catch (err) {
      console.error('Ecwid iframe payload auth failed', err);
      res.status(401).type('html').send('Unable to authenticate this Ecwid app session.');
      return;
    }
  }

  res.sendFile(path.join(adminDistPath, 'index.html'));
}

app.get(manifest.paths.adminMount, (req, res) => {
  void serveAdminEntry(req, res);
});
app.get(`${manifest.paths.adminMount}/*`, (req, res, next) => {
  if (req.path.includes('/assets/')) {
    next();
    return;
  }
  void serveAdminEntry(req, res);
});

app.get('/', (_req, res) => {
  res.redirect(manifest.paths.adminMount);
});

app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).set(corsHeaders(req)).json({ ok: false, error: err.message });
});

export default app;

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Product Bundles server listening on http://localhost:${port}`);
    console.log(`Admin UI: http://localhost:${port}${manifest.paths.adminMount}`);
  });
}
