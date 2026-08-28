import type { WidgetShellState } from './widget-shell';
import { mixSelectedQty } from './widget-shell';
import { mixMatchMarkup, mixCtaLabel } from './widget-markup';
import { bindVariantSelects } from './widget-shell';
import { qs, qsa } from '../utils';

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
      const val = Math.max(0, next);
      state.mixQtys[productId] = val;
      input.value = String(val);
      updateMixCta(root, state);
      rerenderSummary(root, state);
    };

    dec.addEventListener('click', () => sync((state.mixQtys[productId] ?? 0) - 1));
    inc.addEventListener('click', () => sync((state.mixQtys[productId] ?? 0) + 1));
    input.addEventListener('change', () => sync(Number(input.value) || 0));

    input.value = String(state.mixQtys[productId] ?? 0);
  });

  updateMixCta(root, state);
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
