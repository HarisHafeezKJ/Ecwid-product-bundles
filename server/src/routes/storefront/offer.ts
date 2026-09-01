import { Router } from 'express';
import { isRuleType } from '@pb/shared';
import { listActiveRulesForStore } from '../../lib/db/rules.js';
import { listActiveRulesFromPublicConfig } from '../../lib/db/public-rules.js';
import { incrementMonthlyViews } from '../../lib/db/settings.js';
import { buildStorefrontWidgetViews } from '../../lib/build-widget-view.js';
import { serializeWidgetView } from '../../lib/serialize-widget-view.js';
import { getStoreProfile } from '../../lib/ecwid.js';
import { CLIENT_ERRORS, corsHeaders, failResponse, jsonResponse } from '../../lib/api-response.js';
import { getOAuthTokens } from '../../lib/storage/oauth-cache.js';
import { resolveStorefrontTokens } from '../../lib/storefront-tokens.js';
import { requireStoreId } from '../../lib/store-context.js';
import type { RuleType } from '@pb/shared';

export const offerRouter = Router();

offerRouter.options('/', (req, res) => {
  res.status(204).set(corsHeaders(req)).end();
});

offerRouter.get('/', async (req, res) => {
  try {
    const storeId = requireStoreId(req);
    const productId = String(req.query.productId ?? '').trim();
    const ruleId = String(req.query.ruleId ?? '').trim() || undefined;
    const ruleTypeRaw = req.query.ruleType;
    const ruleType =
      typeof ruleTypeRaw === 'string' && isRuleType(ruleTypeRaw)
        ? (ruleTypeRaw as RuleType)
        : undefined;

    if (!productId) return failResponse(res, req, 'productId is required', 400);
    if (ruleTypeRaw && !ruleType) return failResponse(res, req, 'Invalid ruleType', 400);

    const publicToken = String(req.query.publicToken ?? '').trim();
    const cachedPrivate = await getOAuthTokens(storeId);
    const tokens = await resolveStorefrontTokens(storeId, publicToken || undefined);
    if (!tokens) {
      console.warn('[pb-offer] No OAuth tokens for store', storeId);
      return res.status(204).set(corsHeaders(req)).end();
    }

    let overViewLimit = false;
    if (!ruleId && cachedPrivate?.accessToken) {
      try {
        await incrementMonthlyViews(storeId);
      } catch (err) {
        console.warn('[pb-offer] incrementMonthlyViews failed', err);
      }
    }

    let rules: Awaited<ReturnType<typeof listActiveRulesForStore>> = [];
    if (cachedPrivate?.accessToken) {
      try {
        rules = await listActiveRulesForStore(storeId, ruleType);
      } catch (err) {
        console.warn('[pb-offer] listActiveRulesForStore failed', err);
      }
    }
    if (rules.length === 0) {
      rules = await listActiveRulesFromPublicConfig(tokens);
    }
    if (ruleType) {
      rules = rules.filter((r) => r.ruleType === ruleType);
    }
    if (ruleId) {
      rules = rules.filter((r) => r.id === ruleId);
    } else {
      rules = rules.filter((r) => r.ruleType !== 'CART_UPSELL');
    }

    const views = await buildStorefrontWidgetViews(tokens, rules, productId, overViewLimit);
    if (views.length === 0) return res.status(204).set(corsHeaders(req)).end();

    let currency = 'USD';
    try {
      const profile = await getStoreProfile(tokens);
      const raw = profile.formatsAndUnits as { currency?: string } | undefined;
      if (raw?.currency) currency = String(raw.currency);
    } catch {
      /* optional */
    }

    const serialized = views.map((view) => serializeWidgetView(view, currency));
    const payload =
      serialized.length === 1
        ? { view: serialized[0], views: serialized }
        : { views: serialized, view: serialized[0] };

    jsonResponse(res, req, payload);
  } catch (err) {
    console.error('offer route error', err);
    const message = err instanceof Error ? err.message : 'Offer failed';
    if (CLIENT_ERRORS.has(message)) return failResponse(res, req, message, 400);
    res.status(204).set(corsHeaders(req)).end();
  }
});
