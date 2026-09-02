export const PB_OFFER_OPTION = 'pbOfferId';
export const PB_DEAL_OPTION = 'pbDealId';
export const PB_KIND_OPTION = 'pbKind';

/** @deprecated Legacy catalog option — removed; stamps embed in variant values instead. */
export const PB_DEAL_TEXT_OPTION = '_pbDeal';

/** Invisible marker appended to a variant option value at add-to-cart (never shown on PDP). */
export const DEAL_STAMP_SUFFIX = '\u200B\u200C';

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
 * Attach offer/deal metadata to cart line options when adding from an offer widget.
 * Embeds an invisible suffix on the first variant option (e.g. Size) so Ecwid keeps each
 * deal on its own cart line without adding anything to the product page.
 */
export function stampIntoVariantOptions(
  variantOptions: Record<string, string> | undefined,
  offerId: string,
  dealId?: string,
  kind?: string,
): Record<string, string> | undefined {
  const stamp = encodeDealStampValue(offerId, dealId, kind);
  const base = variantOptions ?? {};
  const keys = Object.keys(base);
  if (keys.length === 0) return undefined;

  const key = keys[0]!;
  return {
    ...base,
    [key]: `${base[key]}${DEAL_STAMP_SUFFIX}${stamp}`,
  };
}

/** @deprecated Use stampIntoVariantOptions */
export function stampOptions(
  offerId: string,
  dealId?: string,
  kind?: string,
): Record<string, string> {
  return stampIntoVariantOptions({}, offerId, dealId, kind) ?? {};
}

/** Options sent to Ecwid `Cart.addProduct` (variant choices + embedded deal stamp). */
export function ecwidCartOptions(options?: Record<string, string>): Record<string, string> | undefined {
  if (!options) return undefined;
  const merged: Record<string, string> = {};
  for (const [key, value] of Object.entries(options)) {
    if (LEGACY_STAMP_KEYS.has(key) || key === PB_DEAL_TEXT_OPTION) continue;
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

export function readStampFromOptions(options?: Record<string, string>): {
  offerId?: string;
  dealId?: string;
  kind?: string;
} {
  if (!options) return {};

  const legacyDeal = options[PB_DEAL_TEXT_OPTION];
  if (legacyDeal) return decodeDealStampValue(legacyDeal);

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
