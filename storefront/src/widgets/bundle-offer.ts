import type { StorefrontWidgetView } from '../types';
import { fixedBundleMarkup } from './widget-markup';
import {
  addDiscountedAndRefresh,
  bindVariantSelects,
  collectBundleLines,
  createShellState,
  mountWidgetShell,
  setAddingState,
  showWidgetError,
  type WidgetShellState,
} from './widget-shell';
import { qs } from '../utils';

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
  state.adding = true;
  setAddingState(root, true, state.view);
  try {
    const lines = collectBundleLines(state.view, state.variantSelections);
    await addDiscountedAndRefresh(state.view.ruleId, lines);
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : state.view.widgetStyle.addToCartErrorText ?? 'Could not add to cart.';
    showWidgetError(root, msg);
  } finally {
    state.adding = false;
    setAddingState(root, false, state.view);
  }
}

export function refreshBundleOffer(container: HTMLElement, view: StorefrontWidgetView): void {
  container.innerHTML = '';
  renderBundleOffer(container, view);
}
