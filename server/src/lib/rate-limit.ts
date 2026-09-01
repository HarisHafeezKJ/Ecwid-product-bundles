import type { Request, Response, NextFunction } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyFn?: (req: Request) => string;
}

function defaultKey(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip =
    typeof forwarded === 'string'
      ? forwarded.split(',')[0]!.trim()
      : req.socket.remoteAddress ?? 'unknown';
  return `${ip}:${req.baseUrl}${req.path}`;
}

export function rateLimit(options: RateLimitOptions) {
  const { windowMs, max, keyFn = defaultKey } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyFn(req);
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    if (bucket.count > max) {
      res.status(429).json({ ok: false, error: 'Too many requests' });
      return;
    }

    next();
  };
}
