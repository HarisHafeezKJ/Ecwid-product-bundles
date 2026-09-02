import type { StorefrontWidgetView, VariantOption, WidgetProductItem } from '../types';
import { addDiscounted } from '../api';
import { cartIdFrom, getCart, refreshCart } from '../ecwid';
import { getEcwid } from '../ecwid';
import type { EcwidCart, EcwidCartLinePayload, EcwidAddProductPayload, PricedLineResponse } from '../types';
import { qs, withTimeout, asCopyText } from '../utils';
import { applyWidgetStyle, mirrorNativeAtcTheme } from './widget-style-css';

const PB_STAMP_KEYS = new Set(['pbOfferId', 'pbDealId', 'pbKind']);
const ECWID_ADD_TIMEOUT_MS = 4000;

export interface WidgetShellState {
  view: StorefrontWidgetView;
  adding: boolean;
  error?: string;
  volumeQty: number;
  variantSelections: Record<string, string>;
  mixQtys: Record<string, number>;
}

export function createShellState(view: StorefrontWidgetView): WidgetShellState {
  const defaultQty =
    view.ruleType === 'VOLUME_DISCOUNT'
      ? view.volumeTiers?.[0]?.qty ?? 1
      : 0;
  const mixQtys: Record<string, number> = {};
  for (const item of view.items) mixQtys[item.productId] = 0;

  const variantSelections: Record<string, string> = {};
  primeVariantSelections(view.items, variantSelections);

  return {
    view,
    adding: false,
    volumeQty: defaultQty,
    variantSelections,
    mixQtys,
  };
}

export function primeVariantSelections(
  items: WidgetProductItem[],
  map: Record<string, string>,
): void {
  for (const item of items) {
    const variants = item.variants ?? [];
    if (variants.length <= 1) continue;
    const defaultId = item.defaultVariantId ?? variants[0]?.id;
    if (defaultId) map[item.productId] = defaultId;
  }
}

export function mountWidgetShell(
  container: HTMLElement,
  html: string,
  view: StorefrontWidgetView,
): HTMLElement {
  container.innerHTML = html;
  const root = qs<HTMLElement>(container, '.pb-widget') ?? container;
  applyWidgetStyle(root, view.widgetStyle);
  mirrorNativeAtcTheme(root);
  return root;
}

export async function addDiscountedAndRefresh(
  ruleId: string,
  lines: { productId: string; quantity: number; variantId?: string }[],
): Promise<void> {
  const cart = await getCart();
  const cartId = cartIdFrom(cart);
  const result = await addDiscounted({ ruleId, lines, cartId });

  const ecwidLines = result.ecwidLines?.length
    ? result.ecwidLines
    : pricedLinesToEcwidLines(result.lines ?? []);

  if (!ecwidLines.length) {
    throw new Error('Could not add to cart.');
  }

  await addEcwidLines(ecwidLines);

  // addEcwidLines already refreshed; this second pass lets Ecwid pick up the
  // server-calculated bundle discount (discountUrl) without blocking the success state.
  document.dispatchEvent(new CustomEvent('pb-cart-changed'));
  window.setTimeout(() => void refreshCart(), 400);
}

function pricedLinesToEcwidLines(lines: PricedLineResponse[]): EcwidCartLinePayload[] {
  return lines.map((line) => ({
    productId: Number(line.productId),
    quantity: line.quantity,
    ...(line.options && Object.keys(line.options).length > 0 ? { options: line.options } : {}),
    selectedPrice: line.unitPrice,
  }));
}

function stripStampOptions(options?: Record<string, string>): Record<string, string> | undefined {
  if (!options) return undefined;
  const stripped: Record<string, string> = {};
  for (const [key, value] of Object.entries(options)) {
    if (!PB_STAMP_KEYS.has(key)) stripped[key] = value;
  }
  return Object.keys(stripped).length > 0 ? stripped : undefined;
}

function toEcwidAddPayload(line: EcwidCartLinePayload): EcwidAddProductPayload {
  return {
    id: line.productId,
    quantity: line.quantity,
    ...(line.options ? { options: line.options } : {}),
    ...(line.selectedPrice != null ? { selectedPrice: line.selectedPrice } : {}),
  };
}

