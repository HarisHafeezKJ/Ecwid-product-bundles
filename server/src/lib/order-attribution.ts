import type { BundleRule, CartLineSnapshot } from '@pb/shared';
import { isRuleEligible } from '@pb/shared';
import { getOAuthTokens } from './storage/oauth-cache.js';
import { readStorageJson, storageKeys, writeStorageJson } from './storage/ecwid-storage.js';

interface StoredImpression {
  bundleRuleId: string;
  orderId: string;
  revenueGenerated: number;
  converted: boolean;
  createdAt: string;
}

interface StoredImpressionsDoc {
  impressions: StoredImpression[];
}

async function loadImpressionsDoc(storeId: string): Promise<StoredImpressionsDoc> {
  const tokens = await getOAuthTokens(storeId);
  if (!tokens) return { impressions: [] };
  const doc = await readStorageJson<StoredImpressionsDoc>(tokens, storageKeys().impressions);
  return doc ?? { impressions: [] };
}

async function saveImpressionsDoc(storeId: string, doc: StoredImpressionsDoc): Promise<void> {
  const tokens = await getOAuthTokens(storeId);
  if (!tokens) return;
  await writeStorageJson(tokens, storageKeys().impressions, doc);
}

export async function insertConversion(
  storeId: string,
  bundleRuleId: string,
  orderId: string,
  revenueGenerated: number,
): Promise<void> {
  const doc = await loadImpressionsDoc(storeId);
  const existing = doc.impressions.find(
    (row) => row.bundleRuleId === bundleRuleId && row.orderId === orderId,
  );
  if (existing) {
    existing.revenueGenerated = revenueGenerated;
    existing.converted = true;
  } else {
    doc.impressions.push({
      bundleRuleId,
      orderId,
      revenueGenerated,
      converted: true,
      createdAt: new Date().toISOString(),
    });
  }
  await saveImpressionsDoc(storeId, doc);
}

export async function attributeOrder(
  storeId: string,
  orderId: string,
  lines: CartLineSnapshot[],
  orderTotal: number,
  activeRules: BundleRule[],
): Promise<void> {
  const attributed = new Set<string>();

  for (const rule of activeRules) {
    if (rule.ruleType === 'CART_UPSELL') continue;
    if (attributed.has(rule.id)) continue;
    if (!isRuleEligible(rule, lines)) continue;

    const matching = lines.filter((line) => line.offerId === rule.id);
    const revenue =
      matching.length > 0
        ? matching.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)
        : orderTotal;

    await insertConversion(storeId, rule.id, orderId, revenue);
    attributed.add(rule.id);
  }
}
