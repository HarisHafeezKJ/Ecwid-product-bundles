import type { StorefrontWidgetView, WidgetProductItem } from '../types';
import { addDiscounted } from '../api';
import { cartIdFrom, getCart, refreshCart } from '../ecwid';
import { getEcwid } from '../ecwid';
import type { EcwidCartLinePayload } from '../types';
import { qs } from '../utils';
import { applyWidgetStyle } from './widget-style-css';

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
  return root;
}

export async function addDiscountedAndRefresh(
  ruleId: string,
  lines: { productId: string; quantity: number; variantId?: string }[],
): Promise<void> {
  const cart = await getCart();
  const cartId = cartIdFrom(cart);
  const result = await addDiscounted({ ruleId, lines, cartId });

  if (result.ecwidLines?.length) {
    await addEcwidLines(result.ecwidLines);
  }
  await refreshCart();
}

async function addEcwidLines(lines: EcwidCartLinePayload[]): Promise<void> {
  const cartApi = getEcwid()?.Cart;
  if (!cartApi?.addProduct) return;

  for (const line of lines) {
    await new Promise<void>((resolve) => {
      cartApi.addProduct!(line, (success) => {
        if (!success) console.warn('[pb-bundles] Ecwid addProduct failed', line);
        resolve();
      });
    });
  }
}

export function showWidgetError(root: HTMLElement, message: string): void {
  const err = qs<HTMLElement>(root, '[data-pb-error]');
  if (err) {
    err.hidden = false;
    err.textContent = message;
  }
}

export function setAddingState(root: HTMLElement, adding: boolean, view: StorefrontWidgetView): void {
  const btn = qs<HTMLButtonElement>(root, '[data-pb-atc]');
  if (!btn) return;
  btn.disabled = adding;
  btn.textContent = adding
    ? view.widgetStyle.addingToCartText ?? 'Adding...'
    : view.widgetStyle.addToCartText ?? 'Add to cart';
}

export function collectBundleLines(
  view: StorefrontWidgetView,
  selections: Record<string, string>,
): { productId: string; quantity: number; variantId?: string }[] {
  const lines: { productId: string; quantity: number; variantId?: string }[] = [];
  for (const item of view.items) {
    const qty = item.minQuantity || 1;
    if (item.chooseVariationPerItem && qty > 1 && (item.variants?.length ?? 0) > 1) {
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
        variantId: selections[item.productId],
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
