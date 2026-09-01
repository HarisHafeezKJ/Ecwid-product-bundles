import { useState } from 'react';

export default function HelpCard() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="stat-card">
        <div className="label">Setup guide</div>
        <p style={{ margin: '8px 0 12px', fontSize: '0.875rem', color: 'var(--pb-text-muted)' }}>
          Learn how to publish offers on your storefront.
        </p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>
          Setup Guide &amp; Tips
        </button>
      </div>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Setup Guide &amp; Tips</h2>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
            <ol style={{ paddingLeft: 20, lineHeight: 1.6 }}>
              <li>Create an offer and configure products, tiers, or upsell triggers.</li>
              <li>Customize copy and design in the Style tab, then save the offer.</li>
              <li>
                Make sure the offer is <strong>Active</strong>.
              </li>
              <li>
                In Ecwid app settings, set <strong>customJsUrl</strong> to{' '}
                <code style={{ fontSize: '0.8rem' }}>https://your-app-domain/storefront.js</code>{' '}
                (not <code>pb-bundles.js</code>). Instant Site only injects scripts ending in{' '}
                <code>/storefront.js</code>, same as phone-checkout.
              </li>
            </ol>
            <p style={{ color: 'var(--pb-text-muted)', fontSize: '0.875rem' }}>
              After deploy, Network on a product page should show <code>storefront.js</code> then{' '}
              <code>pb-bundles.js</code>. Console should log <code>[pb-bundles] script loaded</code>.
            </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
