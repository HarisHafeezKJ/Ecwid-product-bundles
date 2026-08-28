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
                  Make sure the offer is <strong>Active</strong> and your storefront script is
                  installed for cart upsells.
                </li>
              </ol>
              <p style={{ color: 'var(--pb-text-muted)', fontSize: '0.875rem' }}>
                Product-page widgets appear on matching product pages. Cart upsells require the
                embedded script to be enabled and your store theme to load the app script.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
