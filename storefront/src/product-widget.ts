import type { EcwidPage, RuleType, StorefrontWidgetView } from './types';
import { fetchOffer } from './api';
import { getProductId, productPageLooksLikely } from './ecwid';
import { renderBundleOffer } from './widgets/bundle-offer';
import { renderMixMatchOffer } from './widgets/mix-match-offer';
import { renderVolumeOffer } from './widgets/volume-offer';

const MOUNT_ID = 'pb-product-bundles';
const RULE_CONTAINERS: Record<RuleType, string> = {
  VOLUME_DISCOUNT: 'pb-volume-offer',
  FIXED_BUNDLE: 'pb-bundle-offer',
  MIX_AND_MATCH: 'pb-mix-match-offer',
  CART_UPSELL: 'pb-cart-upsell',
};

let lastProductId: string | undefined;

export async function initProductWidgets(page?: EcwidPage): Promise<void> {
  if (!productPageLooksLikely(page)) return;

  const productIdNum = getProductId(page);
  if (productIdNum == null) return;

  const productId = String(productIdNum);
  if (productId === lastProductId && document.getElementById(MOUNT_ID)?.children.length) return;
  lastProductId = productId;

  const host = ensureProductHost();
  host.innerHTML = '<div class="pb-loading">Loading offers…</div>';

  try {
    const response = await fetchOffer({ productId });
    const views = normalizeViews(response);
    if (!views.length) {
      host.innerHTML = '';
      return;
    }

    host.innerHTML = '';
    for (const view of views) {
      if (view.overViewLimit || view.status === 'DISABLED') continue;
      mountOfferView(host, view);
    }
  } catch (err) {
    console.warn('[pb-bundles] Failed to load offers', err);
    host.innerHTML = '';
  }
}

function normalizeViews(response: { view?: StorefrontWidgetView; views?: StorefrontWidgetView[] } | null): StorefrontWidgetView[] {
  if (!response) return [];
  if (response.views?.length) return response.views;
  if (response.view) return [response.view];
  return [];
}

function ensureProductHost(): HTMLElement {
  let host = document.getElementById(MOUNT_ID);
  if (host) return host;

  host = document.createElement('div');
  host.id = MOUNT_ID;
  host.className = 'pb-product-bundles';

  const anchor =
    document.querySelector('.ec-store') ??
    document.querySelector('[data-block="store"]') ??
    document.querySelector('.product-details') ??
    document.querySelector('.ecwid-productBrowser-details') ??
    document.querySelector('.details-product-page') ??
    document.querySelector('.product-details-module') ??
    document.querySelector('[data-hook="product-page"]') ??
    document.querySelector('.StorefrontCatalogTile') ??
    document.querySelector('#static-html');

  if (anchor instanceof HTMLElement) {
    const options =
      anchor.querySelector('.product-options') ??
      anchor.querySelector('.ecwid-productBrowser-options') ??
      anchor.querySelector('.details-product-option') ??
      anchor.querySelector('button[type="submit"]') ??
      anchor.querySelector('[class*="add-to"]');
    if (options?.parentElement) {
      options.parentElement.insertBefore(host, options.nextSibling);
    } else {
      anchor.appendChild(host);
    }
  } else {
    document.body.appendChild(host);
  }

  return host;
}

function mountOfferView(host: HTMLElement, view: StorefrontWidgetView): void {
  const containerId = RULE_CONTAINERS[view.ruleType] ?? `pb-offer-${view.ruleId}`;
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    container.className = 'pb-offer-mount';
    container.dataset.ruleType = view.ruleType;
    container.dataset.ruleId = view.ruleId;
    host.appendChild(container);
  }

  switch (view.ruleType) {
    case 'VOLUME_DISCOUNT':
      renderVolumeOffer(container, view);
      break;
    case 'FIXED_BUNDLE':
      renderBundleOffer(container, view);
      break;
    case 'MIX_AND_MATCH':
      renderMixMatchOffer(container, view);
      break;
    default:
      container.remove();
  }
}

export function teardownProductWidgets(): void {
  lastProductId = undefined;
  document.getElementById(MOUNT_ID)?.remove();
}

export async function loadOfferForType(
  productId: string,
  ruleType: RuleType,
  ruleId?: string,
): Promise<StorefrontWidgetView | null> {
  const response = await fetchOffer({ productId, ruleType, ruleId });
  if (response?.view) return response.view;
  return response?.views?.[0] ?? null;
}
