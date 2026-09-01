import { useEffect, useMemo, useState } from 'react';
import type { BundleRule, RuleType } from '@pb/shared';
import { draftFromRule } from '../components/editor/editor-draft';
import type { OfferDraft } from '../components/editor/editor-draft';
import CreateOfferModal from '../components/CreateOfferModal';
import HelpCard from '../components/HelpCard';
import OffersTable from '../components/OffersTable';
import ViewsStats from '../components/ViewsStats';
import { useRules } from '../hooks/useRules';

const SUPPORT_EMAIL = 'support@fmemodules.com';
const SUPPORT_WHATSAPP = '923315986829';

type TypeFilter = 'ALL' | RuleType;
type StatusFilter = 'ALL' | 'ACTIVE' | 'DISABLED';

interface DashboardHomeProps {
  listEpoch: number;
  savedRuleHint: BundleRule | null;
  onClearSavedRuleHint: () => void;
  onCreate: (ruleType: RuleType) => void;
  onEdit: (draft: OfferDraft) => void;
}

export default function DashboardHome({
  listEpoch,
  savedRuleHint,
  onClearSavedRuleHint,
  onCreate,
  onEdit,
}: DashboardHomeProps) {
  const { rules, settings, loading, mutating, error, refresh, removeRule, updateStatus, setRules } =
    useRules();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, [listEpoch, refresh]);

  useEffect(() => {
    if (!savedRuleHint) return;
    setRules((prev) => {
      const idx = prev.findIndex((rule) => rule.id === savedRuleHint.id);
      if (idx >= 0) {
        return prev.map((rule) => (rule.id === savedRuleHint.id ? savedRuleHint : rule));
      }
      return [savedRuleHint, ...prev];
    });
    onClearSavedRuleHint();
    void refresh();
  }, [savedRuleHint, onClearSavedRuleHint, refresh, setRules]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rules.filter((rule) => {
      if (typeFilter !== 'ALL' && rule.ruleType !== typeFilter) return false;
      if (statusFilter !== 'ALL' && rule.status !== statusFilter) return false;
      if (term && !rule.title.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [rules, search, typeFilter, statusFilter]);

  const showToast = (message: string, isError = false) => {
    setToast(message);
    setTimeout(() => setToast(null), 3200);
    if (isError) console.error(message);
  };

  return (
    <>
      <section className="hero-banner">
        <h2>Increase average order value with bundles and upsells</h2>
        <p>Create quantity breaks, fixed bundles, mix &amp; match pools, and cart upsells.</p>
      </section>

      <div className="stats-row">
        <ViewsStats settings={settings} loading={loading} />
        <HelpCard />
        <div className="stat-card">
          <div className="label">Need help?</div>
          <div className="support-links" style={{ marginTop: 12 }}>
            <a className="btn btn-secondary btn-sm" href={`mailto:${SUPPORT_EMAIL}`}>
              Email support
            </a>
            <a
              className="btn btn-secondary btn-sm"
              href={`https://wa.me/${SUPPORT_WHATSAPP}`}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <strong>Your offers</strong>
            {error && <div className="error-banner" style={{ marginTop: 8 }}>{error}</div>}
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={loading || mutating}
            onClick={() => setCreateOpen(true)}
          >
            Create New Offer
          </button>
        </div>
        <div className="card-body">
          <OffersTable
            rules={filtered}
            loading={loading}
            search={search}
            typeFilter={typeFilter}
            statusFilter={statusFilter}
            onSearchChange={setSearch}
            onTypeFilterChange={setTypeFilter}
            onStatusFilterChange={setStatusFilter}
            onEdit={(rule) => onEdit(draftFromRule(rule))}
            onToggleStatus={async (rule) => {
              try {
                const next = rule.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
                await updateStatus(rule.id, next);
                showToast(next === 'ACTIVE' ? 'Offer activated.' : 'Offer paused.');
              } catch {
                showToast('Could not update status.', true);
              }
            }}
            onDelete={async (rule) => {
              if (!window.confirm(`Delete "${rule.title}"? This cannot be undone.`)) return;
              try {
                await removeRule(rule.id);
                showToast('Offer deleted.');
              } catch {
                showToast('Could not delete offer.', true);
              }
            }}
          />
        </div>
      </div>

      {createOpen && (
        <CreateOfferModal
          onClose={() => setCreateOpen(false)}
          onSelect={(type) => {
            setCreateOpen(false);
            onCreate(type);
          }}
        />
      )}

      {toast && <div className={`toast${toast.includes('Could not') ? ' error' : ''}`}>{toast}</div>}
    </>
  );
}
