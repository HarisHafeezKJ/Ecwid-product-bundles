import type { BundleItem, CatalogProduct } from '@pb/shared';
import { formatMoney } from '@pb/shared';
import type { OfferDraft } from './editor-draft';
import ProductPoolGrid from './ProductPoolGrid';

interface EditorBundleProductsProps {
  draft: OfferDraft;
  onChange: (patch: Partial<OfferDraft>) => void;
}

function BundleItemCard({
  item,
  product,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  item: BundleItem;
  product?: CatalogProduct;
  index: number;
  total: number;
  onChange: (item: BundleItem) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const variants = product?.variants ?? [];
  const hasVariants = variants.length > 0;

  return (
    <div className="section-card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {product?.imageUrl ? (
          <img src={product.imageUrl} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} />
        ) : (
          <div style={{ width: 56, height: 56, background: 'var(--pb-surface-2)', borderRadius: 8 }} />
        )}
        <div style={{ flex: 1 }}>
          <strong>{product?.name ?? item.name ?? item.productId}</strong>
          {index === 0 && (
            <span className="badge badge-active" style={{ marginLeft: 8 }}>
              Primary
            </span>
          )}
          <div className="field-hint">{product ? formatMoney(product.price) : ''}</div>
          <div className="grid-2" style={{ marginTop: 10 }}>
            <div className="field">
              <label>Min quantity</label>
              <input
                type="number"
                min={1}
                value={item.minQuantity ?? 1}
                onChange={(e) => onChange({ ...item, minQuantity: Number(e.target.value) })}
              />
            </div>
            {hasVariants && (
              <div className="field">
                <label>
                  <input
                    type="checkbox"
                    checked={!item.chooseVariationPerItem}
                    onChange={(e) =>
                      onChange({
                        ...item,
                        chooseVariationPerItem: !e.target.checked,
                        adminLocksVariant: e.target.checked,
                      })
                    }
                    style={{ marginRight: 6 }}
                  />
                  Lock variation
                </label>
                {item.adminLocksVariant && (
                  <select
                    value={item.defaultVariantId ?? ''}
                    onChange={(e) => onChange({ ...item, defaultVariantId: e.target.value })}
                  >
                    <option value="">Select variation</option>
                    {variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {Object.values(v.options).join(' / ') || v.id}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button type="button" className="btn btn-ghost btn-sm" disabled={index === 0} onClick={() => onMove(-1)}>
            ↑
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={index >= total - 1} onClick={() => onMove(1)}>
            ↓
          </button>
          <button type="button" className="btn btn-danger btn-sm" onClick={onRemove}>
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EditorBundleProducts({ draft, onChange }: EditorBundleProductsProps) {
  const items = draft.items.components;

  const updateItems = (next: BundleItem[]) => {
    onChange({
      items: {
        components: next.map((item, index) => ({
          ...item,
          isPrimary: index === 0,
        })),
      },
      primaryProductId: next[0]?.productId,
      targetProductId: draft.applyToAllProducts ? draft.targetProductId : next[0]?.productId,
    });
  };

  return (
    <div className="section-card">
      <h3>Bundle products</h3>
      <p className="field-hint">Add at least two products. The first product is the primary bundle item.</p>
      <ProductPoolGrid
        selectedIds={items.map((i) => i.productId)}
        maxItems={50}
        onChange={(ids, products) => {
          const next = ids.map((id) => {
            const existing = items.find((i) => i.productId === id);
            const product = products.find((p) => p.id === id);
            return (
              existing ?? {
                productId: id,
                name: product?.name,
                imageUrl: product?.imageUrl,
                price: product?.price,
                minQuantity: 1,
                chooseVariationPerItem: true,
                adminLocksVariant: false,
              }
            );
          });
          updateItems(next);
        }}
      />
      <div style={{ marginTop: 16 }}>
        {items.map((item, index) => (
          <BundleItemCard
            key={item.productId}
            item={item}
            index={index}
            total={items.length}
            onChange={(updated) => {
              const next = [...items];
              next[index] = updated;
              updateItems(next);
            }}
            onRemove={() => updateItems(items.filter((_, i) => i !== index))}
            onMove={(dir) => {
              const next = [...items];
              const target = index + dir;
              if (target < 0 || target >= next.length) return;
              [next[index], next[target]] = [next[target]!, next[index]!];
              updateItems(next);
            }}
          />
        ))}
      </div>
    </div>
  );
}
