import { Router } from 'express';
import {
  incrementMonthlyViews,
  loadAppSettings,
  saveAppSettings,
  setCartUpsellEnabled,
} from '../../lib/db/settings.js';
import { failResponse, jsonResponse } from '../../lib/api-response.js';
import { requireDashboardAuth } from '../../lib/auth.js';

export const settingsRouter = Router();

settingsRouter.use(requireDashboardAuth);

settingsRouter.get('/', async (req, res) => {
  try {
    const storeId = req.session!.storeId!;
    const settings = await loadAppSettings(storeId);
    jsonResponse(res, req, { settings });
  } catch (err) {
    failResponse(res, req, err instanceof Error ? err.message : 'Failed to load settings', 500);
  }
});

settingsRouter.post('/', async (req, res) => {
  try {
    const storeId = req.session!.storeId!;
    const settings = await saveAppSettings(storeId, req.body ?? {});
    jsonResponse(res, req, { settings });
  } catch (err) {
    failResponse(res, req, err instanceof Error ? err.message : 'Failed to save settings', 500);
  }
});

settingsRouter.patch('/cart-upsell', async (req, res) => {
  try {
    const storeId = req.session!.storeId!;
    const enabled = Boolean(req.body?.enabled);
    await setCartUpsellEnabled(storeId, enabled);
    const settings = await loadAppSettings(storeId);
    jsonResponse(res, req, { settings, enabled });
  } catch (err) {
    failResponse(res, req, err instanceof Error ? err.message : 'Failed to update cart script', 500);
  }
});

settingsRouter.post('/increment-views', async (req, res) => {
  try {
    const storeId = req.session!.storeId!;
    const settings = await incrementMonthlyViews(storeId);
    jsonResponse(res, req, { settings });
  } catch (err) {
    failResponse(res, req, err instanceof Error ? err.message : 'Failed to increment views', 500);
  }
});
