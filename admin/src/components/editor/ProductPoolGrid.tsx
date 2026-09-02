import { useMemo, useState } from 'react';
import type { CatalogProduct } from '@pb/shared';
import { formatMoney } from '@pb/shared';
import { useProductMap, useProducts, type ProductSearchState } from '../../hooks/useProducts';

interface ProductPoolGridProps {
  selectedIds: string[];
  maxItems?: number;
  minItems?: number;
  search?: ProductSearchState;
  onChange: (ids: string[], products: CatalogProduct[]) => void;
}

/**
 * Hooks cannot be called conditionally, so the self-searching variant is a separate
 * component. Otherwise every grid fed by a shared ProductSearchBar would still run its
 * own debounced catalog search and throw the results away.
 */
export default function ProductPoolGrid(props: ProductPoolGridProps) {
  if (props.search) return <PoolGrid {...props} search={props.search} showSearchInput={false} />;
  return <SelfSearchingPoolGrid {...props} />;
}

function SelfSearchingPoolGrid(props: ProductPoolGridProps) {
  const search = useProducts();
  return <PoolGrid {...props} search={search} showSearchInput />;
}

function PoolGrid({
  selectedIds,
  maxItems = 25,
  minItems = 0,
  search,
  showSearchInput,
  onChange,
}: ProductPoolGridProps & { search: ProductSearchState; showSearchInput: boolean }) {
  const { products, loading, error, setQuery } = search;
  const selectedProductMap = useProductMap(selectedIds);
  const [limitHint, setLimitHint] = useState<string | null>(null);

  const displayProducts = useMemo(() => {
    const byId = new Map<string, CatalogProduct>();
    for (const id of selectedIds) {
      const selected = selectedProductMap[id];
      if (selected) byId.set(id, selected);
    }
    for (const product of products) {
      byId.set(product.id, product);
    }
    return Array.from(byId.values());
  }, [selectedIds, selectedProductMap, products]);

  const toggle = (product: CatalogProduct) => {
    const exists = selectedIds.includes(product.id);
    if (exists) {
      if (selectedIds.length <= minItems) {
        setLimitHint(`Select at least ${minItems} product${minItems === 1 ? '' : 's'}.`);
        return;
      }
      setLimitHint(null);
      const next = selectedIds.filter((id) => id !== product.id);
      const pool = [...products, ...Object.values(selectedProductMap)];
      onChange(next, pool.filter((p) => next.includes(p.id)));
      return;
    }
    if (selectedIds.length >= maxItems) {
      setLimitHint(`Maximum ${maxItems} products can be selected.`);
      return;
    }
    setLimitHint(null);
    const next = [...selectedIds, product.id];
    const pool = [...products, product, ...Object.values(selectedProductMap)];
    onChange(next, pool.filter((p) => next.includes(p.id)));
  };

  return (
    <div>
      {showSearchInput && (
        <div className="field" style={{ marginBottom: 12 }}>
          <input
            value={search.query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products..."
          />
        </div>
      )}
      {error && <div className="error-banner" style={{ marginBottom: 12 }}>{error}</div>}
      {loading && (
        <div className="field-hint" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span className="spinner" aria-hidden="true" />
          Searching…
        </div>
      )}
      {!loading && displayProducts.length === 0 && !error && (
        <p className="field-hint">Type to search products in your catalog.</p>
      )}
      <div className="product-grid">
        {displayProducts.map((product) => {
          const selected = selectedIds.includes(product.id);
          return (
            <button
              key={product.id}
              type="button"
              className={`product-card${selected ? ' selected' : ''}`}
              onClick={() => toggle(product)}
            >
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} />
              ) : (
                <div style={{ aspectRatio: '1', background: 'var(--pb-surface-2)', borderRadius: 6 }} />
              )}
              <div className="name">{product.name}</div>
              <div className="price">{formatMoney(product.price)}</div>
            </button>
          );
        })}
      </div>
      {limitHint && (
        <p className="field-hint" style={{ marginTop: 8, color: 'var(--pb-danger, #b91c1c)' }}>
          {limitHint}
        </p>
      )}
      {selectedIds.length > 0 && (
        <p className="field-hint" style={{ marginTop: 8 }}>
          {selectedIds.length} selected
          {minItems > 0 ? ` (min ${minItems}, max ${maxItems})` : ` (max ${maxItems})`}
        </p>
      )}
    </div>
  );
}
