import type { CartUpsellOffer } from '../types';
import { cartUpsellBlockMarkup, checkoutCtaLabel } from './cart-upsell-ui';

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

function offerSignature(offers: CartUpsellOffer[]): string {
  return offers
    .map((offer) => `${offer.ruleId}:${offer.suggested.map((p) => p.productId).join(',')}`)
    .join('|');
}

export function paintUpsell(root: HTMLElement, state: UpsellUiState): void {
  const nextSignature = offerSignature(state.offers);
  const currentSignature = root.dataset.pbUpsellSig ?? '';

  if (!root.firstElementChild || currentSignature !== nextSignature) {
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
    root.dataset.pbUpsellSig = nextSignature;
  } else {
    updateUpsellDom(root, state);
  }

  if (state.error) {
    const err = root.querySelector('[data-pb-upsell-error]');
    if (err instanceof HTMLElement) {
      err.hidden = false;
      err.textContent = state.error;
    }
  } else {
    const err = root.querySelector('[data-pb-upsell-error]');
    if (err instanceof HTMLElement) {
      err.hidden = true;
      err.textContent = '';
    }
  }
}

function updateUpsellDom(root: HTMLElement, state: UpsellUiState): void {
  for (const offer of state.offers) {
    const block = root.querySelector<HTMLElement>(`[data-rule-id="${offer.ruleId}"]`);
    if (!block) continue;

    for (const product of offer.suggested) {
      const card = block.querySelector<HTMLElement>(
        `[data-pb-upsell-card][data-product-id="${product.productId}"]`,
      );
      if (!card) continue;

      const isSelected = state.selected.has(product.productId);
      card.classList.toggle('pb-upsell__card--selected', isSelected);

      const toggleBtn = card.querySelector<HTMLButtonElement>('[data-pb-upsell-toggle]');
      if (toggleBtn) {
        const tag = offer.buyAllTagText ?? 'Selected ✓';
        toggleBtn.textContent = isSelected ? tag : offer.addToCartText ?? 'Select';
      }

      const hasVariants = (product.variants?.length ?? 0) > 1;
      const showVariants = hasVariants && (state.expanded.has(product.productId) || isSelected);
      const variantSelect = card.querySelector<HTMLSelectElement>('[data-pb-upsell-variant]');
      if (showVariants && !variantSelect) {
        // Variant UI appeared — fall back to full repaint for this block only.
        const html = cartUpsellBlockMarkup(
          offer,
          state.selected,
          state.expanded,
          state.variantMap,
          state.currency,
        );
        block.outerHTML = html;
        continue;
      }
      if (variantSelect) {
        variantSelect.hidden = !showVariants;
        const selectedVariant = state.variantMap[product.productId];
        if (selectedVariant) variantSelect.value = selectedVariant;
      }
    }

    const selectedCount = offer.suggested.filter((p) => state.selected.has(p.productId)).length;
    const checkout = block.querySelector<HTMLButtonElement>('[data-pb-upsell-checkout]');
    if (checkout) {
      checkout.disabled = selectedCount === 0 || state.adding;
      checkout.textContent = checkoutCtaLabel(offer.widgetStyle ?? {}, selectedCount);
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
