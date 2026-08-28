export function inferApplyToAllProducts(rule) {
    if (rule.applyToAllProducts != null)
        return rule.applyToAllProducts;
    if (rule.displayOn === 'PRIMARY' && rule.primaryProductId)
        return false;
    return true;
}
export function mixPoolProductIds(rule, collectionProductIds = []) {
    const fromItems = (rule.items?.components ?? [])
        .map((item) => item.productId)
        .filter(Boolean);
    if (fromItems.length > 0)
        return fromItems;
    if (rule.sourceCollectionId && collectionProductIds.length > 0) {
        return collectionProductIds.filter(Boolean);
    }
    return [];
}
export function ruleShowsOnProductPage(rule, productId, collectionProductIds = []) {
    if (!productId || rule.ruleType === 'CART_UPSELL')
        return false;
    if (inferApplyToAllProducts(rule))
        return true;
    if (rule.ruleType === 'MIX_AND_MATCH' || rule.ruleType === 'VOLUME_DISCOUNT') {
        const pool = mixPoolProductIds(rule, collectionProductIds);
        return pool.includes(productId) || productId === rule.targetProductId;
    }
    return productId === rule.targetProductId;
}
