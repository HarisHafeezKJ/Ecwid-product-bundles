import { randomUUID } from 'node:crypto';
import type { BundleRule, RuleType, RuleStatus, RuleFormInput } from '@pb/shared';
import {
  clampDiscountValue,
  clampRuleDiscountInput,
  inferApplyToAllProducts,
  parseBundleItems,
  parseVolumeTiers,
  defaultWidgetStyle,
  validateRuleForm,
} from '@pb/shared';
import { ClientError } from '../api-response.js';
import { resolveStoreTokens } from '../storage/oauth-cache.js';
import {
  readPublicConfig,
  readStorageJson,
  storageKeys,
  writePublicConfig,
  writeStorageJson,
} from '../storage/ecwid-storage.js';
import { mapStoredRule, ruleInputFromBody, type StoredRuleRow, type StoredRulesDoc } from './mappers.js';
import { serializeRulesForPublicConfig } from './public-rules.js';

const EMPTY_IDS: string[] = [];

function normalizeRulesDoc(raw: unknown): StoredRulesDoc {
  if (!raw) return { rules: [] };
  // Legacy / corrupted storage may be a bare array of rules instead of { rules: [] }.
  if (Array.isArray(raw)) return { rules: raw as StoredRuleRow[] };
  if (typeof raw === 'object') {
    const doc = raw as StoredRulesDoc;
    if (Array.isArray(doc.rules)) return doc;
    const wrapped = (raw as { value?: unknown }).value;
    if (wrapped != null) return normalizeRulesDoc(wrapped);
  }
  return { rules: [] };
}

async function loadRulesDoc(storeId: string, sessionAccessToken?: string): Promise<StoredRulesDoc> {
  const tokens = await resolveStoreTokens(storeId, sessionAccessToken);
  const doc = await readStorageJson<unknown>(tokens, storageKeys().rules);
  return normalizeRulesDoc(doc);
}

async function syncRulesToPublicConfig(
  storeId: string,
  sessionAccessToken?: string,
): Promise<void> {
  const tokens = await resolveStoreTokens(storeId, sessionAccessToken);
  const doc = await loadRulesDoc(storeId, sessionAccessToken);
  const existing = (await readPublicConfig(tokens)) ?? {};
  const activeRules = doc.rules
    .filter((row) => row.status === 'ACTIVE')
    .map(mapStoredRule);
  await writePublicConfig(tokens, {
    ...existing,
    rules: serializeRulesForPublicConfig(activeRules),
    rulesUpdatedAt: new Date().toISOString(),
  });
}

export async function syncRulesToPublicConfigForStore(
  storeId: string,
  sessionAccessToken?: string,
): Promise<void> {
  await syncRulesToPublicConfig(storeId, sessionAccessToken);
}

async function saveRulesDoc(
  storeId: string,
  doc: StoredRulesDoc,
  sessionAccessToken?: string,
): Promise<void> {
  const tokens = await resolveStoreTokens(storeId, sessionAccessToken);
  await writeStorageJson(tokens, storageKeys().rules, doc);
  await syncRulesToPublicConfig(storeId, sessionAccessToken);
}

export async function listBundleRules(
  storeId: string,
  sessionAccessToken?: string,
): Promise<BundleRule[]> {
  const doc = await loadRulesDoc(storeId, sessionAccessToken);
  return doc.rules
    .slice()
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .map(mapStoredRule);
}

export async function getBundleRule(
  storeId: string,
  id: string,
  sessionAccessToken?: string,
): Promise<BundleRule | null> {
  const doc = await loadRulesDoc(storeId, sessionAccessToken);
  const row = doc.rules.find((r) => r.id === id);
  return row ? mapStoredRule(row) : null;
}

export async function listActiveRulesForStore(
  storeId: string,
  ruleType?: RuleType,
): Promise<BundleRule[]> {
  const doc = await loadRulesDoc(storeId);
  return doc.rules
    .filter((r) => r.status === 'ACTIVE' && (!ruleType || r.ruleType === ruleType))
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .map(mapStoredRule);
}

