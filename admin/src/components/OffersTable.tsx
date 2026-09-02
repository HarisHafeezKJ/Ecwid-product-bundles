import type { BundleRule, RuleType } from '@pb/shared';
import { formatRuleDiscount, ruleStatusLabel, ruleTypeLabel } from '@pb/shared';

type TypeFilter = 'ALL' | RuleType;
type StatusFilter = 'ALL' | 'ACTIVE' | 'DISABLED';

interface OffersTableProps {
  rules: BundleRule[];
  loading: boolean;
  search: string;
  typeFilter: TypeFilter;
  statusFilter: StatusFilter;
  onSearchChange: (value: string) => void;
  onTypeFilterChange: (value: TypeFilter) => void;
  onStatusFilterChange: (value: StatusFilter) => void;
  onEdit: (rule: BundleRule) => void;
  onToggleStatus: (rule: BundleRule) => void;
  onDelete: (rule: BundleRule) => void;
  onCreateEmpty?: () => void;
}

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'ALL', label: 'All types' },
  { value: 'VOLUME_DISCOUNT', label: 'Quantity break' },
  { value: 'FIXED_BUNDLE', label: 'Bundle' },
  { value: 'MIX_AND_MATCH', label: 'Mix & Match' },
  { value: 'CART_UPSELL', label: 'Upsells' },
];

export default function OffersTable({
  rules,
  loading,
  search,
  typeFilter,
  statusFilter,
  onSearchChange,
  onTypeFilterChange,
  onStatusFilterChange,
  onEdit,
  onToggleStatus,
  onDelete,
  onCreateEmpty,
}: OffersTableProps) {
  return (
    <div>
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <div className="field">
          <label htmlFor="offer-search">Search offers by name</label>
          <input
            id="offer-search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search..."
          />
        </div>
        <div className="field">
          <label>Type</label>
          <div className="segmented" role="group" aria-label="Offer type filter">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={typeFilter === opt.value ? 'active' : ''}
                onClick={() => onTypeFilterChange(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Status</label>
          <div className="segmented" role="group" aria-label="Offer status filter">
            {(
              [
                { value: 'ALL', label: 'All' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'DISABLED', label: 'Paused' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={statusFilter === opt.value ? 'active' : ''}
                onClick={() => onStatusFilterChange(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && rules.length === 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Offer</th>
                <th>Type</th>
                <th>Discount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="skeleton-row">
                  <td><div className="skeleton skeleton-text" /></td>
                  <td><div className="skeleton skeleton-text skeleton-sm" /></td>
                  <td><div className="skeleton skeleton-text skeleton-sm" /></td>
                  <td><div className="skeleton skeleton-badge" /></td>
                  <td><div className="skeleton skeleton-text" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : rules.length === 0 ? (
        <div className="empty-state">
          <p>No offers yet. Create your first bundle or upsell offer.</p>
          {onCreateEmpty && (
            <button type="button" className="btn btn-primary" style={{ marginTop: 16 }} onClick={onCreateEmpty}>
              Create your first offer
            </button>
          )}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Offer</th>
                <th>Type</th>
                <th>Discount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td>
                    <strong>{rule.title}</strong>
                  </td>
                  <td>{ruleTypeLabel(rule.ruleType)}</td>
                  <td>{formatRuleDiscount(rule)}</td>
                  <td>
                    <span className={`badge badge-${rule.status === 'ACTIVE' ? 'active' : 'paused'}`}>
                      {ruleStatusLabel(rule.status)}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => onEdit(rule)}>
                        Edit
                      </button>
                      <label className="toggle" title={rule.status === 'ACTIVE' ? 'Pause' : 'Activate'}>
                        <input
                          type="checkbox"
                          checked={rule.status === 'ACTIVE'}
                          onChange={() => onToggleStatus(rule)}
                        />
                        <span className="toggle-slider" />
                      </label>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => onDelete(rule)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
