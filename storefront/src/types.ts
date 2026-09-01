export type RuleType =
  | 'FIXED_BUNDLE'
  | 'MIX_AND_MATCH'
  | 'VOLUME_DISCOUNT'
  | 'CART_UPSELL';

export type OfferLayout = 'VERTICAL' | 'HORIZONTAL';

export type BundleDivider = 'LINE' | 'PLUS' | 'PLUS_LINE';

export interface WidgetStyle {
  blockTitle?: string;
  addToCartText?: string;
  addingToCartText?: string;
  addToCartErrorText?: string;
  buyAllAtText?: string;
  buyAllTagText?: string;
  summaryBuy?: string;
  summarySave?: string;
  standardPriceText?: string;
  outOfStockText?: string;
  unavailableOptionText?: string;
  checkoutLabel?: string;
  promoLabel?: string;
  mixCtaSelectMore?: string;
  mixCtaAdd?: string;
  checkoutCtaLabel?: string;
  divider?: BundleDivider;
  layout?: OfferLayout;
  [key: string]: string | number | boolean | undefined;
}

export interface VariantOption {
  id: string;
  label: string;
  inStock: boolean;
  price?: number;
}

export interface WidgetProductItem {
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
  variants?: VariantOption[];
}

export interface VolumeTierView {
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

export interface StorefrontWidgetView {
  ruleId: string;
  ruleType: RuleType;
  overViewLimit?: boolean;
  status?: string;
  layout?: OfferLayout;
  allowVariantChoice?: boolean;
  chooseVariationPerItem?: boolean;
  mixRequiredCount?: number;
  widgetStyle: WidgetStyle;
  items: WidgetProductItem[];
  volumeTiers?: VolumeTierView[];
  discounted?: number;
  original?: number;
  savings?: number;
  mixDiscounted?: number;
  mixOriginal?: number;
  mixSavings?: number;
  currency?: string;
  targetProductId?: string;
}

export interface OfferResponse {
  view?: StorefrontWidgetView;
  views?: StorefrontWidgetView[];
}

export interface DiscountedLine {
  productId: string;
  quantity: number;
  variantId?: string;
}

export interface AddDiscountedRequest {
  ruleId: string;
  lines: DiscountedLine[];
  cartId?: string;
}

export interface AddDiscountedResponse {
  ok: boolean;
  cartId?: string;
  lines?: PricedLineResponse[];
  ecwidLines?: EcwidCartLinePayload[];
}

export interface PricedLineResponse {
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  catalogPrice?: number;
  options?: Record<string, string>;
}

export interface EcwidAddProductPayload {
  id: number;
  quantity: number;
  options?: Record<string, string>;
  selectedPrice?: number;
}

export interface EcwidCartLinePayload {
  productId: number;
  quantity: number;
  options?: Record<string, string>;
  selectedPrice?: number;
}

export interface CartUpsellProduct {
  productId: string;
  name: string;
  imageUrl?: string;
  price: number;
  inStock?: boolean;
  variants?: VariantOption[];
}

export interface CartUpsellOffer {
  ruleId: string;
  blockTitle?: string;
  addToCartText?: string;
  buyAllTagText?: string;
  checkoutCtaLabel?: string;
  widgetStyle?: WidgetStyle;
  suggested: CartUpsellProduct[];
}

export interface CartUpsellResponse {
  enabled?: boolean;
  offers?: CartUpsellOffer[];
}

export interface EcwidPage {
  type?: string;
  productId?: number;
}

export interface EcwidCartItem {
  product?: { id?: number };
  productId?: number;
  quantity?: number;
  options?: Record<string, string>;
}

export interface EcwidCart {
  cartId?: string;
  id?: string;
  items?: EcwidCartItem[];
}

declare global {
  interface Window {
    Ecwid?: EcwidApi;
    PbBundles?: { init: () => void };
  }
}

export interface EcwidApi {
  getOwnerId?: () => number;
  getProductId?: () => number;
  getPageType?: () => string;
  getAppPublicToken?: (clientId: string) => string | Promise<string>;
  getAppPublicConfig?: (clientId: string) => unknown;
  OnAPILoaded?: EcwidEventHub;
  OnPageLoad?: EcwidEventHub;
  OnPageLoaded?: EcwidEventHub<{ (page: EcwidPage): void }>;
  Cart?: {
    get?: (cb: (cart: EcwidCart) => void) => void;
    addProduct?: (
      product: EcwidAddProductPayload | EcwidCartLinePayload | number,
      callback?: (
        success: boolean,
        product: unknown,
        cart: EcwidCart,
        error?: string,
      ) => void,
    ) => void;
    calculateTotal?: (cb: () => void) => void;
  };
  gotoCheckoutPage?: () => void;
  openPage?: (page: string) => void;
}

export interface EcwidEventHub<T extends (...args: never[]) => void = () => void> {
  add: (fn: T) => void;
}
