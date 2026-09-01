import type {
  RuleType,
  OfferLayout,
  WidgetStyle,
  SerializedStorefrontWidgetView,
  SerializedWidgetProductItem,
  SerializedVolumeTierView,
  StorefrontOfferResponse,
} from '@pb/shared';

export type {
  RuleType,
  OfferLayout,
  WidgetStyle,
  SerializedStorefrontWidgetView,
  SerializedWidgetProductItem,
  SerializedVolumeTierView,
  StorefrontOfferResponse,
};

export type BundleDivider = 'LINE' | 'PLUS' | 'PLUS_LINE';

export type StorefrontWidgetView = SerializedStorefrontWidgetView;
export type OfferResponse = StorefrontOfferResponse;
export type WidgetProductItem = SerializedWidgetProductItem;
export type VolumeTierView = SerializedVolumeTierView;
export type VariantOption = NonNullable<SerializedWidgetProductItem['variants']>[number];

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
  serverAdded?: boolean;
  failedLines?: { productId: string; variantId?: string; added: boolean; error?: string }[];
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
  currency?: string;
  offers?: CartUpsellOffer[];
  view?: {
    rule: {
      id: string;
      widgetStyle?: WidgetStyle;
    };
    suggested: {
      id: string;
      name: string;
      imageUrl?: string;
      price: number;
      inStock?: boolean;
      variants?: VariantOption[];
    }[];
    checkoutCtaLabel?: string;
  };
}

export interface CartLineSnapshotPayload {
  lineId?: string;
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  catalogPrice: number;
  options?: Record<string, string>;
}

export interface EcwidPage {
  type?: string;
  productId?: number;
}

export interface EcwidCartItem {
  id?: number | string;
  product?: { id?: number; price?: number };
  productId?: number;
  quantity?: number;
  price?: number;
  productPrice?: number;
  catalogPrice?: number;
  combinationId?: number | string;
  options?: Record<string, string>;
  selectedOptions?: Record<string, string>;
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
