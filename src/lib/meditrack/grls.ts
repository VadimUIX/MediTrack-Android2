export type GrlsItem = {
  r: string;
  n: string;
  i: string;
  f: string;
  s: string;
  e: string;
};

export type GrlsGroup = {
  name: string;
  inn: string;
  items: GrlsItem[];
  score: number;
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

export async function searchGrls(query: string, limit = 8): Promise<GrlsGroup[]> {
  const normalized = normalize(query);
  if (normalized.length < 2) return [];
  try {
    const items = await loadCatalog();
    const groups = new Map<string, GrlsGroup>();

    for (const item of items) {
      const trade = normalize(item.n);
      const inn = normalize(item.i);
      if (!trade.includes(normalized) && !inn.includes(normalized)) continue;

      const score = trade.startsWith(normalized) ? 0 : inn.startsWith(normalized) ? 1 : trade.includes(normalized) ? 2 : 3;
      // Same trade name + same INN form one family. Different INNs remain separate.
      const groupKey = `${trade}| ${inn}`;
      let group = groups.get(groupKey);
      if (!group) {
        group = { name: item.n.trim(), inn: item.i.trim(), items: [], score };
        groups.set(groupKey, group);
      } else {
        group.score = Math.min(group.score, score);
      }

      // Remove only truly identical registry rows; keep different forms, statuses,
      // registration numbers, validity dates and pack/strength descriptions.
      const duplicateKey = [item.r, item.f, item.s, item.e].map(normalize).join("|");
      if (!group.items.some((existing) => [existing.r, existing.f, existing.s, existing.e].map(normalize).join("|") === duplicateKey)) {
        group.items.push(item);
      }
    }

    return [...groups.values()]
      .map((group) => ({
        ...group,
        items: group.items.sort((a, b) =>
          a.f.localeCompare(b.f, "ru") ||
          a.s.localeCompare(b.s, "ru") ||
          a.r.localeCompare(b.r, "ru"),
        ),
      }))
      .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name, "ru") || a.inn.localeCompare(b.inn, "ru"))
      .slice(0, limit);
  } catch {
    return [];
  }
}
