export const PB_OFFER_OPTION = 'pbOfferId';
export const PB_DEAL_OPTION = 'pbDealId';
export const PB_KIND_OPTION = 'pbKind';
/** Invisible Unicode used as a secondary stamp in line descriptions when options are unavailable. */
export const OFFER_MARK_PREFIX = '\u200B\u200C';
export function encodeOfferMark(offerId, dealId) {
    return `${OFFER_MARK_PREFIX}${offerId}${dealId ? `:${dealId}` : ''}`;
}
export function decodeOfferMark(text) {
    if (!text.includes(OFFER_MARK_PREFIX))
        return {};
    const payload = text.split(OFFER_MARK_PREFIX)[1]?.split('\u200C')[0] ?? '';
    const [offerId, dealId] = payload.split(':');
    return { offerId: offerId || undefined, dealId: dealId || undefined };
}
export function stampOptions(offerId, dealId, kind) {
    const options = {
        [PB_OFFER_OPTION]: offerId,
    };
    if (dealId)
        options[PB_DEAL_OPTION] = dealId;
    if (kind)
        options[PB_KIND_OPTION] = kind;
    return options;
}
/**
 * Ecwid limitation: custom per-line sale prices are not available on every plan/API path.
 * We stamp pbOfferId/pbDealId in product options (or order comments) so sync + attribution
 * can find bundle lines. Actual price overrides may require:
 * - Ecwid "Pay What You Want" + selectedPrice on storefront JS addProduct, or
 * - Server-calculated discounts webhook (customize_cart_calculation scope).
 */
export function readStampFromOptions(options) {
    if (!options)
        return {};
    return {
        offerId: options[PB_OFFER_OPTION],
        dealId: options[PB_DEAL_OPTION],
        kind: options[PB_KIND_OPTION],
    };
}
