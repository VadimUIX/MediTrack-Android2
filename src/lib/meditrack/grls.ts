export type GrlsItem = {
  r: string;
  n: string;
  i: string;
  f: string;
  s: string;
  e: string;
};

type GrlsCatalog = {
  source: string;
  asOf: string;
  items: GrlsItem[];
};

let catalogPromise: Promise<GrlsItem[]> | null = null;

function normalize(value: string): string {
  return value
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/[«»„“”"'.,;:()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function loadCatalog(): Promise<GrlsItem[]> {
  if (!catalogPromise) {
    catalogPromise = fetch(`${import.meta.env.BASE_URL}grls-catalog.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`Не удалось загрузить ГРЛС: ${response.status}`);
        return response.json() as Promise<GrlsCatalog>;
      })
      .then((catalog) => {
        if (!catalog || !Array.isArray(catalog.items)) throw new Error("Некорректный каталог ГРЛС");
        return catalog.items;
      })
      .catch((error) => {
        catalogPromise = null;
        throw error;
      });
  }
  return catalogPromise;
}

export async function searchGrls(query: string, limit = 8): Promise<GrlsItem[]> {
  const normalized = normalize(query);
  if (normalized.length < 2) return [];
  try {
    const items = await loadCatalog();
    const matches: Array<{ item: GrlsItem; score: number }> = [];
    for (const item of items) {
      const trade = normalize(item.n);
      const inn = normalize(item.i);
      if (!trade.includes(normalized) && !inn.includes(normalized)) continue;
      const score = trade.startsWith(normalized) ? 0 : inn.startsWith(normalized) ? 1 : trade.includes(normalized) ? 2 : 3;
      matches.push({ item, score });
    }
    matches.sort((a, b) => a.score - b.score || a.item.n.localeCompare(b.item.n, "ru") || a.item.r.localeCompare(b.item.r));
    const seen = new Set<string>();
    return matches
      .filter(({ item }) => {
        const key = `${item.r}| ${item.n}| ${item.s}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, limit)
      .map(({ item }) => item);
  } catch {
    return [];
  }
}
