import { Router } from 'express';
import { searchProducts } from '../../lib/ecwid.js';
import { failResponse, jsonResponse } from '../../lib/api-response.js';
import { requireDashboardAuth } from '../../lib/auth.js';

export const productsRouter = Router();

productsRouter.use(requireDashboardAuth);

productsRouter.get('/', async (req, res) => {
  try {
    const storeId = req.session!.storeId!;
    const accessToken = req.session!.accessToken!;
    const q = String(req.query.search ?? req.query.q ?? req.query.keyword ?? '').trim();
    const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 24)));
    if (!q) return jsonResponse(res, req, { products: [] });

    const products = await searchProducts({ storeId, accessToken }, q, limit);
    jsonResponse(res, req, { products });
  } catch (err) {
    failResponse(res, req, err instanceof Error ? err.message : 'Product search failed', 500);
  }
});

productsRouter.get('/search', async (req, res) => {
  try {
    const storeId = req.session!.storeId!;
    const accessToken = req.session!.accessToken!;
    const q = String(req.query.q ?? req.query.keyword ?? '').trim();
    const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 24)));
    if (!q) return jsonResponse(res, req, { products: [] });

    const products = await searchProducts({ storeId, accessToken }, q, limit);
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