type EcwidCartApi = NonNullable<NonNullable<ReturnType<typeof getEcwid>>['Cart']>;

interface BundleTarget {
  line: EcwidCartLinePayload;
  variantOptions?: Record<string, string>;
  wanted: number;
  /** Cart quantity before the add, matched with and without the variant options. */
  baseline: number;
  baselineAnyOption: number;
}

function targetKey(productId: number, options?: Record<string, string>): string {
  const entries = Object.entries(options ?? {}).sort(([a], [b]) => a.localeCompare(b));
  return `${productId}|${entries.map(([k, v]) => `${k}=${v}`).join('&')}`;
}

/**
 * Ecwid has no batch cart API — neither the storefront JS nor REST can add several items
 * in one call — so the whole bundle is dispatched in a single concurrent pass and verified
 * once against the resulting cart. Adding line by line with a verification round-trip per
 * line is what made a three-item bundle take the better part of a minute.
 */
async function addEcwidLines(lines: EcwidCartLinePayload[]): Promise<void> {
  const cartApi = getEcwid()?.Cart;
  if (!cartApi?.addProduct) {
    throw new Error('Ecwid cart is not available.');
  }

  const targets = new Map<string, BundleTarget>();
  for (const line of lines) {
    const variantOptions = stripStampOptions(line.options);
    const key = targetKey(line.productId, variantOptions);
    const existing = targets.get(key);
    if (existing) existing.wanted += line.quantity;
    else {
      targets.set(key, {
        line,
        variantOptions,
        wanted: line.quantity,
        baseline: 0,
        baselineAnyOption: 0,
      });
    }
  }

  const before = await getCart();
  for (const target of targets.values()) {
    target.baseline = lineQtyInCart(before, target.line.productId, target.variantOptions);
    target.baselineAnyOption = lineQtyInCart(before, target.line.productId);
  }

  let pending = [...targets.values()].map((target) => ({ target, missing: target.wanted }));

  // Each pass drops one payload feature that Ecwid may reject: selectedPrice needs
  // nameYourPriceEnabled on the product, and options must match a real variation.
  const passes: ((target: BundleTarget, missing: number) => EcwidCartLinePayload)[] = [
    (target, missing) => ({ ...target.line, quantity: missing, options: target.variantOptions }),
    (target, missing) => ({
      ...target.line,
      quantity: missing,
      options: target.variantOptions,
      selectedPrice: undefined,
    }),
    (target, missing) => ({
      ...target.line,
      quantity: missing,
      options: undefined,
      selectedPrice: undefined,
    }),
  ];

  for (let pass = 0; pass < passes.length && pending.length > 0; pass++) {
    const build = passes[pass]!;
    await Promise.all(
      pending.map(({ target, missing }) => dispatchAdd(cartApi, build(target, missing))),
    );
    await refreshCart();

    // The final pass drops options, so matching lines can no longer be identified by them.
    const ignoreOptions = pass === passes.length - 1;
    pending = await measureShortfalls([...targets.values()], ignoreOptions);
  }

  if (pending.length === targets.size) {
    throw new Error('Could not add to cart.');
  }
  if (pending.length > 0) {
    const added = targets.size - pending.length;
    throw new Error(`Only ${added} of ${targets.size} bundle items were added to the cart.`);
  }
}

async function measureShortfalls(
  targets: BundleTarget[],
  ignoreOptions: boolean,
): Promise<{ target: BundleTarget; missing: number }[]> {
  const cart = await getCart();
  const shortfalls: { target: BundleTarget; missing: number }[] = [];

  for (const target of targets) {
    const baseline = ignoreOptions ? target.baselineAnyOption : target.baseline;
    const options = ignoreOptions ? undefined : target.variantOptions;
    const current = lineQtyInCart(cart, target.line.productId, options);
    const missing = baseline + target.wanted - current;
    if (missing > 0) shortfalls.push({ target, missing });
  }

  return shortfalls;
}

