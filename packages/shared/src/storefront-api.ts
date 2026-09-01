import type { OfferLayout, RuleType, WidgetStyle } from './types.js';

/** JSON shape returned by `/api/storefront/offer` and consumed by `pb-bundles.js`. */
export interface SerializedStorefrontWidgetView {
  ruleId: string;
  ruleType: RuleType;
  overViewLimit?: boolean;
  status?: string;
  layout?: OfferLayout;
  allowVariantChoice?: boolean;
  chooseVariationPerItem?: boolean;
  mixRequiredCount?: number;
  widgetStyle: WidgetStyle;
  items: SerializedWidgetProductItem[];
  volumeTiers?: SerializedVolumeTierView[];
  discounted?: number;
  original?: number;
  savings?: number;
  mixDiscounted?: number;
  mixOriginal?: number;
  mixSavings?: number;
  currency?: string;
  targetProductId?: string;
}

export interface SerializedWidgetProductItem {
  productId: string;
  name: string;
  imageUrl?: string;
  minQuantity: number;
  price: number;
  discountedPrice?: number;
  originalPrice?: number;
  sku?: string;
  isPrimary?: boolean;
  inStock?: boolean;
  defaultVariantId?: string;
  adminLocksVariant?: boolean;
  chooseVariationPerItem?: boolean;
  variants?: SerializedVariantOption[];
}

export interface SerializedVariantOption {
  id: string;
  label: string;
  inStock: boolean;
  price?: number;
}

export interface SerializedVolumeTierView {
  qty: number;
  title?: string;
  discountType?: string;
  discountValue?: number;
  imageUrl?: string;
  imageRadius?: number;
  imageSize?: number;
  unitPrice?: number;
  discountedUnitPrice?: number;
  savings?: number;
}

export interface StorefrontOfferResponse {
  view?: SerializedStorefrontWidgetView;
  views?: SerializedStorefrontWidgetView[];
}

export interface SerializedCartUpsellProduct {
  productId: string;
  name: string;
  imageUrl?: string;
  price: number;
  inStock?: boolean;
  variants?: SerializedVariantOption[];
}

export interface SerializedCartUpsellOffer {
  ruleId: string;
  blockTitle?: string;
  addToCartText?: string;
  buyAllTagText?: string;
  checkoutCtaLabel?: string;
  widgetStyle?: WidgetStyle;
  suggested: SerializedCartUpsellProduct[];
}

export interface CartUpsellApiResponse {
  enabled?: boolean;
  currency?: string;
  offers?: SerializedCartUpsellOffer[];
}
