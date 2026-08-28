import type { Request } from 'express';

export function storeIdFromRequest(req: Request): string | undefined {
  const header = req.headers['x-ecwid-store-id'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  const query = req.query.storeId;
  if (typeof query === 'string' && query.trim()) return query.trim();
  if (Array.isArray(query) && typeof query[0] === 'string') return query[0].trim();
  if (req.session?.storeId) return req.session.storeId;
  return undefined;
}

export function requireStoreId(req: Request): string {
  const storeId = storeIdFromRequest(req);
  if (!storeId) throw new Error('Store not found');
  return storeId;
}
