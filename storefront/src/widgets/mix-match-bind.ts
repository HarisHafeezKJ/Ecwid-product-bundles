import type { WidgetShellState } from './widget-shell';
import { mixSelectedQty } from './widget-shell';
import { mixMatchMarkup, mixCtaLabel } from './widget-markup';
import { bindVariantSelects } from './widget-shell';
import { computeMixTotals } from './mix-pricing';
import { formatMoney, qs, qsa } from '../utils';

export function bindMixControls(
  root: HTMLElement,
  state: WidgetShellState,
  rerender: () => void,
): void {
  bindVariantSelects(root, state, rerender);

  qsa<HTMLElement>(root, '[data-pb-qty-stepper]').forEach((stepper) => {
    const productEl = stepper.closest<HTMLElement>('[data-product-id]');
    const productId = productEl?.dataset.productId;
    if (!productId) return;

    const input = qs<HTMLInputElement>(stepper, '[data-pb-qty-input]');
    const dec = qs<HTMLButtonElement>(stepper, '[data-pb-qty-dec]');
    const inc = qs<HTMLButtonElement>(stepper, '[data-pb-qty-inc]');
    if (!input || !dec || !inc) return;

    const sync = (next: number) => {
      const required = state.view.mixRequiredCount ?? 1;
      const current = state.mixQtys[productId] ?? 0;
      const otherQty = mixSelectedQty(state.mixQtys) - current;
      const maxForProduct = Math.max(0, required - otherQty);
      const val = Math.min(Math.max(0, next), maxForProduct);

      if (next > maxForProduct) {
        showMixCapHint(stepper, required);
      } else {
        clearMixCapHint(stepper);
      }

      state.mixQtys[productId] = val;
      input.value = String(val);
      updateMixQtyButtons(root, state);
      updateMixCta(root, state);
      rerenderSummary(root, state);
    };

    dec.addEventListener('click', () => sync((state.mixQtys[productId] ?? 0) - 1));
    inc.addEventListener('click', () => sync((state.mixQtys[productId] ?? 0) + 1));
    input.addEventListener('change', () => sync(Number(input.value) || 0));

    input.value = String(state.mixQtys[productId] ?? 0);
  });

  updateMixQtyButtons(root, state);
  updateMixCta(root, state);
}

function updateMixQtyButtons(root: HTMLElement, state: WidgetShellState): void {
  const required = state.view.mixRequiredCount ?? 1;
  const atCap = mixSelectedQty(state.mixQtys) >= required;
  // A disabled button cannot surface the click hint, so the reason lives on the tooltip.
  const reason = `You can select up to ${required} items. Remove one to swap.`;
  qsa<HTMLButtonElement>(root, '[data-pb-qty-inc]').forEach((btn) => {
    btn.disabled = atCap;
    if (atCap) btn.title = reason;
    else btn.removeAttribute('title');
  });
}

function updateMixCta(root: HTMLElement, state: WidgetShellState): void {
  const btn = qs<HTMLButtonElement>(root, '[data-pb-atc]');
  if (!btn) return;
  const required = state.view.mixRequiredCount ?? 1;
  const selected = mixSelectedQty(state.mixQtys);
  btn.disabled = selected < required || state.adding;
  btn.textContent = mixCtaLabel(state.view.widgetStyle, selected, required);
}

function rerenderSummary(root: HTMLElement, state: WidgetShellState): void {
  const selected = mixSelectedQty(state.mixQtys);
  root.dataset.pbMixQty = String(selected);
  updateMixSummary(root, state);
}

export function updateMixSummary(root: HTMLElement, state: WidgetShellState): void {
  const selected = mixSelectedQty(state.mixQtys);
  const { original, discounted } = computeMixTotals(
    state.view,
    state.mixQtys,
    state.variantSelections,
  );
  const currency = state.view.currency ?? 'USD';
  const totalEl = qs<HTMLElement>(root, '.pb-mix__total');
  const originalEl = qs<HTMLElement>(root, '.pb-mix__original');

  if (totalEl) {
    totalEl.textContent =
      selected > 0 ? formatMoney(discounted, currency) : formatMoney(state.view.mixDiscounted, currency);
  }

  if (originalEl) {
    const showOriginal =
      selected > 0
        ? original > discounted
        : state.view.mixOriginal != null &&
          state.view.mixDiscounted != null &&
          state.view.mixOriginal > state.view.mixDiscounted;
    originalEl.hidden = !showOriginal;
    if (showOriginal) {
      originalEl.textContent = formatMoney(
        selected > 0 ? original : state.view.mixOriginal,
        currency,
      );
    }
  }
}

export function paintMixMatch(root: HTMLElement, state: WidgetShellState): void {
  const html = mixMatchMarkup(state.view, mixSelectedQty(state.mixQtys));
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  const next = wrapper.firstElementChild as HTMLElement | null;
  if (!next) return;
  root.replaceWith(next);
  bindMixControls(next, state, () => paintMixMatch(next, state));
}

function showMixCapHint(stepper: HTMLElement, required: number): void {
  let hint = stepper.parentElement?.querySelector<HTMLElement>('[data-pb-mix-cap]') ?? null;
  if (!hint) {
    hint = document.createElement('p');
    hint.className = 'pb-widget__error';
    hint.dataset.pbMixCap = 'true';
    hint.setAttribute('role', 'status');
    stepper.insertAdjacentElement('afterend', hint);
  }
  hint.hidden = false;
  hint.textContent = `You can select up to ${required} items.`;
}

function clearMixCapHint(stepper: HTMLElement): void {
  const hint = stepper.parentElement?.querySelector<HTMLElement>('[data-pb-mix-cap]');
  if (hint) {
    hint.hidden = true;
    hint.textContent = '';
  }
}
