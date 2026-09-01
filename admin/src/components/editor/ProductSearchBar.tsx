import { useProducts } from '../../hooks/useProducts';
import ProductPoolGrid from './ProductPoolGrid';

interface ProductSearchBarProps {
  label: string;
  selectedIds: string[];
  maxItems?: number;
  minItems?: number;
  onChange: (ids: string[]) => void;
}

export default function ProductSearchBar({
  label,
  selectedIds,
  maxItems = 25,
  minItems,
  onChange,
}: ProductSearchBarProps) {
  const search = useProducts();

  return (
    <div>
      <div className="field">
        <label>{label}</label>
        <input
          value={search.query}
          onChange={(e) => search.setQuery(e.target.value)}
          placeholder="Search products..."
        />
      </div>
      <ProductPoolGrid
        selectedIds={selectedIds}
        maxItems={maxItems}
        minItems={minItems}
        search={search}
        onChange={(ids) => onChange(ids)}
      />
    </div>
  );
}
