export interface InstantSiteContext {
  appJsUrls?: string[];
  appsPublicTokens?: Record<string, string>;
  appsPublicConfigs?: Record<string, string>;
}

/** Parse `window.initialState` or equivalent JSON string. */
export function parseInstantSiteContextRaw(raw: string): InstantSiteContext | null {
  try {
    const parsed = JSON.parse(raw) as { context?: InstantSiteContext };
    return parsed.context ?? null;
  } catch {
    return null;
  }
}

/** Extract the inner initialState JSON string from scraped storefront HTML. */
export function extractInitialStateFromHtml(html: string): string | null {
  const match = html.match(/initialState\s*=\s*("(?:\\.|[^"\\])*")/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]!) as string;
  } catch {
    return null;
  }
}

export function parseInstantSiteContextFromHtml(html: string): InstantSiteContext | null {
  const inner = extractInitialStateFromHtml(html);
  if (!inner) return null;
  return parseInstantSiteContextRaw(inner);
}
