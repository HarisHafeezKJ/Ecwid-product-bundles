import { useProducts } from '../../hooks/useProducts';
import ProductPoolGrid from './ProductPoolGrid';

interface ProductSearchBarProps {
  label: string;
  selectedIds: string[];
  maxItems?: number;
  onChange: (ids: string[]) => void;
}

export default function ProductSearchBar({
  label,
  selectedIds,
  maxItems = 25,
  onChange,
}: ProductSearchBarProps) {
  const { query, setQuery } = useProducts();

  return (
    <div>
      <div className="field">
        <label>{label}</label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products..."
        />
      </div>
      <ProductPoolGrid
        selectedIds={selectedIds}
        maxItems={maxItems}
        query={query}
        onChange={onChange}
      />
    </div>
  );
}
