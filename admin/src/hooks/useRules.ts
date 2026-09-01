import { useCallback, useState } from 'react';
import type { AppSettings, BundleRule, RuleStatus } from '@pb/shared';
import * as api from '../api/client';

export function useRules() {
  const [rules, setRules] = useState<BundleRule[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rulesData, settingsData] = await Promise.all([api.listRules(), api.loadSettings()]);
      setRules(rulesData);
      setSettings(settingsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh offers.');
    } finally {
      setLoading(false);
    }
  }, []);

  const removeRule = useCallback(async (id: string) => {
    setMutating(true);
    try {
      await api.deleteRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setMutating(false);
    }
  }, []);

  const updateStatus = useCallback(async (id: string, status: RuleStatus) => {
    setMutating(true);
    try {
      const updated = await api.setRuleStatus(id, status);
      setRules((prev) => prev.map((r) => (r.id === id ? updated : r)));
      return updated;
    } finally {
      setMutating(false);
    }
  }, []);

  return {
    rules,
    settings,
    loading,
    mutating,
    error,
    refresh,
    removeRule,
    updateStatus,
    setRules,
  };
}