function dispatchAdd(cartApi: EcwidCartApi, line: EcwidCartLinePayload): Promise<void> {
  return withTimeout(
    new Promise<void>((resolve) => {
      cartApi.addProduct!(toEcwidAddPayload(line), (success, _product, _cart, error) => {
        if (!success) {
          console.warn('[pb-bundles] Ecwid addProduct failed', line, error);
        }
        resolve();
      });
    }),
    // Instant Site sometimes applies the add without ever invoking the callback, so this
    // is a floor on progress, not a failure signal — the cart check below decides.
    ECWID_ADD_TIMEOUT_MS,
    undefined,
  );
}

function cartItemMatchesLine(
  item: NonNullable<EcwidCart['items']>[number],
  productId: number,
  options?: Record<string, string>,
): boolean {
  const id = item.product?.id ?? item.productId;
  if (Number(id) !== productId) return false;
  if (!options || Object.keys(options).length === 0) return true;

  const itemOptions = item.options ?? item.selectedOptions ?? {};
  return Object.entries(options).every(([key, value]) => itemOptions[key] === value);
}

function lineQtyInCart(
  cart: EcwidCart | null,
  productId: number,
  options?: Record<string, string>,
): number {
  if (!cart?.items?.length) return 0;
  return cart.items.reduce((sum, item) => {
    if (!cartItemMatchesLine(item, productId, options)) return sum;
    return sum + Math.max(0, Number(item.quantity ?? 0));
  }, 0);
}

export function showWidgetError(root: HTMLElement, message: string): void {
  const err = qs<HTMLElement>(root, '[data-pb-error]');
  if (err) {
    err.hidden = false;
    err.textContent = message;
  }
  const btn = qs<HTMLButtonElement>(root, '[data-pb-atc]');
  if (btn) {
    btn.hidden = false;
    btn.style.visibility = 'visible';
    btn.classList.remove('pb-btn--success');
  }
  // The error element already carries role="alert"; also writing to the polite live
  // region would make screen readers announce the same message twice.
}

export function clearWidgetError(root: HTMLElement): void {
  const err = qs<HTMLElement>(root, '[data-pb-error]');
  if (err) {
    err.hidden = true;
    err.textContent = '';
  }
}

export function announceAtcStatus(root: HTMLElement, message: string): void {
  const live = qs<HTMLElement>(root, '[data-pb-atc-status]');
  if (!live) return;
  live.textContent = '';
  window.setTimeout(() => {
    live.textContent = message;
  }, 50);
}

export function showAtcSuccess(root: HTMLElement, state: WidgetShellState): void {
  clearWidgetError(root);
  const btn = qs<HTMLButtonElement>(root, '[data-pb-atc]');
  if (!btn) return;
  const successText = asCopyText(state.view.widgetStyle.addedToCartText, 'Added to cart');
  btn.classList.add('pb-btn--success');
  btn.disabled = false;
  btn.textContent = successText;
  announceAtcStatus(root, successText);
  window.setTimeout(() => {
    btn.classList.remove('pb-btn--success');
    setAddingState(root, false, state.view);
  }, 2500);
}

function findVariant(item: WidgetProductItem, variantId: string | undefined): VariantOption | undefined {
  const variants = item.variants ?? [];
  if (variants.length <= 1) return variants[0];
  if (!variantId) return undefined;
  return variants.find((v) => v.id === variantId);
}

function validateLineStock(
  view: StorefrontWidgetView,
  productId: string,
  variantId?: string,
): string | null {
  const style = view.widgetStyle;
  const item = view.items.find((row) => row.productId === productId);
  if (!item) return null;

  if (item.inStock === false) {
    return asCopyText(style.outOfStockText, 'This product is out of stock.');
  }

  const hasVariants = (item.variants?.length ?? 0) > 1;
  if (hasVariants && !variantId) {
    return asCopyText(style.unavailableOptionText, 'Please select an option.');
  }

  const variant = hasVariants ? findVariant(item, variantId) : item.variants?.[0];
  if (variant && !variant.inStock) {
    return asCopyText(style.outOfStockText, 'Selected option is out of stock.');
  }

  return null;
}

