import type { AppSettings } from '@pb/shared';
import { currentViewsPeriod } from '@pb/shared';

interface ViewsStatsProps {
  settings: AppSettings | null;
  loading: boolean;
}

export default function ViewsStats({ settings, loading }: ViewsStatsProps) {
  const period = currentViewsPeriod();
  const count =
    settings && settings.viewsPeriod === period ? settings.currentViewsCount : 0;
  const limit = settings?.monthlyViewsLimit ?? 1000;

  return (
    <div className="stat-card">
      <div className="label">Monthly storefront views</div>
      <div className="value">{loading ? '—' : count.toLocaleString()}</div>
      <div className="field-hint" style={{ marginTop: 6 }}>
        {period} · limit {limit.toLocaleString()}
      </div>
    </div>
  );
}
