export function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (value == null) return fallback;
  return String(value);
}

export function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => asString(v)).filter(Boolean);
}

export function isRuleType(value: unknown): value is import('./types.js').RuleType {
  return (
    value === 'FIXED_BUNDLE' ||
    value === 'MIX_AND_MATCH' ||
    value === 'VOLUME_DISCOUNT' ||
    value === 'CART_UPSELL'
  );
}

export function isDiscountType(value: unknown): value is import('./types.js').DiscountType {
  return (
    value === 'NONE' ||
    value === 'PERCENTAGE' ||
    value === 'FIXED_AMOUNT' ||
    value === 'SET_PRICE'
  );
}
