import type { StorefrontWidgetView } from '../types';
import { mixMatchMarkup } from './widget-markup';
import { bindMixControls } from './mix-match-bind';
import {
  addDiscountedAndRefresh,
  collectMixLines,
  createShellState,
  mixSelectedQty,
  mountWidgetShell,
  setAddingState,
  showWidgetError,
  type WidgetShellState,
} from './widget-shell';
import { qs } from '../utils';

export function renderMixMatchOffer(container: HTMLElement, view: StorefrontWidgetView): void {
  const state = createShellState(view);
  const root = mountWidgetShell(
    container,
    mixMatchMarkup(view, mixSelectedQty(state.mixQtys)),
    view,
  );
  bindMixMatchOffer(root, state);
}

function bindMixMatchOffer(root: HTMLElement, state: WidgetShellState): void {
  bindMixControls(root, state, () => {
    /* CTA updates in bindMixControls */
  });

  const btn = qs<HTMLButtonElement>(root, '[data-pb-atc]');
  btn?.addEventListener('click', () => void handleMixAtc(root, state));
}

async function handleMixAtc(root: HTMLElement, state: WidgetShellState): Promise<void> {
  const required = state.view.mixRequiredCount ?? 1;
  if (mixSelectedQty(state.mixQtys) < required || state.adding) return;

  state.adding = true;
  setAddingState(root, true, state.view);
  try {
    const lines = collectMixLines(state.view, state.mixQtys, state.variantSelections);
    await addDiscountedAndRefresh(state.view.ruleId, lines);
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : state.view.widgetStyle.addToCartErrorText ?? 'Could not add to cart.';
    showWidgetError(root, msg);
  } finally {
    state.adding = false;
    const selected = mixSelectedQty(state.mixQtys);
    const btn = qs<HTMLButtonElement>(root, '[data-pb-atc]');
    if (btn) {
      btn.disabled = selected < required;
      btn.textContent = state.view.widgetStyle.addToCartText ?? 'Add to cart';
    }
  }
}

export function refreshMixMatchOffer(container: HTMLElement, view: StorefrontWidgetView): void {
  container.innerHTML = '';
  renderMixMatchOffer(container, view);
}
