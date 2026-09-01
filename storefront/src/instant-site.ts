/** Helpers for Ecwid Instant Site (company.site) product pages. */

export function isInstantSiteHost(): boolean {
  return /\.company\.site$/i.test(window.location.hostname);
}

export function storeIdFromHostname(): number | undefined {
  const match = window.location.hostname.match(/^store(\d+)\./i);
  if (!match) return undefined;
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : undefined;
}

export function productIdFromPageUrl(): number | undefined {
  const href = window.location.href;
  const path = window.location.pathname;

  const patterns = [
    /-p(\d+)(?:\?|$|\/)/i,
    /\/products\/(\d+)(?:\/|$)/i,
    /\/products\/[^/]+-(\d+)/i,
  ];
  for (const pattern of patterns) {
    const match = path.match(pattern) ?? href.match(pattern);
    if (match) {
      const id = Number(match[1]);
      if (Number.isFinite(id) && id > 0) return id;
    }
  }

  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical instanceof HTMLLinkElement && canonical.href) {
    const canonicalMatch =
      canonical.href.match(/-p(\d+)/i) ?? canonical.href.match(/\/products\/(\d+)/);
    if (canonicalMatch) {
      const id = Number(canonicalMatch[1]);
      if (Number.isFinite(id) && id > 0) return id;
    }
  }

  const ogImage = document.querySelector('meta[property="og:image"]');
  const imageUrl = ogImage?.getAttribute('content') ?? '';
  const imageMatch = imageUrl.match(/\/products\/(\d+)\//);
  if (imageMatch) {
    const id = Number(imageMatch[1]);
    if (Number.isFinite(id) && id > 0) return id;
  }

  return undefined;
}

export function instantSiteProductPage(): boolean {
  return /\/products\//i.test(window.location.pathname);
}

interface InstantSiteApi {
  getAppPublicToken?: (clientId: string) => string | Promise<string>;
  OnPageLoaded?: { add: (fn: (page: { type?: string; productId?: number }) => void) => void };
  OnAPILoaded?: { add: (fn: () => void) => void };
}

export function getInstantSite(): InstantSiteApi | undefined {
  const win = window as Window & { instantsite?: InstantSiteApi };
  return win.instantsite;
}

/** Decode Ecwid Instant Site `appsPublicConfigs` values (often nested JSON strings). */
export function decodeEcwidNestedJson(raw: unknown): unknown {
  let current = raw;
  for (let depth = 0; depth < 6; depth++) {
    if (typeof current === 'string') {
      const trimmed = current.trim();
      if (!trimmed) return null;
      try {
        current = JSON.parse(trimmed);
        continue;
      } catch {
        break;
      }
    }
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      const obj = current as Record<string, unknown>;
      if (obj.value != null) {
        const keys = Object.keys(obj);
        if (keys.length === 1 || (keys.length === 2 && keys.includes('key'))) {
          current = obj.value;
          continue;
        }
      }
    }
    break;
  }
  return current;
}

/** Ecwid Instant Site embeds app tokens in `window.initialState` before app JS runs. */
export function parseInstantSiteInitialState(): {
  appJsUrls?: string[];
  appsPublicTokens?: Record<string, string>;
  appsPublicConfigs?: Record<string, string>;
} | null {
  const win = window as Window & { initialState?: string };
  const raw = win.initialState;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      context?: {
        appJsUrls?: string[];
        appsPublicTokens?: Record<string, string>;
        appsPublicConfigs?: Record<string, string>;
      };
    };
    return parsed.context ?? null;
  } catch {
    return null;
  }
}

export function publicTokenFromInitialState(clientId: string): string | undefined {
  const tokens = parseInstantSiteInitialState()?.appsPublicTokens;
  const token = tokens?.[clientId];
  return typeof token === 'string' && token.trim() ? token.trim() : undefined;
}

export function publicConfigFromInitialState(clientId: string): Record<string, unknown> | null {
  const configs = parseInstantSiteInitialState()?.appsPublicConfigs;
  const raw = configs?.[clientId];
  if (!raw) return null;
  const decoded = decodeEcwidNestedJson(raw);
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) return null;
  return decoded as Record<string, unknown>;
}
