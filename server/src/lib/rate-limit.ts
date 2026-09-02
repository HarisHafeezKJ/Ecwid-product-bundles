import type { Request, Response, NextFunction } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Drop expired buckets so the map does not grow without bound on long-lived processes. */
const EVICT_EVERY_N_REQUESTS = 200;

let requestCount = 0;

function evictExpiredBuckets(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

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
    const now = Date.now();
    requestCount += 1;
    if (requestCount % EVICT_EVERY_N_REQUESTS === 0) {
      evictExpiredBuckets(now);
    }

    const key = keyFn(req);
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
