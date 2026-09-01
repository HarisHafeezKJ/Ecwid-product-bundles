import type { StorefrontWidgetView } from '../types';
import { mixMatchMarkup } from './widget-markup';
import { bindMixControls, updateMixSummary } from './mix-match-bind';
import {
  addDiscountedAndRefresh,
  collectMixLines,
  createShellState,
  mixSelectedQty,
  mountWidgetShell,
  setAddingState,
  showAtcSuccess,
  showWidgetError,
  clearWidgetError,
  validateWidgetBeforeAtc,
  type WidgetShellState,
} from './widget-shell';
import { asCopyText, qs } from '../utils';

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
  bindMixControls(root, state, () => updateMixSummary(root, state));
  updateMixSummary(root, state);

  const btn = qs<HTMLButtonElement>(root, '[data-pb-atc]');
  btn?.addEventListener('click', () => void handleMixAtc(root, state));
}

async function handleMixAtc(root: HTMLElement, state: WidgetShellState): Promise<void> {
  const required = state.view.mixRequiredCount ?? 1;
  if (mixSelectedQty(state.mixQtys) < required || state.adding) return;

  clearWidgetError(root);
  const lines = collectMixLines(state.view, state.mixQtys, state.variantSelections);
  const validationError = validateWidgetBeforeAtc(state, lines);
  if (validationError) {
    showWidgetError(root, validationError);
    return;
  }

  state.adding = true;
  setAddingState(root, true, state.view);
  try {
    await addDiscountedAndRefresh(state.view.ruleId, lines);
    showAtcSuccess(root, state);
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : asCopyText(state.view.widgetStyle.addToCartErrorText, 'Could not add to cart.');
    showWidgetError(root, msg);
  } finally {
    state.adding = false;
    const selected = mixSelectedQty(state.mixQtys);
    const btn = qs<HTMLButtonElement>(root, '[data-pb-atc]');
    if (btn && !btn.classList.contains('pb-btn--success')) {
      btn.disabled = selected < required;
      btn.textContent = asCopyText(state.view.widgetStyle.addToCartText, 'Add to cart');
    }
  }
}

export function refreshMixMatchOffer(container: HTMLElement, view: StorefrontWidgetView): void {
  container.innerHTML = '';
  renderMixMatchOffer(container, view);
}
