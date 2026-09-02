import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import type { BundleItem, CatalogProduct } from '@pb/shared';
import { formatMoney } from '@pb/shared';
import { useProductMap } from '../../hooks/useProducts';
import type { OfferDraft } from './editor-draft';
import ProductPoolGrid from './ProductPoolGrid';

interface EditorBundleProductsProps {
  draft: OfferDraft;
  onChange: (patch: Partial<OfferDraft>) => void;
}

interface BundleItemCardProps {
  item: BundleItem;
  product?: CatalogProduct;
  index: number;
  total: number;
  onChange: (item: BundleItem) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  dragAttributes?: DraggableAttributes;
  dragListeners?: SyntheticListenerMap;
  isDragging?: boolean;
}

function BundleItemCard({
  item,
  product,
  index,
  total,
  onChange,
  onRemove,
  onMove,
  dragAttributes,
  dragListeners,
  isDragging,
}: BundleItemCardProps) {
  const variants = product?.variants ?? [];
  const hasVariants = variants.length > 0;
  const sortable = total > 1 && dragAttributes != null && dragListeners != null;

  return (
    <div className={`section-card bundle-item-card${isDragging ? ' bundle-item-card--dragging' : ''}`}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {sortable && (
          <button
            type="button"
            className="bundle-item-drag-handle"
            aria-label={`Drag to reorder ${product?.name ?? item.name ?? item.productId}`}
            {...dragAttributes}
            {...dragListeners}
          >
            <span className="bundle-item-drag-handle__icon" aria-hidden="true">
              ⋮⋮
            </span>
          </button>
        )}
        {product?.imageUrl ?? item.imageUrl ? (
          <img
            src={product?.imageUrl ?? item.imageUrl}
            alt={product?.name ?? item.name ?? item.productId}
            style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }}
          />
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
                <label htmlFor={`variant-mode-${item.productId}`}>Variation</label>
                <select
                  id={`variant-mode-${item.productId}`}
                  value={item.adminLocksVariant ? 'LOCKED' : 'CUSTOMER'}
                  onChange={(e) => {
                    const locked = e.target.value === 'LOCKED';
                    onChange({
                      ...item,
                      adminLocksVariant: locked,
                      chooseVariationPerItem: !locked,
                      defaultVariantId: locked ? item.defaultVariantId : undefined,
                    });
                  }}
                >
                  <option value="CUSTOMER">Customer chooses variation</option>
                  <option value="LOCKED">Lock to a specific variation</option>
                </select>
                {item.adminLocksVariant && (
                  <select
                    value={item.defaultVariantId ?? ''}
                    onChange={(e) => onChange({ ...item, defaultVariantId: e.target.value })}
                    style={{ marginTop: 8 }}
                  >
                    <option value="">Select variation</option>
                    {variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {Object.values(v.options).join(' / ') || v.id}
                      </option>
                    ))}
                  </select>
                )}
                {hasVariants && !item.adminLocksVariant && (item.minQuantity ?? 1) > 1 && (
                  <p className="field-hint" style={{ marginTop: 8 }}>
                    Customers choose a separate variation for each unit (e.g. Size 1, Size 2).
                  </p>
                )}
                {hasVariants && item.adminLocksVariant && (item.minQuantity ?? 1) > 1 && (
                  <p className="field-hint" style={{ marginTop: 8 }}>
                    All units use the locked variation above.
                  </p>
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

function SortableBundleItemCard(props: Omit<BundleItemCardProps, 'dragAttributes' | 'dragListeners' | 'isDragging'>) {
  const { item } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.productId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    marginBottom: 12,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <BundleItemCard
        {...props}
        isDragging={isDragging}
        dragAttributes={attributes}
        dragListeners={listeners}
      />
    </div>
  );
}

export default function EditorBundleProducts({ draft, onChange }: EditorBundleProductsProps) {
  const items = draft.items.components;
  const productMap = useProductMap(items.map((item) => item.productId));
  const sortableIds = items.map((item) => item.productId);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.productId === active.id);
    const newIndex = items.findIndex((item) => item.productId === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    updateItems(arrayMove(items, oldIndex, newIndex));
  };

  return (
    <div className="section-card">
      <h3>Bundle products</h3>
      <p className="field-hint">
        Add at least two products. Drag to reorder — the first product is the primary bundle item.
      </p>
      <ProductPoolGrid
        selectedIds={items.map((i) => i.productId)}
        maxItems={50}
        minItems={2}
        onChange={(ids, products) => {
          const next = ids.map((id) => {
            const existing = items.find((i) => i.productId === id);
            const product = products.find((p) => p.id === id) ?? productMap[id];
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
        {items.length > 1 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              {items.map((item, index) => (
                <SortableBundleItemCard
                  key={item.productId}
                  item={item}
                  product={productMap[item.productId]}
                  index={index}
                  total={items.length}
                  onChange={(updated) => {
                    const next = [...items];
                    const catalog = productMap[item.productId];
                    next[index] = {
                      ...updated,
                      name: updated.name ?? catalog?.name ?? item.name,
                      imageUrl: updated.imageUrl ?? catalog?.imageUrl ?? item.imageUrl,
                      price: updated.price ?? catalog?.price ?? item.price,
                    };
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
            </SortableContext>
          </DndContext>
        ) : (
          items.map((item, index) => (
            <div key={item.productId} style={{ marginBottom: 12 }}>
              <BundleItemCard
                item={item}
                product={productMap[item.productId]}
                index={index}
                total={items.length}
                onChange={(updated) => {
                  const next = [...items];
                  const catalog = productMap[item.productId];
                  next[index] = {
                    ...updated,
                    name: updated.name ?? catalog?.name ?? item.name,
                    imageUrl: updated.imageUrl ?? catalog?.imageUrl ?? item.imageUrl,
                    price: updated.price ?? catalog?.price ?? item.price,
                  };
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
            </div>
          ))
        )}
      </div>
    </div>
  );
}
