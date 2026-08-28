import { asBoolean, asNumber, asString } from './guards.js';
export function parseBundleItems(raw) {
    if (!raw || typeof raw !== 'object')
        return { components: [] };
    const obj = raw;
    const componentsRaw = Array.isArray(obj.components) ? obj.components : [];
    const components = [];
    for (const entry of componentsRaw) {
        if (!entry || typeof entry !== 'object')
            continue;
        const row = entry;
        const productId = asString(row.productId);
        if (!productId)
            continue;
        components.push({
            productId,
            name: asString(row.name) || undefined,
            imageUrl: asString(row.imageUrl) || undefined,
            isPrimary: asBoolean(row.isPrimary, false),
            minQuantity: Math.max(1, asNumber(row.minQuantity, 1)),
            price: asNumber(row.price, 0) || undefined,
            sku: asString(row.sku) || undefined,
            defaultVariantId: asString(row.defaultVariantId) || undefined,
            adminLocksVariant: asBoolean(row.adminLocksVariant, false),
            chooseVariationPerItem: asBoolean(row.chooseVariationPerItem, true),
        });
    }
    return { components };
}
