import { Router } from 'express';
import type { Request } from 'express';
import {
  incrementMonthlyViews,
  loadAppSettings,
  saveAppSettings,
  setCartUpsellEnabled,
} from '../../lib/db/settings.js';
import { failResponse, jsonResponse } from '../../lib/api-response.js';
import { requireDashboardAuth } from '../../lib/auth.js';

export const settingsRouter = Router();

function sessionToken(req: Request): string {
  return req.session!.accessToken!;
}

settingsRouter.use(requireDashboardAuth);

settingsRouter.get('/', async (req, res) => {
  try {
    const storeId = req.session!.storeId!;
    const settings = await loadAppSettings(storeId, sessionToken(req));
    jsonResponse(res, req, { settings });
  } catch (err) {
    console.error('GET /api/dashboard/settings failed', err);
    failResponse(res, req, err instanceof Error ? err.message : 'Failed to load settings', 500);
  }
});

settingsRouter.post('/', async (req, res) => {
  try {
    const storeId = req.session!.storeId!;
    const settings = await saveAppSettings(storeId, req.body ?? {}, sessionToken(req));
    jsonResponse(res, req, { settings });
  } catch (err) {
    failResponse(res, req, err instanceof Error ? err.message : 'Failed to save settings', 500);
  }
});

settingsRouter.patch('/cart-upsell', async (req, res) => {
  try {
    const storeId = req.session!.storeId!;
    const enabled = Boolean(req.body?.enabled);
    await setCartUpsellEnabled(storeId, enabled, sessionToken(req));
    const settings = await loadAppSettings(storeId, sessionToken(req));
    jsonResponse(res, req, { settings, enabled });
  } catch (err) {
    failResponse(res, req, err instanceof Error ? err.message : 'Failed to update cart script', 500);
  }
});

settingsRouter.post('/increment-views', async (req, res) => {
  try {
    const storeId = req.session!.storeId!;
    const settings = await incrementMonthlyViews(storeId, sessionToken(req));
    jsonResponse(res, req, { settings });
  } catch (err) {
    failResponse(res, req, err instanceof Error ? err.message : 'Failed to increment views', 500);
  }
});
