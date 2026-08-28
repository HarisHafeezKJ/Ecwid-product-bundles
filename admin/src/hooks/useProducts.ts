import { useCallback, useEffect, useRef, useState } from 'react';
import type { CatalogProduct } from '@pb/shared';
import * as api from '../api/client';

export function useProducts(initialQuery = '') {
  const [query, setQuery] = useState(initialQuery);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (term: string) => {
    setLoading(true);
    try {
      const results = await api.searchProducts(term);
      setProducts(results);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void search(query);
    }, 300);
    return () => clearTimeout(timer.current);
  }, [query, search]);

  return { query, setQuery, products, loading, search };
}

export function useProductMap(productIds: string[]) {
  const [map, setMap] = useState<Record<string, CatalogProduct>>({});

  useEffect(() => {
    const missing = productIds.filter((id) => id && !map[id]);
    if (missing.length === 0) return;
    void (async () => {
      try {
        const products = await api.searchProducts('');
        const next = { ...map };
        for (const p of products) {
          next[p.id] = p;
        }
        setMap(next);
      } catch {
        /* ignore */
      }
    })();
  }, [productIds, map]);

  return map;
}