export async function saveBundleRule(
  storeId: string,
  input: Record<string, unknown>,
  sessionAccessToken?: string,
): Promise<BundleRule> {
  const partial = ruleInputFromBody(input, storeId);
  if (!partial.title?.trim()) throw new ClientError('Enter a title.');
  if (!partial.ruleType) throw new ClientError('Invalid ruleType');

  const ruleType = partial.ruleType;
  const items = parseBundleItems(partial.items);
  const tiers = parseVolumeTiers(partial.volumeTiers);
  const applyToAllProducts = inferApplyToAllProducts({
    applyToAllProducts: partial.applyToAllProducts ?? true,
    displayOn: partial.displayOn,
    primaryProductId: partial.primaryProductId,
  });

  const validation = validateRuleForm(
    clampRuleDiscountInput({
      ...partial,
      title: partial.title.trim(),
      ruleType,
      items,
      volumeTiers: { tiers },
      applyToAllProducts,
      triggerProductIds: partial.triggerProductIds ?? EMPTY_IDS,
      suggestedProductIds: partial.suggestedProductIds ?? EMPTY_IDS,
    } as RuleFormInput),
  );
  if (!validation.valid) {
    throw new ClientError(validation.errors[0] ?? 'Invalid rule.');
  }

  let discountType = partial.discountType ?? 'NONE';
  let discountValue = clampDiscountValue(discountType, partial.discountValue ?? 0);

  let allowVariantChoice = partial.allowVariantChoice ?? true;
  if (ruleType === 'CART_UPSELL') {
    discountType = 'NONE';
    discountValue = 0;
    allowVariantChoice = false;
  }

  const widgetStyle = {
    ...defaultWidgetStyle(ruleType),
    ...(partial.widgetStyle ?? {}),
  };

  const now = new Date().toISOString();
  const doc = await loadRulesDoc(storeId, sessionAccessToken);

  const base: Omit<StoredRuleRow, 'id' | 'createdAt' | 'updatedAt'> = {
    title: partial.title.trim(),
    ruleType,
    discountType,
    discountValue,
    status: (partial.status as RuleStatus) ?? 'ACTIVE',
    primaryProductId: partial.primaryProductId ?? items.components[0]?.productId ?? null,
    displayOn: applyToAllProducts ? 'ALL_ITEMS' : 'PRIMARY',
    applyToAllProducts,
    targetProductId: partial.targetProductId ?? partial.primaryProductId ?? null,
    layout: partial.layout ?? 'VERTICAL',
    widgetStyle,
    items: items ?? { components: [] },
    sourceCollectionId: partial.sourceCollectionId ?? null,
    requiredCount:
      ruleType === 'MIX_AND_MATCH'
        ? (tiers[0]?.qty ?? partial.requiredCount ?? 2)
        : (partial.requiredCount ?? null),
    volumeTiers: { tiers },
    triggerProductIds: partial.triggerProductIds ?? EMPTY_IDS,
    suggestedProductIds: partial.suggestedProductIds ?? EMPTY_IDS,
    allowVariantChoice,
    storeId,
  };

  if (partial.id) {
    const idx = doc.rules.findIndex((r) => r.id === partial.id);
    if (idx < 0) throw new Error('Rule not found');
    doc.rules[idx] = {
      ...doc.rules[idx]!,
      ...base,
      updatedAt: now,
    };
    await saveRulesDoc(storeId, doc, sessionAccessToken);
    return mapStoredRule(doc.rules[idx]!);
  }

  const row: StoredRuleRow = {
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    ...base,
  };
  doc.rules.push(row);
  await saveRulesDoc(storeId, doc, sessionAccessToken);
  return mapStoredRule(row);
}

export async function setBundleStatus(
  storeId: string,
  id: string,
  status: RuleStatus,
  sessionAccessToken?: string,
): Promise<BundleRule> {
  const doc = await loadRulesDoc(storeId, sessionAccessToken);
  const idx = doc.rules.findIndex((r) => r.id === id);
  if (idx < 0) throw new Error('Rule not found');
  doc.rules[idx] = { ...doc.rules[idx]!, status, updatedAt: new Date().toISOString() };
  await saveRulesDoc(storeId, doc, sessionAccessToken);
  return mapStoredRule(doc.rules[idx]!);
}

export async function deleteBundleRule(
  storeId: string,
  id: string,
  sessionAccessToken?: string,
): Promise<void> {
  const doc = await loadRulesDoc(storeId, sessionAccessToken);
  const before = doc.rules.length;
  doc.rules = doc.rules.filter((r) => r.id !== id);
  if (doc.rules.length === before) throw new Error('Rule not found');
  await saveRulesDoc(storeId, doc, sessionAccessToken);
}
