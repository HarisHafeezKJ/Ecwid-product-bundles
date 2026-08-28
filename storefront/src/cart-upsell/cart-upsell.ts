import { addCartUpsellLines, fetchCartUpsell } from '../api';
import { cartProductIds, getCart, goToCheckout, refreshCart } from '../ecwid';
import type { EcwidPage } from '../types';
import {
  createUpsellState,
  hasUpsellSelection,
  paintUpsell,
  selectedUpsellLines,
  toggleUpsellSelection,
  type UpsellUiState,
} from './cart-upsell-bind';
import {
  clickNativeCheckout,
  ensureCartUpsellMount,
  interceptNativeCheckout,
  removeCartUpsellMount,
} from './cart-upsell-mount';

let state: UpsellUiState | null = null;
let teardownCheckout: (() => void) | null = null;

export async function runCartUpsell(page?: EcwidPage): Promise<void> {
  if (!ensureCartUpsellMount(page)) {
    removeCartUpsellMount();
    return;
  }

  const mount = document.getElementById('pb-cart-upsell');
  if (!mount) return;

  const cart = await getCart();
  const productIds = cartProductIds(cart);
  if (!productIds.length) {
    removeCartUpsellMount();
    return;
  }

  try {
    const response = await fetchCartUpsell(productIds);
    const offers = response?.offers ?? [];
    if (!offers.length) {
      removeCartUpsellMount();
      return;
    }

    state = createUpsellState(offers);
    paintUpsell(mount, state);
    bindUpsellEvents(mount, state);

    if (teardownCheckout) teardownCheckout();
    if (hasUpsellSelection(state)) {
      teardownCheckout = interceptNativeCheckout(() => void checkoutSelected(state!));
    } else {
      teardownCheckout = interceptNativeCheckout(() => {
        if (state && hasUpsellSelection(state)) {
          void checkoutSelected(state);
        } else {
          clickNativeCheckout();
        }
      });
    }
  } catch (err) {
    console.warn('[pb-bundles] Cart upsell failed', err);
    removeCartUpsellMount();
  }
}

function bindUpsellEvents(mount: HTMLElement, ui: UpsellUiState): void {
  mount.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const toggle = target.closest('[data-pb-upsell-toggle]');
    if (toggle) {
      const card = toggle.closest('[data-pb-upsell-card]');
      const productId = card?.getAttribute('data-product-id');
      if (productId) {
        toggleUpsellSelection(ui, productId);
        paintUpsell(mount, ui);
      }
      return;
    }

    if (target.closest('[data-pb-upsell-checkout]')) {
      void checkoutSelected(ui);
    }
  });

  mount.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    if (!target.matches('[data-pb-upsell-variant]')) return;
    const productId = target.dataset.productId;
    if (productId) ui.variantMap[productId] = target.value;
  });
}

async function checkoutSelected(ui: UpsellUiState): Promise<void> {
  if (ui.adding) return;
  const lines = selectedUpsellLines(ui);
  if (!lines.length) {
    clickNativeCheckout();
    return;
  }

  ui.adding = true;
  const mount = document.getElementById('pb-cart-upsell');
  const timeout = window.setTimeout(() => {
    ui.adding = false;
    clickNativeCheckout();
  }, 8000);

  try {
    const byRule = groupByRule(lines);
    for (const [ruleId, ruleLines] of Object.entries(byRule)) {
      await addCartUpsellLines({
        ruleId,
        lines: ruleLines.map(({ productId, quantity, variantId }) => ({
          productId,
          quantity,
          variantId,
        })),
      });
    }
    await refreshCart();
    goToCheckout();
  } catch (err) {
    ui.error = err instanceof Error ? err.message : 'Could not add selected items.';
    if (mount) paintUpsell(mount, ui);
    window.setTimeout(() => clickNativeCheckout(), 1500);
  } finally {
    window.clearTimeout(timeout);
    ui.adding = false;
  }
}

function groupByRule(
  lines: ReturnType<typeof selectedUpsellLines>,
): Record<string, typeof lines> {
  const map: Record<string, typeof lines> = {};
  for (const line of lines) {
    map[line.ruleId] ??= [];
    map[line.ruleId].push(line);
  }
  return map;
}

export function teardownCartUpsell(): void {
  teardownCheckout?.();
  teardownCheckout = null;
  state = null;
  removeCartUpsellMount();
}
