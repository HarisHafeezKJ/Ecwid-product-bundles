import type { StorefrontWidgetView } from '../types';
import { fixedBundleMarkup } from './widget-markup';
import {
  addDiscountedAndRefresh,
  bindVariantSelects,
  collectBundleLines,
  createShellState,
  mountWidgetShell,
  setAddingState,
  showAtcSuccess,
  showWidgetError,
  clearWidgetError,
  validateWidgetBeforeAtc,
  type WidgetShellState,
} from './widget-shell';
import { asCopyText, qs } from '../utils';

export function renderBundleOffer(container: HTMLElement, view: StorefrontWidgetView): void {
  const state = createShellState(view);
  const root = mountWidgetShell(container, fixedBundleMarkup(view), view);
  bindBundleOffer(root, state);
}

function bindBundleOffer(root: HTMLElement, state: WidgetShellState): void {
  bindVariantSelects(root, state);

  const btn = qs<HTMLButtonElement>(root, '[data-pb-atc]');
  btn?.addEventListener('click', () => void handleBundleAtc(root, state));
}

async function handleBundleAtc(root: HTMLElement, state: WidgetShellState): Promise<void> {
  if (state.adding) return;
  clearWidgetError(root);
  const lines = collectBundleLines(state.view, state.variantSelections);
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
    const btn = root.querySelector<HTMLButtonElement>('[data-pb-atc]');
    if (btn && !btn.classList.contains('pb-btn--success')) {
      setAddingState(root, false, state.view);
    }
  }
}

export function refreshBundleOffer(container: HTMLElement, view: StorefrontWidgetView): void {
  container.innerHTML = '';
  renderBundleOffer(container, view);
}
