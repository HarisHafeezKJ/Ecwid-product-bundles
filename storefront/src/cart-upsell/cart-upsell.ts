import { addCartUpsellLines, fetchCartUpsell } from '../api';
import { cartProductIds, getCart, goToCheckout, refreshCart } from '../ecwid';
import type { CartUpsellOffer, CartUpsellResponse, EcwidPage } from '../types';
import { debounce, optionalCopyText } from '../utils';
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
  UPSELL_MOUNT_ID,
} from './cart-upsell-mount';

let state: UpsellUiState | null = null;
let teardownCheckout: (() => void) | null = null;
let cartChangeBound = false;
let lastCartPage: EcwidPage | undefined;
let lastUpsellProductIds = '';

const debouncedRefresh = debounce(() => void refreshCartUpsell(), 800);

function normalizeCartUpsellResponse(
  response: CartUpsellResponse | null,
): { offers: CartUpsellOffer[]; currency: string } {
  if (!response) return { offers: [], currency: 'USD' };

  const currency = response.currency ?? 'USD';
  if (response.offers?.length) {
    return { offers: response.offers, currency };
  }

  const view = response.view;
  if (!view?.rule?.id || !view.suggested?.length) {
    return { offers: [], currency };
  }

  const style = view.rule.widgetStyle ?? {};
  return {
    currency,
    offers: [
      {
        ruleId: view.rule.id,
        blockTitle: optionalCopyText(style.blockTitle),
        addToCartText: optionalCopyText(style.addToCartText),
        buyAllTagText: optionalCopyText(style.buyAllTagText),
        checkoutCtaLabel: view.checkoutCtaLabel ?? optionalCopyText(style.checkoutCtaLabel),
        widgetStyle: style,
        suggested: view.suggested.map((product) => ({
          productId: product.id,
          name: product.name,
          imageUrl: product.imageUrl,
          price: product.price,
          inStock: product.inStock,
          variants: (product.variants ?? []).map((variant) => ({
            ...variant,
            label: variant.label || variant.id,
          })),
        })),
      },
    ],
  };
}

/**
 * `pb-cart-changed` only covers our own add-to-cart paths. Native Ecwid quantity and
 * remove controls mutate the cart without it, so the cart DOM is watched too.
 */
function ensureCartChangeListener(): void {
  if (cartChangeBound) return;
  cartChangeBound = true;

  const trigger = () => debouncedRefresh();

  // Our own repaint mutates the mount, which sits inside the cart container — ignoring
  // anything originating there keeps the observer from re-triggering itself forever.
  const isOwnUi = (node: Node | null): boolean =>
    node instanceof Element ? Boolean(node.closest(`#${UPSELL_MOUNT_ID}`)) : false;

  document.addEventListener('pb-cart-changed', trigger);

  document.addEventListener(
    'change',
    (event) => {
      if (!isOwnUi(event.target as Node | null)) trigger();
    },
    true,
  );

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element) || isOwnUi(target)) return;
    if (target.closest('.ec-cart-item__control, .ec-cart-item__count, .ec-cart__products')) {
      trigger();
    }
  });

  const cartRoot = document.querySelector('.ec-cart, .ecwid-cart, [data-hook="cart-page"]');
  if (cartRoot) {
    new MutationObserver((records) => {
      if (records.every((record) => isOwnUi(record.target))) return;
      trigger();
    }).observe(cartRoot, { childList: true, subtree: true });
  }
}

/** Marked per-element: the mount is destroyed and recreated whenever the cart empties. */
function ensureUpsellEvents(mount: HTMLElement): void {
  if (mount.dataset.pbUpsellBound === 'true') return;
  mount.dataset.pbUpsellBound = 'true';

  mount.addEventListener('click', (event) => {
    const ui = state;
    if (!ui) return;

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
    const ui = state;
    if (!ui) return;

    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    if (!target.matches('[data-pb-upsell-variant]')) return;
    const productId = target.dataset.productId;
    if (productId) ui.variantMap[productId] = target.value;
  });
}

function bindCheckoutIntercept(ui: UpsellUiState): void {
  if (teardownCheckout) teardownCheckout();
  teardownCheckout = interceptNativeCheckout(() => {
    if (state && hasUpsellSelection(state)) {
      void checkoutSelected(state);
    } else {
      clickNativeCheckout();
    }
  });
}

function discardUpsell(): void {
  removeCartUpsellMount();
  state = null;
}

/**
 * The mount is torn down whenever the cart empties or a fetch fails, so both entry
 * points re-create it here rather than bailing out on a missing element — otherwise
 * the upsell would stay dead for the rest of the cart-page session.
 */
async function renderCartUpsell(preserveSelection: boolean): Promise<void> {
  const mount = ensureCartUpsellMount(lastCartPage);
  if (!mount) {
    discardUpsell();
    return;
  }

  ensureCartChangeListener();
  ensureUpsellEvents(mount);

  const previous = preserveSelection && state ? state : null;

  const cart = await getCart();
  const productIds = cartProductIds(cart);
  if (!productIds.length) {
    lastUpsellProductIds = '';
    discardUpsell();
    return;
  }

  const fp = productIds.slice().sort().join(',');
  if (preserveSelection && fp === lastUpsellProductIds && state) return;
  lastUpsellProductIds = fp;

  try {
    const response = await fetchCartUpsell(productIds);
    const { offers, currency } = normalizeCartUpsellResponse(response);
    if (!offers.length) {
      discardUpsell();
      return;
    }

    const next = createUpsellState(offers, currency || previous?.currency || 'USD');
    if (previous) {
      for (const id of previous.selected) {
        const stillOffered = offers.some((offer) =>
          offer.suggested.some((product) => product.productId === id),
        );
        if (!stillOffered) continue;
        next.selected.add(id);
        next.expanded.add(id);
        if (previous.variantMap[id]) next.variantMap[id] = previous.variantMap[id];
      }
    }

    state = next;
    paintUpsell(mount, next);
    bindCheckoutIntercept(next);
  } catch (err) {
    console.warn('[pb-bundles] Cart upsell failed', err);
    if (!preserveSelection) discardUpsell();
  }
}

export async function runCartUpsell(page?: EcwidPage): Promise<void> {
  lastCartPage = page;
  await renderCartUpsell(false);
}

async function refreshCartUpsell(): Promise<void> {
  await renderCartUpsell(true);
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
    if (mount && state) paintUpsell(mount, state);
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
  lastCartPage = undefined;
  lastUpsellProductIds = '';
  discardUpsell();
}
