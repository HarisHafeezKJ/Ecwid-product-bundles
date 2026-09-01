/** Resolve the storefront script element (pb-bundles.js or parent storefront.js). */

export function findOwnScript(): HTMLScriptElement | null {
  const current = document.currentScript;
  if (current instanceof HTMLScriptElement && current.src) return current;

  const nodes = document.querySelectorAll('script[src]');
  for (const node of nodes) {
    const src = node.getAttribute('src') ?? '';
    if (/\/storefront\/pb-bundles\.js(?:\?|$)/i.test(src)) return node as HTMLScriptElement;
  }
  for (const node of nodes) {
    const src = node.getAttribute('src') ?? '';
    if (/ecwid-product-bundles[^"' ]*\/storefront\.js(?:\?|$)/i.test(src)) {
      return node as HTMLScriptElement;
    }
  }
  return null;
}

export function appRootFromScript(script: HTMLScriptElement | null): string {
  const win = window as Window & { __pbApiBase?: string };
  const fromAttr =
    script?.getAttribute('data-api-base') ??
    script?.getAttribute('data-api-url') ??
    win.__pbApiBase;
  if (fromAttr) return fromAttr.replace(/\/$/, '');

  if (script?.src) {
    try {
      const url = new URL(script.src);
      return url.origin + url.pathname
        .replace(/\/storefront\/pb-bundles\.js(?:\?.*)?$/i, '')
        .replace(/\/storefront\.js(?:\?.*)?$/i, '');
    } catch {
      /* fall through */
    }
  }
  return window.location.origin;
}

export function apiBaseFromScript(script: HTMLScriptElement | null): string {
  const root = appRootFromScript(script);
  if (/\/api\/storefront$/i.test(root)) return root;
  return `${root.replace(/\/$/, '')}/api/storefront`;
}

export function clientIdFromScript(script: HTMLScriptElement | null): string | undefined {
  const win = window as Window & { __pbAppId?: string };
  const fromWindow = win.__pbAppId?.trim();
  if (fromWindow) return fromWindow;
  const fromScript = script?.getAttribute('data-app-id')?.trim();
  return fromScript || undefined;
}

/** Sync client id resolution (before async config fetch). */
export function clientIdSync(): string | undefined {
  return clientIdFromScript(findOwnScript());
}
