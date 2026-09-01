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
