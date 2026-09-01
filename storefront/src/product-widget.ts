import type { EcwidPage, RuleType, StorefrontWidgetView } from './types';
import { fetchOffer } from './api';
import { getProductId, productPageLooksLikely } from './ecwid';
import { productIdFromPageUrl } from './instant-site';
import { debounce } from './utils';
import { renderBundleOffer } from './widgets/bundle-offer';
import { renderMixMatchOffer } from './widgets/mix-match-offer';
import { renderVolumeOffer } from './widgets/volume-offer';

const MOUNT_ID = 'pb-product-bundles';
const OFFER_CACHE_TTL_MS = 5 * 60 * 1000;

let lastRenderedProductId: string | undefined;
let initInFlight = false;
let pendingInitPage: EcwidPage | undefined;
let mountWatcher: MutationObserver | null = null;
const offerCache = new Map<string, { views: StorefrontWidgetView[]; expiresAt: number }>();

const debouncedRemountCheck = debounce(() => {
  if (!productPageLooksLikely()) return;
  const productIdNum = getProductId() ?? productIdFromPageUrl();
  if (productIdNum == null) return;

  const host = document.getElementById(MOUNT_ID);
  if (!host || isHostMisplaced(host)) {
    void initProductWidgets();
  }
}, 400);

export async function initProductWidgets(page?: EcwidPage): Promise<void> {
  if (!productPageLooksLikely(page)) return;

  const productId = await resolveProductId(page);
  if (!productId) {
    console.warn('[pb-bundles] Could not resolve product id on product page');
    return;
  }

  const existingHost = document.getElementById(MOUNT_ID);
  if (
    productId === lastRenderedProductId &&
    existingHost &&
    existingHost.children.length > 0 &&
    !isHostMisplaced(existingHost)
  ) {
    return;
  }

  if (initInFlight) {
    pendingInitPage = page;
    return;
  }
  initInFlight = true;

  try {
    const host = await ensureProductHost();
    if (!host || host.hidden) return;

    host.innerHTML = '<div class="pb-loading">Loading offers…</div>';

    const views = await loadViews(productId);
    if (!views.length) {
      console.warn('[pb-bundles] No offers returned for product', productId);
      host.innerHTML = '';
      return;
    }

    host.innerHTML = '';
    let mounted = 0;
    for (const view of views) {
      if (view.overViewLimit || view.status === 'DISABLED') continue;
      mountOfferView(host, view);
      mounted += 1;
    }

    if (mounted === 0) {
      host.innerHTML = '';
      return;
    }

    lastRenderedProductId = productId;
    startMountWatcher();
  } catch (err) {
    console.warn('[pb-bundles] Failed to load offers', err);
    const host = document.getElementById(MOUNT_ID);
    if (host) host.innerHTML = '';
  } finally {
    initInFlight = false;
    if (pendingInitPage !== undefined) {
      const nextPage = pendingInitPage;
      pendingInitPage = undefined;
      void initProductWidgets(nextPage);
    }
  }
}

async function loadViews(productId: string): Promise<StorefrontWidgetView[]> {
  const cached = offerCache.get(productId);
  if (cached && cached.expiresAt > Date.now()) return cached.views;

  let response = await fetchOffer({ productId });
  if (!response) {
    await new Promise((resolve) => window.setTimeout(resolve, 1500));
    response = await fetchOffer({ productId });
  }

  const views = normalizeViews(response);
  offerCache.set(productId, { views, expiresAt: Date.now() + OFFER_CACHE_TTL_MS });
  return views;
}

function normalizeViews(
  response: { view?: StorefrontWidgetView; views?: StorefrontWidgetView[] } | null,
): StorefrontWidgetView[] {
  if (!response) return [];
  if (response.views?.length) return response.views;
  if (response.view) return [response.view];
  return [];
}

async function resolveProductId(page?: EcwidPage, timeoutMs = 10000): Promise<string | undefined> {
  const fromUrl = productIdFromPageUrl();
  if (fromUrl != null) return String(fromUrl);

  const fromApi = getProductId(page);
  if (fromApi != null) return String(fromApi);

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const id = getProductId(page);
    if (id != null) return String(id);
    await new Promise((resolve) => window.setTimeout(resolve, 200));
  }
  return undefined;
}

