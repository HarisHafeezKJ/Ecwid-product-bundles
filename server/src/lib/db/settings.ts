import type { AppSettings, PlanTier } from '@pb/shared';
import {
  currentViewsPeriod,
  mergeSettings,
  viewLimitForPlan,
} from '@pb/shared';
import { resolveStoreTokens } from '../storage/oauth-cache.js';
import {
  readPublicConfig,
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

async function loadDoc(storeId: string, sessionAccessToken?: string): Promise<StoredSettingsDoc> {
  const tokens = await resolveStoreTokens(storeId, sessionAccessToken);
  const doc = await readStorageJson<StoredSettingsDoc>(tokens, storageKeys().settings);
  return doc ?? defaultDoc(storeId);
}

async function saveDoc(
  storeId: string,
  doc: StoredSettingsDoc,
  sessionAccessToken?: string,
): Promise<void> {
  const tokens = await resolveStoreTokens(storeId, sessionAccessToken);
  await writeStorageJson(tokens, storageKeys().settings, doc);
  const existing = (await readPublicConfig(tokens)) ?? {};
  await writePublicConfig(tokens, {
    ...existing,
    cartUpsellEnabled: doc.cartUpsellEnabled,
  });
}

export async function loadAppSettings(
  storeId: string,
  sessionAccessToken?: string,
): Promise<AppSettings> {
  const doc = await loadDoc(storeId, sessionAccessToken);
  if (!doc.viewsPeriod) {
    doc.viewsPeriod = currentViewsPeriod();
    await saveDoc(storeId, doc, sessionAccessToken);
  }
  return mapSettings(storeId, doc);
}

export async function saveAppSettings(
  storeId: string,
  partial: Partial<AppSettings>,
  sessionAccessToken?: string,
): Promise<AppSettings> {
  const doc = await loadDoc(storeId, sessionAccessToken);
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
  await saveDoc(storeId, doc, sessionAccessToken);
  return mapSettings(storeId, doc);
}

export async function incrementMonthlyViews(
  storeId: string,
  sessionAccessToken?: string,
): Promise<AppSettings> {
  const doc = await loadDoc(storeId, sessionAccessToken);
  const period = currentViewsPeriod();

  if (doc.viewsPeriod !== period) {
    doc.viewsPeriod = period;
    doc.currentViewsCount = 1;
    doc.monthlyViewsLimit = viewLimitForPlan(doc.planTier);
  } else {
    doc.currentViewsCount += 1;
  }

  await saveDoc(storeId, doc, sessionAccessToken);
  return mapSettings(storeId, doc);
}

export async function setCartUpsellEnabled(
  storeId: string,
  enabled: boolean,
  sessionAccessToken?: string,
): Promise<void> {
  const doc = await loadDoc(storeId, sessionAccessToken);
  doc.cartUpsellEnabled = enabled;
  await saveDoc(storeId, doc, sessionAccessToken);
}
