export const PB_OFFER_OPTION = 'pbOfferId';
export const PB_DEAL_OPTION = 'pbDealId';
export const PB_KIND_OPTION = 'pbKind';

/** Hidden TEXT catalog option — different values keep each offer on its own cart line. */
export const PB_DEAL_TEXT_OPTION = '_pbDeal';

/** @deprecated Ecwid normalizes variant values; do not embed stamps in Size. */
export const DEAL_STAMP_SUFFIX = '\u200B\u200C';

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

export function stripDealStampFromOptionValue(value: string): string {
  const idx = value.indexOf(DEAL_STAMP_SUFFIX);
  return idx >= 0 ? value.slice(0, idx) : value;
}

export function stripDealStampFromOptions(
  options?: Record<string, string>,
): Record<string, string> | undefined {
  if (!options) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(options)) {
    if (key === PB_DEAL_TEXT_OPTION) continue;
    const cleaned = stripDealStampFromOptionValue(value);
    if (cleaned) out[key] = cleaned;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Variant options for Ecwid add-to-cart. Deal metadata is applied at the cart discount
 * webhook (bundle allocation), not via a catalog TEXT option — Ecwid renders that on the PDP
 * and omits it from cart line options, which caused duplicate adds.
 */
export function stampCartLineOptions(
  variantOptions: Record<string, string> | undefined,
  _offerId?: string,
  _dealId?: string,
  _kind?: string,
): Record<string, string> | undefined {
  return stripDealStampFromOptions(variantOptions);
}

/** @deprecated Use stampCartLineOptions */
export function stampIntoVariantOptions(
  variantOptions: Record<string, string> | undefined,
  offerId: string,
  dealId?: string,
  kind?: string,
): Record<string, string> | undefined {
  return stampCartLineOptions(variantOptions, offerId, dealId, kind);
}

export function stampOptions(
  offerId: string,
  dealId?: string,
  kind?: string,
): Record<string, string> {
  return { [PB_DEAL_TEXT_OPTION]: encodeDealStampValue(offerId, dealId, kind) };
}

/** Variant options sent to Ecwid `Cart.addProduct` (never internal stamp keys). */
export function ecwidCartOptions(options?: Record<string, string>): Record<string, string> | undefined {
  if (!options) return undefined;
  const merged: Record<string, string> = {};
  for (const [key, value] of Object.entries(options)) {
    if (LEGACY_STAMP_KEYS.has(key) || key === PB_DEAL_TEXT_OPTION) continue;
    const cleaned = stripDealStampFromOptionValue(value);
    if (cleaned) merged[key] = cleaned;
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

export function readStampFromOptions(options?: Record<string, string>): {
  offerId?: string;
  dealId?: string;
  kind?: string;
} {
  if (!options) return {};

  const dealStamp = options[PB_DEAL_TEXT_OPTION];
  if (dealStamp) return decodeDealStampValue(dealStamp);

  if (options[PB_OFFER_OPTION]) {
    return {
      offerId: options[PB_OFFER_OPTION],
      dealId: options[PB_DEAL_OPTION],
      kind: options[PB_KIND_OPTION],
    };
  }

  for (const value of Object.values(options)) {
    const idx = value.indexOf(DEAL_STAMP_SUFFIX);
    if (idx >= 0) {
      return decodeDealStampValue(value.slice(idx + DEAL_STAMP_SUFFIX.length));
    }
  }

  return {};
}
