import { asNumber, asString } from './guards.js';
const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
export const DEFAULT_WIDGET_STYLE = {
    checkoutLabel: '',
    promoLabel: '',
    blockTitle: 'Special Offer',
    addToCartText: 'Add to Cart',
    addingToCartText: 'Adding...',
    addToCartErrorText: 'Could not add to cart.',
    summaryBuy: 'Buy',
    summarySave: 'Save',
    standardPriceText: 'Standard price',
    buyAllAtText: 'Buy all at',
    buyAllTagText: 'Selected ✓',
    qtyPromptText: 'Select {{COUNT}} more',
    summaryTitle: 'Your selection',
    summarySubtitle: 'Bundle summary',
    salePriceText: 'Sale price',
    totalItemsLabel: 'Total items',
    savingsBadgeText: 'Save',
    variantLabel: 'Variation',
    outOfStockText: 'Out of stock',
    unavailableOptionText: 'Unavailable',
    volumeUnavailableText: 'Volume product is unavailable.',
    editorHtml: '',
    layout: 'VERTICAL',
    dividerStyle: 'LINE',
    blockTitleColor: '#111827',
    blockTitleSize: 20,
    offerCardBg: '#ffffff',
    offerCardBorder: '#e5e7eb',
    offerCardSelectedBg: '#f0fdf4',
    offerCardSelectedBorder: '#22c55e',
    offerTitleColor: '#111827',
    offerTitleSize: 16,
    offerSubtitleColor: '#6b7280',
    offerSubtitleSize: 14,
    priceColor: '#111827',
    priceSize: 16,
    variationColor: '#374151',
    variationSize: 14,
    ctaBg: '#111827',
    ctaColor: '#ffffff',
    ctaSize: 16,
    ctaRadius: 8,
    ctaWidth: 100,
    ctaActiveBg: '#1f2937',
    ctaSuccessBg: '#16a34a',
    productTitleColor: '#111827',
    productTitleSize: 15,
    productQtyColor: '#6b7280',
    productQtySize: 13,
    productPriceColor: '#111827',
    productPriceSize: 15,
    productDivider: 'LINE',
    variationsWidth: 100,
    buyAllColor: '#111827',
    buyAllSize: 15,
    buyAllPriceColor: '#16a34a',
    buyAllPriceSize: 18,
    buyAllTagColor: '#16a34a',
    buyAllTagSize: 14,
    mixCardBg: '#ffffff',
    mixCardBorder: '#e5e7eb',
    mixCardSelectedBg: '#f0fdf4',
    mixCardSelectedBorder: '#22c55e',
    mixSummaryBg: '#f9fafb',
    mixSummaryBorder: '#e5e7eb',
};
const TYPE_COPY_DEFAULTS = {
    VOLUME_DISCOUNT: {
        blockTitle: 'Quantity Break',
        addToCartText: 'Add to Cart',
        checkoutLabel: 'SAVE & SMILE',
        promoLabel: 'SAVE & SMILE',
        summaryBuy: 'Buy',
        summarySave: 'and save',
        standardPriceText: 'Standard price',
    },
    FIXED_BUNDLE: {
        blockTitle: 'Frequently Bought Together',
        addToCartText: 'Add Bundle to Cart',
        checkoutLabel: 'Bundle Deal',
        promoLabel: 'Bundle Deal',
        buyAllAtText: 'Buy all at',
        buyAllTagText: 'Bundle',
        productDivider: 'PLUS_LINE',
    },
    MIX_AND_MATCH: {
        blockTitle: 'Mix & Match',
        addToCartText: 'Add to Cart',
        checkoutLabel: 'Mix & Match',
        promoLabel: 'Mix & Match',
        qtyPromptText: 'Select {{COUNT}} more',
        summaryTitle: 'Your mix',
        summarySubtitle: 'Bundle summary',
    },
    CART_UPSELL: {
        blockTitle: 'Customers also bought',
        addToCartText: 'Add',
        buyAllTagText: 'Selected ✓',
        checkoutLabel: '',
        promoLabel: '',
    },
};
function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function parseHexColor(value, fallback) {
    const raw = asString(value, fallback);
    return HEX_COLOR.test(raw) ? raw : fallback;
}
function parseSize(value, fallback, min = 10, max = 32) {
    return clampNumber(asNumber(value, fallback), min, max);
}
function parseRadius(value, fallback) {
    return clampNumber(asNumber(value, fallback), 0, 32);
}
function parseProductDivider(value, fallback) {
    if (value === 'LINE' || value === 'PLUS' || value === 'PLUS_LINE')
        return value;
    return fallback;
}
function parseLayout(value, fallback) {
    return value === 'HORIZONTAL' ? 'HORIZONTAL' : fallback;
}
export function defaultWidgetStyle(ruleType) {
    const base = { ...DEFAULT_WIDGET_STYLE };
    if (!ruleType)
        return base;
    return { ...base, ...TYPE_COPY_DEFAULTS[ruleType] };
}
/** @deprecated Use defaultWidgetStyle */
export const defaultWidgetStyleForType = defaultWidgetStyle;
export function parseWidgetStyle(raw, ruleType) {
    const defaults = defaultWidgetStyle(ruleType);
    const input = raw && typeof raw === 'object' ? raw : {};
    const style = { ...defaults };
    const stringFields = [
        'checkoutLabel',
        'promoLabel',
        'blockTitle',
        'addToCartText',
        'addingToCartText',
        'addToCartErrorText',
        'summaryBuy',
        'summarySave',
        'standardPriceText',
        'buyAllAtText',
        'buyAllTagText',
        'qtyPromptText',
        'summaryTitle',
        'summarySubtitle',
        'salePriceText',
        'totalItemsLabel',
        'savingsBadgeText',
        'variantLabel',
        'outOfStockText',
        'unavailableOptionText',
        'volumeUnavailableText',
        'editorHtml',
    ];
    for (const field of stringFields) {
        if (input[field] != null) {
            style[field] = asString(input[field], asString(defaults[field]));
        }
    }
    style.layout = parseLayout(input.layout, defaults.layout ?? 'VERTICAL');
    style.dividerStyle = parseProductDivider(input.dividerStyle, defaults.dividerStyle ?? 'LINE');
    style.productDivider = parseProductDivider(input.productDivider, defaults.productDivider ?? 'LINE');
    style.blockTitleColor = parseHexColor(input.blockTitleColor, defaults.blockTitleColor ?? '#111827');
    style.blockTitleSize = parseSize(input.blockTitleSize, defaults.blockTitleSize ?? 20);
    style.offerCardBg = parseHexColor(input.offerCardBg, defaults.offerCardBg ?? '#ffffff');
    style.offerCardBorder = parseHexColor(input.offerCardBorder, defaults.offerCardBorder ?? '#e5e7eb');
    style.offerCardSelectedBg = parseHexColor(input.offerCardSelectedBg, defaults.offerCardSelectedBg ?? '#f0fdf4');
    style.offerCardSelectedBorder = parseHexColor(input.offerCardSelectedBorder, defaults.offerCardSelectedBorder ?? '#22c55e');
    style.offerTitleColor = parseHexColor(input.offerTitleColor, defaults.offerTitleColor ?? '#111827');
    style.offerTitleSize = parseSize(input.offerTitleSize, defaults.offerTitleSize ?? 16);
    style.offerSubtitleColor = parseHexColor(input.offerSubtitleColor, defaults.offerSubtitleColor ?? '#6b7280');
    style.offerSubtitleSize = parseSize(input.offerSubtitleSize, defaults.offerSubtitleSize ?? 14);
    style.priceColor = parseHexColor(input.priceColor, defaults.priceColor ?? '#111827');
    style.priceSize = parseSize(input.priceSize, defaults.priceSize ?? 16);
    style.variationColor = parseHexColor(input.variationColor, defaults.variationColor ?? '#374151');
    style.variationSize = parseSize(input.variationSize, defaults.variationSize ?? 14);
    style.ctaBg = parseHexColor(input.ctaBg, defaults.ctaBg ?? '#111827');
    style.ctaColor = parseHexColor(input.ctaColor, defaults.ctaColor ?? '#ffffff');
    style.ctaSize = parseSize(input.ctaSize, defaults.ctaSize ?? 16);
    style.ctaRadius = parseRadius(input.ctaRadius, defaults.ctaRadius ?? 8);
    style.ctaWidth = clampNumber(asNumber(input.ctaWidth, defaults.ctaWidth ?? 100), 0, 100);
    style.ctaActiveBg = parseHexColor(input.ctaActiveBg, defaults.ctaActiveBg ?? '#1f2937');
    style.ctaSuccessBg = parseHexColor(input.ctaSuccessBg, defaults.ctaSuccessBg ?? '#16a34a');
    style.productTitleColor = parseHexColor(input.productTitleColor, defaults.productTitleColor ?? '#111827');
    style.productTitleSize = parseSize(input.productTitleSize, defaults.productTitleSize ?? 15);
    style.productQtyColor = parseHexColor(input.productQtyColor, defaults.productQtyColor ?? '#6b7280');
    style.productQtySize = parseSize(input.productQtySize, defaults.productQtySize ?? 13);
    style.productPriceColor = parseHexColor(input.productPriceColor, defaults.productPriceColor ?? '#111827');
    style.productPriceSize = parseSize(input.productPriceSize, defaults.productPriceSize ?? 15);
    style.variationsWidth = clampNumber(asNumber(input.variationsWidth, defaults.variationsWidth ?? 100), 20, 100);
    style.buyAllColor = parseHexColor(input.buyAllColor, defaults.buyAllColor ?? '#111827');
    style.buyAllSize = parseSize(input.buyAllSize, defaults.buyAllSize ?? 15);
    style.buyAllPriceColor = parseHexColor(input.buyAllPriceColor, defaults.buyAllPriceColor ?? '#16a34a');
    style.buyAllPriceSize = parseSize(input.buyAllPriceSize, defaults.buyAllPriceSize ?? 18);
    style.buyAllTagColor = parseHexColor(input.buyAllTagColor, defaults.buyAllTagColor ?? '#16a34a');
    style.buyAllTagSize = parseSize(input.buyAllTagSize, defaults.buyAllTagSize ?? 14);
    style.mixCardBg = parseHexColor(input.mixCardBg, defaults.mixCardBg ?? '#ffffff');
    style.mixCardBorder = parseHexColor(input.mixCardBorder, defaults.mixCardBorder ?? '#e5e7eb');
    style.mixCardSelectedBg = parseHexColor(input.mixCardSelectedBg, defaults.mixCardSelectedBg ?? '#f0fdf4');
    style.mixCardSelectedBorder = parseHexColor(input.mixCardSelectedBorder, defaults.mixCardSelectedBorder ?? '#22c55e');
    style.mixSummaryBg = parseHexColor(input.mixSummaryBg, defaults.mixSummaryBg ?? '#f9fafb');
    style.mixSummaryBorder = parseHexColor(input.mixSummaryBorder, defaults.mixSummaryBorder ?? '#e5e7eb');
    for (const [key, value] of Object.entries(input)) {
        if (style[key] !== undefined)
            continue;
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            style[key] = value;
        }
    }
    return style;
}
