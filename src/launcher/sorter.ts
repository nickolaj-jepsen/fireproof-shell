import { GLib, readFile, writeFile } from "astal";
import type { LauncherEntry } from "./plugins";

class Normalizer {
  static cache: { [str: string]: string } = {};

  get(str?: string): string {
    if (!str) {
      return "";
    }

    if (!Normalizer.cache[str]) {
      Normalizer.cache[str] =
        str
          ?.toLowerCase() // Lowercase the query
          ?.replace(/[^\p{L}\p{N}\p{P}\p{Z}^$\n]/gu, "") // Remove non-alphanumeric characters
          ?.trim() ?? ""; // Trim whitespace
    }

    return Normalizer.cache[str];
  }
}

const calculateRelevance = (query: string, entry: LauncherEntry): number => {
  const normalizer = new Normalizer();
  const normalizedQuery = normalizer.get(query);
  const queryWords = normalizedQuery.split(/\s+/);
  const nameLower = normalizer.get(entry.name);
  const descLower = normalizer.get(entry.description);
  const keywords = entry.keywords?.map(normalizer.get) || [];

  let relevance = 0;

  // Exact match has highest priority
  if (nameLower === normalizedQuery) {
    relevance += 100;
  }

  // Direct keyword match has very high priority
  if (keywords.some((kw) => kw === normalizedQuery)) {
    relevance += 90;
  }

  // Starts with query is next highest
  if (nameLower.startsWith(normalizedQuery)) {
    relevance += 50;
  }

  // Keyword starts with query
  if (keywords.some((kw) => kw.startsWith(normalizedQuery))) {
    relevance += 40;
  }

  // Contains the query string
  if (nameLower.includes(normalizedQuery)) {
    relevance += 30;
  }

  // Calculate word-level matches
  for (const word of normalizedQuery) {
    if (word.length < 2) continue;

    // Keyword contains the query term
    if (keywords.some((kw) => kw.includes(word))) {
      relevance += 25;
    }

    // Word match
    if (queryWords.some((nameWord) => nameWord === word)) {
      relevance += 20;
    }

    // Word starts with query term
    if (queryWords.some((nameWord) => nameWord.startsWith(word))) {
      relevance += 15;
    }

    // Name contains the word
    if (nameLower.includes(word)) {
      relevance += 10;
    }

    // Description contains the word
    if (descLower.includes(word)) {
      relevance += 5;
    }
  }

  return relevance;
};

export const sortByRelevancy = (
  query: string,
  entries: LauncherEntry[],
  options?: { minimumScore?: number },
): LauncherEntry[] => {
  const minimumScore = options?.minimumScore ?? 0;

  if (!query.trim()) {
    return entries;
  }

  return entries
    .map((entry) => ({
      entry,
      relevance: calculateRelevance(query, entry),
    }))
    .filter((item) => item.relevance >= minimumScore)
    .sort((a, b) => b.relevance - a.relevance)
    .map(({ entry }) => entry);
};

export class FrequencySorter {
  path: string;
  data: { [name: string]: number };

  constructor(name: string) {
    const cacheDir = GLib.get_user_cache_dir();
    const dir = "/fireproof-shell/launcher/";
    GLib.mkdir_with_parents(cacheDir + dir, 0o755);
    this.path = cacheDir + dir + name + ".json";
    this.data = this.load();
  }

  private load(): { [name: string]: number } {
    try {
      return JSON.parse(readFile(this.path));
    } catch (e) {
      return {};
    }
  }

  private save(data: { [name: string]: number }) {
    writeFile(this.path, JSON.stringify(data));
  }

  sort(entries: LauncherEntry[]): LauncherEntry[] {
    // Separate entries with frequency data from those without
    const entriesWithFreq: LauncherEntry[] = [];
    const entriesWithoutFreq: LauncherEntry[] = [];

    for (const entry of entries) {
      if (this.data[entry.name] > 0) {
        entriesWithFreq.push(entry);
      } else {
        entriesWithoutFreq.push(entry);
      }
    }

    // Sort only the entries with frequency data
    entriesWithFreq.sort((a, b) => {
      const aFreq = this.data[a.name];
      const bFreq = this.data[b.name];
      return bFreq - aFreq;
    });

    // Return sorted entries with frequency data followed by entries without frequency data
    return [...entriesWithFreq, ...entriesWithoutFreq];
  }

  update(name: string) {
    const existing = this.data[name] || 0;
    this.data[name] = existing + 1;
    this.save(this.data);
  }
}
