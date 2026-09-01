import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CatalogProduct } from '@pb/shared';
import * as api from '../api/client';

export interface ProductSearchState {
  query: string;
  setQuery: (query: string) => void;
  products: CatalogProduct[];
  loading: boolean;
  error: string | null;
  search: (term: string) => Promise<void>;
}

export function useProducts(initialQuery = ''): ProductSearchState {
  const [query, setQuery] = useState(initialQuery);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (term: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const results = await api.searchProducts(term, 24, controller.signal);
      if (controller.signal.aborted) return;
      setProducts(results);
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setProducts([]);
      setError(err instanceof Error ? err.message : 'Could not search products.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void search(query);
    }, 300);
    return () => clearTimeout(timer.current);
  }, [query, search]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { query, setQuery, products, loading, error, search };
}

export function useProductMap(productIds: string[]) {
  const [map, setMap] = useState<Record<string, CatalogProduct>>({});
  const idsKey = useMemo(
    () =>
      [...new Set(productIds.filter(Boolean))]
        .sort()
        .join(','),
    [productIds],
  );

  useEffect(() => {
    if (!idsKey) return;
    const ids = idsKey.split(',');
    void (async () => {
      try {
        const products = await api.fetchProductsByIds(ids);
        setMap((prev) => {
          const next = { ...prev };
          for (const product of products) {
            next[product.id] = product;
          }
          return next;
        });
      } catch {
        /* ignore */
      }
    })();
  }, [idsKey]);

  return map;
}
