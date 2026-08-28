import type { AppSettings, PlanTier } from '@pb/shared';
import {
  currentViewsPeriod,
  mergeSettings,
  viewLimitForPlan,
} from '@pb/shared';
import { getOAuthTokens } from '../storage/oauth-cache.js';
import {
  readStorageJson,
  storageKeys,
  writePublicConfig,
  writeStorageJson,
} from '../storage/ecwid-storage.js';

export interface StoredSettingsDoc {
  title: string;
  widgetTitle: string;
  buttonLabel: string;
  showSavingsBadge: boolean;
  themeSyncEnabled: boolean;
  stockShieldEnabled: boolean;
  stockThreshold: number;
  planTier: PlanTier;
  monthlyViewsLimit: number;
  currentViewsCount: number;
  viewsPeriod: string;
  cartUpsellEnabled: boolean;
}

function defaultDoc(storeId: string): StoredSettingsDoc {
  const defaults = mergeSettings(storeId);
  return {
    title: defaults.title ?? 'Default',
    widgetTitle: defaults.widgetTitle ?? 'Frequently Bought Together',
    buttonLabel: defaults.buttonLabel ?? 'Add Bundle to Cart',
    showSavingsBadge: defaults.showSavingsBadge ?? true,
    themeSyncEnabled: defaults.themeSyncEnabled ?? true,
    stockShieldEnabled: defaults.stockShieldEnabled ?? true,
    stockThreshold: defaults.stockThreshold ?? 1,
    planTier: defaults.planTier,
    monthlyViewsLimit: defaults.monthlyViewsLimit,
    currentViewsCount: 0,
    viewsPeriod: currentViewsPeriod(),
    cartUpsellEnabled: false,
  };
}

function mapSettings(storeId: string, row: StoredSettingsDoc): AppSettings {
  return {
    id: storeId,
    storeId,
    title: row.title,
    widgetTitle: row.widgetTitle,
    buttonLabel: row.buttonLabel,
    showSavingsBadge: row.showSavingsBadge,
    themeSyncEnabled: row.themeSyncEnabled,
    stockShieldEnabled: row.stockShieldEnabled,
    stockThreshold: row.stockThreshold,
    planTier: row.planTier,
    monthlyViewsLimit: row.monthlyViewsLimit,
    currentViewsCount: row.currentViewsCount,
    viewsPeriod: row.viewsPeriod,
    cartUpsellEnabled: row.cartUpsellEnabled,
  };
}

async function loadDoc(storeId: string): Promise<StoredSettingsDoc> {
  const tokens = await getOAuthTokens(storeId);
  if (!tokens) throw new Error('Store not authenticated');
  const doc = await readStorageJson<StoredSettingsDoc>(tokens, storageKeys().settings);
  return doc ?? defaultDoc(storeId);
}

async function saveDoc(storeId: string, doc: StoredSettingsDoc): Promise<void> {
  const tokens = await getOAuthTokens(storeId);
  if (!tokens) throw new Error('Store not authenticated');
  await writeStorageJson(tokens, storageKeys().settings, doc);
  await writePublicConfig(tokens, {
    cartUpsellEnabled: doc.cartUpsellEnabled,
  });
}

export async function loadAppSettings(storeId: string): Promise<AppSettings> {
  const doc = await loadDoc(storeId);
  if (!doc.viewsPeriod) {
    doc.viewsPeriod = currentViewsPeriod();
    await saveDoc(storeId, doc);
  }
  return mapSettings(storeId, doc);
}

export async function saveAppSettings(
  storeId: string,
  partial: Partial<AppSettings>,
): Promise<AppSettings> {
  const doc = await loadDoc(storeId);
  if (partial.title != null) doc.title = partial.title;
  if (partial.widgetTitle != null) doc.widgetTitle = partial.widgetTitle;
  if (partial.buttonLabel != null) doc.buttonLabel = partial.buttonLabel;
  if (partial.showSavingsBadge != null) doc.showSavingsBadge = partial.showSavingsBadge;
  if (partial.themeSyncEnabled != null) doc.themeSyncEnabled = partial.themeSyncEnabled;
  if (partial.stockShieldEnabled != null) doc.stockShieldEnabled = partial.stockShieldEnabled;
  if (partial.stockThreshold != null) doc.stockThreshold = partial.stockThreshold;
  if (partial.planTier != null) {
    doc.planTier = partial.planTier;
    doc.monthlyViewsLimit = viewLimitForPlan(partial.planTier);
  }
  if (partial.monthlyViewsLimit != null) doc.monthlyViewsLimit = partial.monthlyViewsLimit;
  await saveDoc(storeId, doc);
  return mapSettings(storeId, doc);
}

export async function incrementMonthlyViews(storeId: string): Promise<AppSettings> {
  const doc = await loadDoc(storeId);
  const period = currentViewsPeriod();

  if (doc.viewsPeriod !== period) {
    doc.viewsPeriod = period;
    doc.currentViewsCount = 1;
    doc.monthlyViewsLimit = viewLimitForPlan(doc.planTier);
  } else {
    doc.currentViewsCount += 1;
  }

  await saveDoc(storeId, doc);
  return mapSettings(storeId, doc);
}

export async function setCartUpsellEnabled(storeId: string, enabled: boolean): Promise<void> {
  const doc = await loadDoc(storeId);
  doc.cartUpsellEnabled = enabled;
  await saveDoc(storeId, doc);
}
