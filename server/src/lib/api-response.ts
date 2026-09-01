import type { Request, Response } from 'express';

const ECWID_ORIGIN_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/i,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/i,
  /^https:\/\/([a-z0-9-]+\.)*ecwid\.(com|ru|net)(:\d+)?$/i,
  /^https:\/\/([a-z0-9-]+\.)*company\.site$/i,
  /^https:\/\/([a-z0-9-]+\.)*myshopify\.com$/i,
  /^https:\/\/([a-z0-9-]+\.)*vercel\.app$/i,
];

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  return ECWID_ORIGIN_PATTERNS.some((re) => re.test(origin));
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.origin;
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Ecwid-Store-Id, X-Requested-With',
    'Access-Control-Max-Age': '86400',
  };
  if (origin && isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
  return headers;
}

export function jsonResponse(
  res: Response,
  req: Request,
  body: unknown,
  status = 200,
): void {
  const headers = corsHeaders(req);
  res.status(status).set(headers).json(body);
}

export function failResponse(
  res: Response,
  req: Request,
  message: string,
  status = 400,
): void {
  jsonResponse(res, req, { ok: false, error: message }, status);
}

export const CLIENT_ERRORS = new Set([
  'Bundle is not available',
  'Bundle is incomplete',
  'Quantity break is not available',
  'Product is not in this quantity break',
  'Product is not available',
  'Invalid ruleType',
  'Rule not found',
  'Store not found',
  'Unauthorized',
]);
