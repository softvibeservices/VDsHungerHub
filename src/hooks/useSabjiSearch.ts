import { useState, useMemo, useEffect } from "react";

const FREQ_KEY = "vdh_sabji_freq";

interface Product {
  id: string;
  name: string;
  nameGu?: string | null;
}

function getFreqMap(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(FREQ_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function bumpFreq(productId: string) {
  if (typeof window === "undefined") return;
  const map = getFreqMap();
  map[productId] = (map[productId] ?? 0) + 1;
  localStorage.setItem(FREQ_KEY, JSON.stringify(map));
}

export function useSabjiSearch(products: Product[]) {
  const [query, setQuery] = useState("");
  const [freqMap, setFreqMap] = useState<Record<string, number>>({});

  useEffect(() => {
    setFreqMap(getFreqMap());
  }, []);

  const sorted = useMemo(() => {
    const q = query.toLowerCase().trim();
    const filtered = q
      ? products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.nameGu ?? "").toLowerCase().includes(q)
        )
      : products;

    return [...filtered].sort((a, b) => (freqMap[b.id] ?? 0) - (freqMap[a.id] ?? 0));
  }, [query, products, freqMap]);

  // Top frequently used (shown as quick-add chips when query is empty)
  const frequentItems = useMemo(() => {
    if (query) return [];
    return Object.entries(freqMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id]) => products.find((p) => p.id === id))
      .filter(Boolean) as Product[];
  }, [freqMap, products, query]);

  const recordSelection = (productId: string) => {
    bumpFreq(productId);
    setFreqMap(getFreqMap());
  };

  return { query, setQuery, sorted, frequentItems, recordSelection };
}
