export type SearchableSkuItem = {
  sku: string;
  name?: string | null;
  manufacturerRef?: string | null;
  color?: string | null;
};

function normalizeTerm(term: string) {
  return term.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function stripLeadingZeros(value: string) {
  return value.replace(/^0+(?=\d)/, "");
}

function normalizeRefLike(value: string) {
  const normalized = normalizeTerm(value);
  const ruMatch = normalized.match(/^RU(\d+)$/);
  if (ruMatch) {
    return `RU${stripLeadingZeros(ruMatch[1])}`;
  }
  if (/^\d+$/.test(normalized)) {
    return stripLeadingZeros(normalized);
  }
  return normalized;
}

function isExactSkuQuery(normalized: string) {
  return /^[0-9]+$/.test(normalized) || /^RU[0-9]+$/.test(normalized);
}

function exactSkuFromTerm(normalized: string) {
  if (/^[0-9]+$/.test(normalized)) return `RU${stripLeadingZeros(normalized)}`;
  const ruMatch = normalized.match(/^RU(\d+)$/);
  if (ruMatch) return `RU${stripLeadingZeros(ruMatch[1])}`;
  return normalizeRefLike(normalized);
}

export function scoreSkuSearch(item: SearchableSkuItem, term: string) {
  const raw = term.trim();
  if (!raw) return 0;
  const lower = raw.toLowerCase();
  const normalized = normalizeTerm(raw);
  const normalizedRef = normalizeRefLike(raw);
  const skuNorm = normalizeRefLike(item.sku);
  const exactQuery = isExactSkuQuery(normalized);
  const exactSku = exactQuery ? exactSkuFromTerm(normalized) : "";

  if (exactQuery) {
    if (skuNorm === exactSku) return 0;
  } else {
    if (skuNorm === normalizedRef || skuNorm === exactSkuFromTerm(normalized)) {
      return 0;
    }
    if (skuNorm.includes(normalizedRef)) return 1;
  }

  const refNorm = normalizeRefLike(item.manufacturerRef ?? "");
  if (refNorm && (refNorm === normalizedRef || refNorm.includes(normalizedRef))) {
    return 2;
  }

  const ref = (item.manufacturerRef ?? "").toLowerCase();
  if (ref.includes(lower)) return 2;

  const name = (item.name ?? "").toLowerCase();
  if (name.includes(lower)) return 3;

  const color = (item.color ?? "").toLowerCase();
  if (color.includes(lower)) return 4;

  return null;
}

export function filterAndScoreSkus<T extends SearchableSkuItem>(
  items: T[],
  term: string,
) {
  const trimmed = term.trim();
  if (!trimmed) return items.map((item) => ({ item, score: 0 }));
  return items
    .map((item) => {
      const score = scoreSkuSearch(item, trimmed);
      if (score === null) return null;
      return { item, score };
    })
    .filter((entry): entry is { item: T; score: number } => Boolean(entry));
}
