const DATA_URLS = [
  'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/data/exercises.json',
  'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json',
];
const MEDIA_BASE =
  'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/';
const PAGE = 36;
const TTL_MS = 24 * 60 * 60 * 1000;

export type CatalogExercise = {
  exerciseId: string;
  name: string;
  gifUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
  bodyParts?: string[];
  equipments?: string[];
  targetMuscles?: string[];
  instructions?: string[];
};

type RawExercise = {
  id: string;
  name: string;
  category?: string;
  body_part?: string;
  equipment?: string;
  target?: string;
  image?: string;
  gif_url?: string;
  instruction_steps?: { en?: string[] };
  instructions?: { en?: string };
};

type Cache = { at: number; items: CatalogExercise[] };
let cache: Cache | null = null;
let pending: Promise<CatalogExercise[]> | null = null;

function mediaUrl(path: string | undefined) {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `${MEDIA_BASE}${path.replace(/^\.\//, '')}`;
}

function mapRaw(raw: RawExercise): CatalogExercise {
  const steps = raw.instruction_steps?.en?.filter(Boolean);
  const blob = raw.instructions?.en?.trim();
  const id = String(raw.id).padStart(4, '0');
  return {
    exerciseId: `gv-${id}`,
    name: raw.name,
    gifUrl: mediaUrl(raw.gif_url),
    imageUrl: mediaUrl(raw.image),
    videoUrl: undefined,
    bodyParts: [raw.body_part || raw.category].filter(Boolean) as string[],
    equipments: raw.equipment ? [raw.equipment] : [],
    targetMuscles: raw.target ? [raw.target] : [],
    instructions: steps?.length ? steps : blob ? [blob] : [],
  };
}

async function fetchJson(url: string): Promise<RawExercise[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Catalog ${res.status}`);
    return (await res.json()) as RawExercise[];
  } finally {
    clearTimeout(t);
  }
}

async function loadAll(): Promise<CatalogExercise[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.items;
  if (pending) return pending;
  pending = (async () => {
    let lastErr: unknown;
    for (const url of DATA_URLS) {
      try {
        const raw = await fetchJson(url);
        const items = raw.filter((e) => e?.id && e?.name).map(mapRaw);
        cache = { at: Date.now(), items };
        return items;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('Catalog unavailable');
  })();
  try {
    return await pending;
  } finally {
    pending = null;
  }
}

function filterList(
  items: CatalogExercise[],
  opts: { search?: string; bodyPart?: string },
) {
  const q = opts.search?.trim().toLowerCase();
  const part = opts.bodyPart?.trim().toLowerCase();
  return items.filter((e) => {
    if (q && !e.name.toLowerCase().includes(q)) return false;
    if (!q && part && !e.bodyParts?.some((b) => b.toLowerCase() === part)) return false;
    return true;
  });
}

function paginate(items: CatalogExercise[], after?: string, limit = PAGE) {
  const size = Math.min(100, Math.max(1, limit));
  const start = after ? items.findIndex((e) => e.exerciseId === after) + 1 : 0;
  const slice = items.slice(Math.max(0, start), Math.max(0, start) + size);
  const last = slice[slice.length - 1];
  const end = Math.max(0, start) + slice.length;
  return {
    success: true,
    meta: {
      nextCursor: end < items.length && last ? last.exerciseId : null,
      hasNextPage: end < items.length,
    },
    data: slice,
  };
}

export function sourceKeys(id: string | null | undefined): string[] {
  const raw = String(id ?? '').trim();
  if (!raw) return [];
  const digits = raw.replace(/^gv-/i, '');
  const padded = digits.padStart(4, '0');
  return [...new Set([raw, `gv-${padded}`, padded, digits])];
}

export function thumbOf(e: CatalogExercise) {
  return e.gifUrl || e.imageUrl || null;
}

export async function listCatalog(opts: {
  search?: string;
  bodyPart?: string;
  after?: string;
  limit?: number;
}) {
  const all = filterList(await loadAll(), opts);
  return paginate(all, opts.after, opts.limit ?? PAGE);
}

export async function getCatalogOne(id: string) {
  const all = await loadAll();
  const key = String(id ?? '').trim();
  const padded = key.replace(/^gv-/i, '').padStart(4, '0');
  const found = all.find(
    (e) => e.exerciseId === key || e.exerciseId === `gv-${padded}`,
  );
  return { success: !!found, data: found as CatalogExercise };
}

export async function listBodyParts() {
  const all = await loadAll();
  const parts = [...new Set(all.flatMap((e) => e.bodyParts ?? []).filter(Boolean))].sort();
  return { success: true, data: parts };
}
