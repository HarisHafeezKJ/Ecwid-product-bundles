import path from 'node:path';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { corsHeaders, isAllowedOrigin, jsonResponse } from './lib/api-response.js';
import { getAdminDistPath, getEcwidClientSecret, getManifest, getPort, getStorefrontDistPath, loadEnvFiles } from './lib/config.js';
import { sessionMiddleware, persistStoreAuth, setSession } from './lib/auth.js';
import { buildEcwidAdminHtml } from './lib/admin-html.js';
import {
  decryptEcwidPayload,
  describeEcwidPayloadDecryptError,
  extractEcwidPayloadParam,
} from './lib/ecwid-payload.js';
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
  const encrypted = extractEcwidPayloadParam(req);
  if (encrypted) {
    try {
      const clientSecret = getEcwidClientSecret();
      const decoded = decryptEcwidPayload(encrypted, clientSecret);
      const storeId = String(decoded.store_id);
      await persistStoreAuth(storeId, decoded.access_token, decoded.public_token);
      const sessionToken = setSession(res, storeId, decoded.access_token);
      res
        .status(200)
        .type('html')
        .send(buildEcwidAdminHtml(adminDistPath, { bootstrapToken: sessionToken }));
      return;
    } catch (err) {
      const reason = describeEcwidPayloadDecryptError(err);
      console.error('Ecwid iframe payload auth failed', reason, err);
      // Still return 200 + EcwidApp.init so Ecwid CP does not show "extension cannot be loaded".
      res
        .status(200)
        .type('html')
        .send(
          buildEcwidAdminHtml(adminDistPath, {
            authError:
              reason === 'decrypt_bad_key'
                ? 'Could not decrypt Ecwid payload. Verify ECWID_CLIENT_SECRET in Vercel matches your Ecwid app client_secret exactly.'
                : 'Could not authenticate this Ecwid session.',
          }),
        );
      return;
    }
  }

  res.status(200).type('html').send(buildEcwidAdminHtml(adminDistPath));
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
