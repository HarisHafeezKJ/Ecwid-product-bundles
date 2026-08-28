import type { OfferDraft } from './editor-draft';
import ProductPoolGrid from './ProductPoolGrid';

interface EditorMixMatchPoolProps {
  draft: OfferDraft;
  onChange: (patch: Partial<OfferDraft>) => void;
}

export default function EditorMixMatchPool({ draft, onChange }: EditorMixMatchPoolProps) {
  return (
    <div className="section-card">
      <h3>Mix product pool</h3>
      <p className="field-hint">Select 2–25 products shoppers can mix and match.</p>
      <ProductPoolGrid
        selectedIds={draft.items.components.map((c) => c.productId)}
        maxItems={25}
        minItems={2}
        onChange={(ids, products) =>
          onChange({
            items: {
              components: ids.map((id) => {
                const product = products.find((p) => p.id === id);
                return {
                  productId: id,
                  name: product?.name,
                  imageUrl: product?.imageUrl,
                  price: product?.price,
                  minQuantity: 1,
                  chooseVariationPerItem: true,
                };
              }),
            },
          })
        }
      />
    </div>
  );
}
