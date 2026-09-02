import { Router } from 'express';
import { incrementMonthlyViews } from '../../lib/db/settings.js';
import { buildStorefrontWidgetViews } from '../../lib/build-widget-view.js';
import { serializeWidgetView } from '../../lib/serialize-widget-view.js';
import { getStoreProfile } from '../../lib/ecwid.js';
import {
  CLIENT_ERRORS,
  corsHeaders,
  failResponse,
  isClientError,
  jsonResponse,
} from '../../lib/api-response.js';
import { resolveRules } from '../../lib/storefront-rules.js';
import { getOAuthTokens } from '../../lib/storage/oauth-cache.js';
import { resolveStorefrontTokens } from '../../lib/storefront-tokens.js';
import { requireStoreId } from '../../lib/store-context.js';
import { parseOfferBody } from '../../lib/validate-body.js';

export const offerRouter = Router();

offerRouter.options('/', (req, res) => {
  res.status(204).set(corsHeaders(req)).end();
});

async function handleOffer(
  req: import('express').Request,
  res: import('express').Response,
): Promise<void> {
  try {
    const storeId = requireStoreId(req);
    // The route serves GET as well, where every param arrives as a query string.
    const parsed = parseOfferBody({ ...req.query, ...(req.body as object | undefined) });
    if (!parsed.ok) return failResponse(res, req, parsed.error, 400);

    const { productId, ruleId, ruleType, publicToken } = parsed.data;
    const cachedPrivate = await getOAuthTokens(storeId);
    const tokens = await resolveStorefrontTokens(storeId, publicToken || undefined);
    if (!tokens) {
      console.warn('[pb-offer] No OAuth tokens for store', storeId);
      res.status(204).set(corsHeaders(req)).end();
      return;
    }

    let overViewLimit = false;
    if (!ruleId && cachedPrivate?.accessToken) {
      try {
        const settings = await incrementMonthlyViews(storeId);
        overViewLimit = settings.currentViewsCount > settings.monthlyViewsLimit;
      } catch (err) {
        console.warn('[pb-offer] incrementMonthlyViews failed', err);
      }
    }

    const { rules } = await resolveRules({
      storeId,
      tokens,
      ruleType,
      ruleId,
      excludeCartUpsell: !ruleId,
    });

    const views = await buildStorefrontWidgetViews(tokens, rules, productId, overViewLimit);
    if (views.length === 0) {
      console.warn('[pb-offer] No widget views for product', storeId, productId, {
        ruleCount: rules.length,
        hasPublicToken: Boolean(publicToken),
      });
      res.status(204).set(corsHeaders(req)).end();
      return;
    }

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
    if (isClientError(err) || CLIENT_ERRORS.has(message)) {
      return failResponse(res, req, message, 400);
    }
    res.status(204).set(corsHeaders(req)).end();
  }
}

offerRouter.get('/', handleOffer);
offerRouter.post('/', handleOffer);
