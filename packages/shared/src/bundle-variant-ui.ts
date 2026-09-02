export interface VariantPickerItem {
  minQuantity?: number;
  chooseVariationPerItem?: boolean;
  adminLocksVariant?: boolean;
  variants?: readonly unknown[] | unknown[];
}

export function variantOptionCount(item: { variants?: readonly unknown[] | unknown[] }): number {
  return item.variants?.length ?? 0;
}

export function hasMultipleVariants(item: { variants?: readonly unknown[] | unknown[] }): boolean {
  return variantOptionCount(item) > 1;
}

/** How many variant dropdowns to render for a bundle line. */
export function bundleVariantPickerCount(item: VariantPickerItem): number {
  if (!hasMultipleVariants(item)) return 0;
  const qty = Math.max(1, item.minQuantity ?? 1);
  if (item.adminLocksVariant) return 1;
  if (item.chooseVariationPerItem !== false && qty > 1) return qty;
  return 1;
}

/** True when each bundled unit gets its own variant picker (qty > 1). */
export function bundleUsesPerUnitVariantPickers(item: VariantPickerItem): boolean {
  const qty = Math.max(1, item.minQuantity ?? 1);
  return (
    hasMultipleVariants(item) &&
    !item.adminLocksVariant &&
    item.chooseVariationPerItem !== false &&
    qty > 1
  );
}

export function bundleVariantFieldLabel(
  variantLabel: string | undefined,
  unitIndex: number,
  pickerCount: number,
): string {
  const base = variantLabel?.trim() || 'Variation';
  if (pickerCount <= 1) return base;
  return `${base} ${unitIndex + 1}`;
}
