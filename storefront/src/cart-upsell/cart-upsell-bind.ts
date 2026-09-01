import type { CartUpsellOffer } from '../types';
import { cartUpsellBlockMarkup } from './cart-upsell-ui';

export interface UpsellUiState {
  selected: Set<string>;
  expanded: Set<string>;
  variantMap: Record<string, string>;
  offers: CartUpsellOffer[];
  currency: string;
  adding: boolean;
  error?: string;
}

export function createUpsellState(offers: CartUpsellOffer[], currency = 'USD'): UpsellUiState {
  const variantMap: Record<string, string> = {};
  for (const offer of offers) {
    for (const product of offer.suggested) {
      const first = product.variants?.[0]?.id;
      if (first) variantMap[product.productId] = first;
    }
  }
  return {
    selected: new Set(),
    expanded: new Set(),
    variantMap,
    offers,
    currency,
    adding: false,
  };
}

export function paintUpsell(root: HTMLElement, state: UpsellUiState): void {
  const html = state.offers
    .map((offer) =>
      cartUpsellBlockMarkup(
        offer,
        state.selected,
        state.expanded,
        state.variantMap,
        state.currency,
      ),
    )
    .join('');
  root.innerHTML = html;

  if (state.error) {
    const err = root.querySelector('[data-pb-upsell-error]');
    if (err instanceof HTMLElement) {
      err.hidden = false;
      err.textContent = state.error;
    }
  }
}

export function toggleUpsellSelection(state: UpsellUiState, productId: string): void {
  if (state.selected.has(productId)) {
    state.selected.delete(productId);
  } else {
    state.selected.add(productId);
    state.expanded.add(productId);
  }
}

export function selectedUpsellLines(state: UpsellUiState): {
  ruleId: string;
  productId: string;
  quantity: number;
  variantId?: string;
}[] {
  const lines: { ruleId: string; productId: string; quantity: number; variantId?: string }[] = [];
  for (const offer of state.offers) {
    for (const product of offer.suggested) {
      if (!state.selected.has(product.productId)) continue;
      lines.push({
        ruleId: offer.ruleId,
        productId: product.productId,
        quantity: 1,
        variantId: state.variantMap[product.productId],
      });
    }
  }
  return lines;
}

export function hasUpsellSelection(state: UpsellUiState): boolean {
  return state.selected.size > 0;
}