export function validateWidgetBeforeAtc(
  state: WidgetShellState,
  lines: { productId: string; quantity: number; variantId?: string }[],
): string | null {
  if (!lines.length) {
    return asCopyText(state.view.widgetStyle.addToCartErrorText, 'Could not add to cart.');
  }

  for (const line of lines) {
    if (line.quantity <= 0) continue;
    const error = validateLineStock(state.view, line.productId, line.variantId);
    if (error) return error;
  }

  return null;
}

export function setAddingState(root: HTMLElement, adding: boolean, view: StorefrontWidgetView): void {
  const btn = qs<HTMLButtonElement>(root, '[data-pb-atc]');
  if (!btn) return;
  btn.disabled = adding;
  btn.textContent = adding
    ? asCopyText(view.widgetStyle.addingToCartText, 'Adding...')
    : asCopyText(view.widgetStyle.addToCartText, 'Add to cart');
}

export function collectBundleLines(
  view: StorefrontWidgetView,
  selections: Record<string, string>,
): { productId: string; quantity: number; variantId?: string }[] {
  const lines: { productId: string; quantity: number; variantId?: string }[] = [];
  for (const item of view.items) {
    const qty = item.minQuantity || 1;
    const hasVariants = (item.variants?.length ?? 0) > 1;
    if (item.chooseVariationPerItem && qty > 1 && hasVariants) {
      for (let u = 0; u < qty; u++) {
        const key = `${item.productId}__u${u}`;
        lines.push({
          productId: item.productId,
          quantity: 1,
          variantId: selections[key] ?? selections[item.productId],
        });
      }
    } else {
      lines.push({
        productId: item.productId,
        quantity: qty,
        variantId: hasVariants ? selections[item.productId] : undefined,
      });
    }
  }
  return lines;
}

export function collectVolumeLines(
  view: StorefrontWidgetView,
  qty: number,
  selections: Record<string, string>,
): { productId: string; quantity: number; variantId?: string }[] {
  const target = view.targetProductId ?? view.items[0]?.productId;
  if (!target) return [];
  if (view.allowVariantChoice && qty > 1 && (view.items[0]?.variants?.length ?? 0) > 1) {
    return Array.from({ length: qty }, (_, u) => ({
      productId: target,
      quantity: 1,
      variantId: selections[`${target}__u${u}`] ?? selections[target],
    }));
  }
  return [{ productId: target, quantity: qty, variantId: selections[target] }];
}

export function collectMixLines(
  view: StorefrontWidgetView,
  mixQtys: Record<string, number>,
  selections: Record<string, string>,
): { productId: string; quantity: number; variantId?: string }[] {
  const lines: { productId: string; quantity: number; variantId?: string }[] = [];
  for (const item of view.items) {
    const qty = mixQtys[item.productId] ?? 0;
    if (qty <= 0) continue;
    lines.push({
      productId: item.productId,
      quantity: qty,
      variantId: selections[item.productId],
    });
  }
  return lines;
}

export function mixSelectedQty(mixQtys: Record<string, number>): number {
  return Object.values(mixQtys).reduce((sum, n) => sum + (n || 0), 0);
}

export function bindVariantSelects(
  root: HTMLElement,
  state: WidgetShellState,
  onChange?: () => void,
): void {
  root.querySelectorAll<HTMLSelectElement>('.pb-variant__select').forEach((sel) => {
    sel.addEventListener('change', () => {
      const productId = sel.dataset.productId ?? '';
      const unit = sel.dataset.unit ?? '0';
      const key = unit === '0' ? productId : `${productId}__u${unit}`;
      state.variantSelections[key] = sel.value;
      onChange?.();
    });
    const productId = sel.dataset.productId ?? '';
    const unit = sel.dataset.unit ?? '0';
    const key = unit === '0' ? productId : `${productId}__u${unit}`;
    if (state.variantSelections[key]) sel.value = state.variantSelections[key];
  });
}
