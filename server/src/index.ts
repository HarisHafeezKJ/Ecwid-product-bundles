import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { corsHeaders, isAllowedOrigin, jsonResponse } from './lib/api-response.js';
import { getAdminDistPath, getManifest, getPort, getStorefrontDistPath, loadEnvFiles } from './lib/config.js';
import { sessionMiddleware } from './lib/auth.js';
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

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || isAllowedOrigin(origin)) callback(null, true);
      else callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }),
);
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

const storefrontDistPath = storefrontDist;
app.use('/storefront', express.static(storefrontDistPath));

const adminDistPath = adminDist;
app.use(manifest.paths.adminMount, express.static(adminDistPath));
app.get(manifest.paths.adminMount, (_req, res) => {
  res.sendFile(path.join(adminDistPath, 'index.html'));
});
app.get(`${manifest.paths.adminMount}/*`, (_req, res) => {
  res.sendFile(path.join(adminDistPath, 'index.html'));
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