/** Instant Site renders product-details after ec-store mounts; avoid attaching to ec-store root. */
function isHostMisplaced(host: HTMLElement): boolean {
  const parent = host.parentElement;
  if (!parent) return true;
  if (parent === document.body) return true;
  if (parent.classList.contains('ec-store') && !parent.querySelector('.product-details')) return true;
  if (parent.classList.contains('ec-store') && parent.firstElementChild === host) return true;
  return false;
}

function findProductMountPoint(): { parent: HTMLElement; before?: Element | null } | null {
  const sidebar = document.querySelector('.product-details__sidebar');
  if (sidebar instanceof HTMLElement) {
    const description = sidebar.querySelector('.product-details__description');
    if (description?.parentElement === sidebar) {
      return { parent: sidebar, before: description };
    }
    const actionPanel = sidebar.querySelector(
      '.product-details__action-panel, .details-product-purchase',
    );
    if (actionPanel?.parentElement === sidebar) {
      const next = actionPanel.nextElementSibling;
      return { parent: sidebar, before: next };
    }
    return { parent: sidebar };
  }

  const details = document.querySelector('.product-details');
  if (details instanceof HTMLElement) {
    const description = details.querySelector('.product-details__description');
    if (description?.parentElement === details) {
      return { parent: details, before: description };
    }
    return { parent: details };
  }

  const legacy =
    document.querySelector('.ecwid-productBrowser-details') ??
    document.querySelector('.details-product-page') ??
    document.querySelector('[data-hook="product-page"]');
  if (legacy instanceof HTMLElement) {
    const options =
      legacy.querySelector('.product-options') ??
      legacy.querySelector('.ecwid-productBrowser-options') ??
      legacy.querySelector('.details-product-option');
    if (options?.parentElement) {
      return { parent: options.parentElement, before: options.nextElementSibling };
    }
    return { parent: legacy };
  }

  const content = document.querySelector('.ec-store__content-wrapper .product-details');
  if (content instanceof HTMLElement) {
    return { parent: content };
  }

  return null;
}

function waitForProductMountPoint(
  timeoutMs = 15000,
): Promise<{ parent: HTMLElement; before?: Element | null } | null> {
  const existing = findProductMountPoint();
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const timer = window.setInterval(() => {
      const mount = findProductMountPoint();
      if (mount || Date.now() >= deadline) {
        window.clearInterval(timer);
        observer.disconnect();
        resolve(mount);
      }
    }, 200);

    const observer = new MutationObserver(() => {
      const mount = findProductMountPoint();
      if (mount) {
        window.clearInterval(timer);
        observer.disconnect();
        resolve(mount);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

function placeHost(host: HTMLElement, mount: { parent: HTMLElement; before?: Element | null }): void {
  host.hidden = false;
  const { parent, before } = mount;
  if (before && before.parentElement === parent) {
    parent.insertBefore(host, before);
    return;
  }
  parent.appendChild(host);
}

async function ensureProductHost(): Promise<HTMLElement | null> {
  let host = document.getElementById(MOUNT_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = MOUNT_ID;
    host.className = 'pb-product-bundles';
  }

  const mount = findProductMountPoint() ?? await waitForProductMountPoint();
  if (!mount) {
    if (!host.parentElement) {
      host.hidden = true;
      document.body.appendChild(host);
    }
    return null;
  }

  placeHost(host, mount);
  return host;
}

function startMountWatcher(): void {
  if (mountWatcher) return;
  mountWatcher = new MutationObserver(() => debouncedRemountCheck());
  mountWatcher.observe(document.body, { childList: true, subtree: true });
}

function stopMountWatcher(): void {
  mountWatcher?.disconnect();
  mountWatcher = null;
}

function mountOfferView(host: HTMLElement, view: StorefrontWidgetView): void {
  const containerId = `pb-offer-${view.ruleId}`;
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
  lastRenderedProductId = undefined;
  offerCache.clear();
  stopMountWatcher();
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
