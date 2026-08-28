import type { StorefrontWidgetView } from '../types';
import { volumeOfferMarkup, volumeVariantUnitsMarkup } from './widget-markup';
import {
  addDiscountedAndRefresh,
  bindVariantSelects,
  collectVolumeLines,
  createShellState,
  mountWidgetShell,
  setAddingState,
  showWidgetError,
  type WidgetShellState,
} from './widget-shell';
import { applyWidgetStyle } from './widget-style-css';
import { qs, qsa } from '../utils';

export function renderVolumeOffer(container: HTMLElement, view: StorefrontWidgetView): void {
  const state = createShellState(view);
  const root = mountWidgetShell(container, volumeOfferMarkup(view, state.volumeQty), view);
  bindVolumeOffer(root, state, container);
}

function bindVolumeOffer(
  root: HTMLElement,
  state: WidgetShellState,
  container: HTMLElement,
): void {
  bindVariantSelects(root, state, () => paintVolumeVariants(root, state));

  qsa<HTMLInputElement>(root, 'input[name="pb-volume-qty"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      state.volumeQty = Number(radio.value) || 1;
      qsa<HTMLElement>(root, '.pb-volume__tier').forEach((tier) =>
        tier.classList.toggle('pb-volume__tier--selected', qs<HTMLInputElement>(tier, 'input')?.checked ?? false),
      );
      paintVolumeVariants(root, state);
    });
  });

  paintVolumeVariants(root, state);

  const btn = qs<HTMLButtonElement>(root, '[data-pb-atc]');
  btn?.addEventListener('click', () => void handleVolumeAtc(root, state, container));
}

function paintVolumeVariants(root: HTMLElement, state: WidgetShellState): void {
  const host = qs<HTMLElement>(root, '[data-pb-volume-variants]');
  const item = state.view.items[0];
  if (!host || !item || !state.view.allowVariantChoice) {
    if (host) host.hidden = true;
    return;
  }
  if (state.volumeQty <= 1 || (item.variants?.length ?? 0) <= 1) {
    host.hidden = true;
    host.innerHTML = '';
    return;
  }
  host.hidden = false;
  host.innerHTML = volumeVariantUnitsMarkup(item, state.volumeQty, state.view.widgetStyle);
  bindVariantSelects(host, state);
}

async function handleVolumeAtc(
  root: HTMLElement,
  state: WidgetShellState,
  container: HTMLElement,
): Promise<void> {
  if (state.adding) return;
  state.adding = true;
  setAddingState(root, true, state.view);
  try {
    const lines = collectVolumeLines(state.view, state.volumeQty, state.variantSelections);
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

export function refreshVolumeOffer(container: HTMLElement, view: StorefrontWidgetView): void {
  container.innerHTML = '';
  renderVolumeOffer(container, view);
  applyWidgetStyle(container, view.widgetStyle);
}
