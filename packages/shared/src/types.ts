export type RuleType =
  | 'FIXED_BUNDLE'
  | 'MIX_AND_MATCH'
  | 'VOLUME_DISCOUNT'
  | 'CART_UPSELL';

export type RuleStatus = 'ACTIVE' | 'DRAFT' | 'DISABLED';

export type DiscountType = 'NONE' | 'PERCENTAGE' | 'FIXED_AMOUNT' | 'SET_PRICE';

/** Discount modes used on volume / mix tiers (never NONE). */
export type TierDiscountType = Exclude<DiscountType, 'NONE'>;

export type DisplayOn = 'PRIMARY' | 'ALL_ITEMS';

export type OfferLayout = 'VERTICAL' | 'HORIZONTAL';

export type ProductDivider = 'LINE' | 'PLUS' | 'PLUS_LINE';

export type PlanTier = 'FREE' | 'STARTER' | 'GROWTH' | 'PRO';

export interface BundleItem {
  productId: string;
  name?: string;
  imageUrl?: string;
  isPrimary?: boolean;
  minQuantity?: number;
  price?: number;
  sku?: string;
  defaultVariantId?: string;
  adminLocksVariant?: boolean;
  chooseVariationPerItem?: boolean;
}

export interface BundleItemsWrap {
  components: BundleItem[];
}

export interface VolumeTier {
  qty: number;
  discountType: TierDiscountType;
  discountValue: number;
  title?: string;
  imageUrl?: string;
  imageRadius?: number;
  imageSize?: number;
}

export interface VolumeTiersWrap {
  tiers: VolumeTier[];
}

export interface WidgetStyle {
  checkoutLabel?: string;
  promoLabel?: string;
  blockTitle?: string;
  addToCartText?: string;
  addingToCartText?: string;
  addToCartErrorText?: string;
  summaryBuy?: string;
  summarySave?: string;
  standardPriceText?: string;
  buyAllAtText?: string;
  buyAllTagText?: string;
  qtyPromptText?: string;
  summaryTitle?: string;
  summarySubtitle?: string;
  salePriceText?: string;
  totalItemsLabel?: string;
  savingsBadgeText?: string;
  variantLabel?: string;
  outOfStockText?: string;
  unavailableOptionText?: string;
  volumeUnavailableText?: string;
  editorHtml?: string;
  layout?: OfferLayout;
  dividerStyle?: ProductDivider;
  blockTitleColor?: string;
  blockTitleSize?: number;
  offerCardBg?: string;
  offerCardBorder?: string;
  offerCardSelectedBg?: string;
  offerCardSelectedBorder?: string;
  offerTitleColor?: string;
  offerTitleSize?: number;
  offerSubtitleColor?: string;
  offerSubtitleSize?: number;
  priceColor?: string;
  priceSize?: number;
  variationColor?: string;
  variationSize?: number;
  ctaBg?: string;
  ctaColor?: string;
  ctaSize?: number;
  ctaRadius?: number;
  ctaWidth?: number;
  ctaActiveBg?: string;
  ctaSuccessBg?: string;
  productTitleColor?: string;
  productTitleSize?: number;
  productQtyColor?: string;
  productQtySize?: number;
  productPriceColor?: string;
  productPriceSize?: number;
  productDivider?: ProductDivider;
  variationsWidth?: number;
  buyAllColor?: string;
  buyAllSize?: number;
  buyAllPriceColor?: string;
  buyAllPriceSize?: number;
  buyAllTagColor?: string;
  buyAllTagSize?: number;
  mixCardBg?: string;
  mixCardBorder?: string;
  mixCardSelectedBg?: string;
  mixCardSelectedBorder?: string;
  mixSummaryBg?: string;
  mixSummaryBorder?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface BundleRule {
  id: string;
  title: string;
  ruleType: RuleType;
  discountType: DiscountType;
  discountValue: number;
  status: RuleStatus;
  primaryProductId?: string;
  displayOn?: DisplayOn;
  applyToAllProducts: boolean;
  targetProductId?: string;
  layout?: OfferLayout;
  widgetStyle: WidgetStyle;
  items: BundleItemsWrap;
  sourceCollectionId?: string;
  requiredCount?: number;
  volumeTiers: VolumeTiersWrap;
  triggerProductIds: string[];
  suggestedProductIds: string[];
  allowVariantChoice: boolean;
  storeId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Draft / form input before persistence. */
export type RuleFormInput = Partial<BundleRule> & {
  ruleType: RuleType;
  title?: string;
};

export interface AppSettings {
  id?: string;
  storeId: string;
  title?: string;
  widgetTitle?: string;
  buttonLabel?: string;
  showSavingsBadge?: boolean;
  themeSyncEnabled?: boolean;
  stockShieldEnabled?: boolean;
  stockThreshold?: number;
  planTier: PlanTier;
  monthlyViewsLimit: number;
  currentViewsCount: number;
  viewsPeriod: string;
  cartUpsellEnabled?: boolean;
}

export interface RuleImpression {
  id?: string;
  bundleRuleId: string;
  orderId: string;
  revenueGenerated: number;
  converted: boolean;
}

export interface CatalogProduct {
  id: string;
  name: string;
  sku?: string;
  price: number;
  compareToPrice?: number;
  imageUrl?: string;
  inStock: boolean;
  quantity?: number;
  variants?: CatalogVariant[];
  options?: CatalogOption[];
}

export interface CatalogVariant {
  id: string;
  sku?: string;
  price: number;
  compareToPrice?: number;
  inStock: boolean;
  quantity?: number;
  options: Record<string, string>;
}

export interface CatalogOption {
  name: string;
  type: string;
  choices: string[];
}

export interface CartQtyLine {
  productId: string;
  quantity: number;
}

export interface CartQtyMap {
  [productId: string]: number;
}

export interface PricedLine {
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  catalogPrice: number;
  dealId?: string;
  offerId: string;
  promoLabel?: string;
  options?: Record<string, string>;
}

export interface CartLineSnapshot {
  lineId?: string;
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  catalogPrice: number;
  offerId?: string;
  dealId?: string;
  options?: Record<string, string>;
}

export interface StorefrontWidgetView {
  rule: BundleRule;
  products: CatalogProduct[];
  original: number;
  discounted: number;
  savings: number;
  overViewLimit: boolean;
  mixRequiredCount?: number;
  mixPoolProductIds?: string[];
}

export interface CartUpsellView {
  rule: BundleRule;
  suggested: CatalogProduct[];
  checkoutCtaLabel: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
