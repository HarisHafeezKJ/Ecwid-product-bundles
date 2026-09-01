import { Router } from 'express';
import { getProducts, searchProducts } from '../../lib/ecwid.js';
import { failResponse, jsonResponse } from '../../lib/api-response.js';
import { requireDashboardAuth } from '../../lib/auth.js';

export const productsRouter = Router();

productsRouter.use(requireDashboardAuth);

function parseIdList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((id) => String(id).trim()).filter(Boolean);
  }
  return String(value ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

productsRouter.get('/', async (req, res) => {
  try {
    const storeId = req.session!.storeId!;
    const accessToken = req.session!.accessToken!;
    const tokens = { storeId, accessToken };
    const ids = parseIdList(req.query.ids ?? req.query.productIds);
    if (ids.length > 0) {
      const products = await getProducts(tokens, ids);
      jsonResponse(res, req, { products });
      return;
    }

    const q = String(req.query.search ?? req.query.q ?? req.query.keyword ?? '').trim();
    const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 24)));
    if (!q) return jsonResponse(res, req, { products: [] });

    const products = await searchProducts(tokens, q, limit);
    jsonResponse(res, req, { products });
  } catch (err) {
    failResponse(res, req, err instanceof Error ? err.message : 'Product search failed', 500);
  }
});

productsRouter.get('/search', async (req, res) => {
  try {
    const storeId = req.session!.storeId!;
    const accessToken = req.session!.accessToken!;
    const tokens = { storeId, accessToken };
    const ids = parseIdList(req.query.ids ?? req.query.productIds);
    if (ids.length > 0) {
      const products = await getProducts(tokens, ids);
      jsonResponse(res, req, { products });
      return;
    }

    const q = String(req.query.q ?? req.query.keyword ?? '').trim();
    const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 24)));
    if (!q) return jsonResponse(res, req, { products: [] });

    const products = await searchProducts(tokens, q, limit);
    jsonResponse(res, req, { products });
  } catch (err) {
    failResponse(res, req, err instanceof Error ? err.message : 'Product search failed', 500);
  }
});

productsRouter.get('/:productId', async (req, res) => {
  try {
    const storeId = req.session!.storeId!;
    const accessToken = req.session!.accessToken!;
    const { getProduct } = await import('../../lib/ecwid.js');
    const product = await getProduct({ storeId, accessToken }, req.params.productId!);
    if (!product) return failResponse(res, req, 'Product not found', 404);
    jsonResponse(res, req, { product });
  } catch (err) {
    failResponse(res, req, err instanceof Error ? err.message : 'Failed to load product', 500);
  }
});
