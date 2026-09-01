import { useEffect, useMemo } from 'react';
import type { CatalogProduct } from '@pb/shared';
import { formatMoney } from '@pb/shared';
import { useProducts, useProductMap } from '../../hooks/useProducts';

interface ProductPoolGridProps {
  selectedIds: string[];
  maxItems?: number;
  minItems?: number;
  query?: string;
  onChange: (ids: string[], products: CatalogProduct[]) => void;
}

export default function ProductPoolGrid({
  selectedIds,
  maxItems = 25,
  query: externalQuery,
  onChange,
}: ProductPoolGridProps) {
  const { query, setQuery, products, loading } = useProducts();
  const selectedProductMap = useProductMap(selectedIds);

  useEffect(() => {
    if (externalQuery != null) setQuery(externalQuery);
  }, [externalQuery, setQuery]);

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
      const next = selectedIds.filter((id) => id !== product.id);
      const pool = [...products, ...Object.values(selectedProductMap)];
      onChange(next, pool.filter((p) => next.includes(p.id)));
      return;
    }
    if (selectedIds.length >= maxItems) return;
    const next = [...selectedIds, product.id];
    const pool = [...products, product, ...Object.values(selectedProductMap)];
    onChange(next, pool.filter((p) => next.includes(p.id)));
  };

  return (
    <div>
      {externalQuery == null && (
        <div className="field" style={{ marginBottom: 12 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products..."
          />
        </div>
      )}
      {loading && <p className="field-hint">Searching…</p>}
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
                <img src={product.imageUrl} alt="" />
              ) : (
                <div style={{ aspectRatio: '1', background: 'var(--pb-surface-2)', borderRadius: 6 }} />
              )}
              <div className="name">{product.name}</div>
              <div className="price">{formatMoney(product.price)}</div>
            </button>
          );
        })}
      </div>
      {selectedIds.length > 0 && (
        <p className="field-hint" style={{ marginTop: 8 }}>
          {selectedIds.length} selected (max {maxItems})
        </p>
      )}
    </div>
  );
}
