export const PB_OFFER_OPTION = 'pbOfferId';
export const PB_DEAL_OPTION = 'pbDealId';
export const PB_KIND_OPTION = 'pbKind';

/** Hidden TEXT product option — different values split the same SKU into separate cart lines. */
export const PB_DEAL_TEXT_OPTION = '_pbDeal';

/** Invisible Unicode used as a secondary stamp in line descriptions when options are unavailable. */
export const OFFER_MARK_PREFIX = '\u200B\u200C';

const LEGACY_STAMP_KEYS = new Set([PB_OFFER_OPTION, PB_DEAL_OPTION, PB_KIND_OPTION]);

export function encodeOfferMark(offerId: string, dealId?: string): string {
  return `${OFFER_MARK_PREFIX}${offerId}${dealId ? `:${dealId}` : ''}`;
}

export function decodeOfferMark(text: string): { offerId?: string; dealId?: string } {
  if (!text.includes(OFFER_MARK_PREFIX)) return {};
  const payload = text.split(OFFER_MARK_PREFIX)[1]?.split('\u200C')[0] ?? '';
  const [offerId, dealId] = payload.split(':');
  return { offerId: offerId || undefined, dealId: dealId || undefined };
}

const DEAL_STAMP_SEP = '\x1f';

export function encodeDealStampValue(offerId: string, dealId?: string, kind?: string): string {
  return [offerId, dealId ?? '', kind ?? ''].join(DEAL_STAMP_SEP);
}

export function decodeDealStampValue(value: string): {
  offerId?: string;
  dealId?: string;
  kind?: string;
} {
  const [offerId, dealId, kind] = value.split(DEAL_STAMP_SEP);
  return {
    offerId: offerId || undefined,
    dealId: dealId || undefined,
    kind: kind || undefined,
  };
}

export function stampOptions(
  offerId: string,
  dealId?: string,
  kind?: string,
): Record<string, string> {
  return {
    [PB_DEAL_TEXT_OPTION]: encodeDealStampValue(offerId, dealId, kind),
  };
}

/** Variant options plus the `_pbDeal` stamp sent to Ecwid `Cart.addProduct`. */
export function ecwidCartOptions(options?: Record<string, string>): Record<string, string> | undefined {
  if (!options) return undefined;
  const merged: Record<string, string> = {};
  for (const [key, value] of Object.entries(options)) {
    if (LEGACY_STAMP_KEYS.has(key)) continue;
    if (value) merged[key] = value;
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

export function optionsFromSelectedOptions(selected: unknown): Record<string, string> {
  if (!Array.isArray(selected)) return {};
  const map: Record<string, string> = {};
  for (const entry of selected) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const name = String(row.name ?? '').trim();
    const value = String(row.value ?? '').trim();
    if (name && value) map[name] = value;
  }
  return map;
}

/**
 * Ecwid limitation: custom per-line sale prices are not available on every plan/API path.
 * We stamp offer/deal ids in a hidden TEXT product option so Ecwid keeps each deal on its
 * own cart line and the discount webhook can price bundle vs quantity-break independently.
 */
export function readStampFromOptions(options?: Record<string, string>): {
  offerId?: string;
  dealId?: string;
  kind?: string;
} {
  if (!options) return {};
  const dealStamp = options[PB_DEAL_TEXT_OPTION];
  if (dealStamp) return decodeDealStampValue(dealStamp);
  return {
    offerId: options[PB_OFFER_OPTION],
    dealId: options[PB_DEAL_OPTION],
    kind: options[PB_KIND_OPTION],
  };
}
