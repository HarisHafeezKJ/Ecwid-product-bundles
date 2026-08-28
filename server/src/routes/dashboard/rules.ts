import { Router } from 'express';
import {
  deleteBundleRule,
  getBundleRule,
  listBundleRules,
  saveBundleRule,
  setBundleStatus,
} from '../../lib/db/rules.js';
import { CLIENT_ERRORS, failResponse, jsonResponse } from '../../lib/api-response.js';
import { requireDashboardAuth } from '../../lib/auth.js';
import type { RuleStatus } from '@pb/shared';
import { isRuleType } from '@pb/shared';

export const rulesRouter = Router();

rulesRouter.use(requireDashboardAuth);

rulesRouter.get('/', async (req, res) => {
  try {
    const storeId = req.session!.storeId!;
    const rules = await listBundleRules(storeId);
    jsonResponse(res, req, { rules });
  } catch (err) {
    failResponse(res, req, err instanceof Error ? err.message : 'Failed to list rules', 500);
  }
});

rulesRouter.get('/:id', async (req, res) => {
  try {
    const storeId = req.session!.storeId!;
    const rule = await getBundleRule(storeId, req.params.id!);
    if (!rule) return failResponse(res, req, 'Rule not found', 404);
    jsonResponse(res, req, { rule });
  } catch (err) {
    failResponse(res, req, err instanceof Error ? err.message : 'Failed to load rule', 500);
  }
});

rulesRouter.post('/', async (req, res) => {
  try {
    const storeId = req.session!.storeId!;
    const rule = await saveBundleRule(storeId, req.body ?? {});
    jsonResponse(res, req, { rule });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save rule';
    const status = CLIENT_ERRORS.has(message) ? 400 : 500;
    failResponse(res, req, message, status);
  }
});

rulesRouter.patch('/:id/status', async (req, res) => {
  try {
    const storeId = req.session!.storeId!;
    const status = String(req.body?.status ?? '') as RuleStatus;
    if (!['ACTIVE', 'DISABLED', 'DRAFT'].includes(status)) {
      return failResponse(res, req, 'Invalid status', 400);
    }
    const rule = await setBundleStatus(storeId, req.params.id!, status);
    jsonResponse(res, req, { rule });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update status';
    failResponse(res, req, message, message === 'Rule not found' ? 404 : 500);
  }
});

rulesRouter.delete('/:id', async (req, res) => {
  try {
    const storeId = req.session!.storeId!;
    await deleteBundleRule(storeId, req.params.id!);
    jsonResponse(res, req, { ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete rule';
    failResponse(res, req, message, message === 'Rule not found' ? 404 : 500);
  }
});

// Validate ruleType query helper for storefront parity
rulesRouter.get('/meta/rule-types', (_req, res) => {
  jsonResponse(res, _req, {
    ruleTypes: ['FIXED_BUNDLE', 'MIX_AND_MATCH', 'VOLUME_DISCOUNT', 'CART_UPSELL'],
  });
});

export function validateRuleTypeParam(value: unknown): boolean {
  return isRuleType(value);
}
