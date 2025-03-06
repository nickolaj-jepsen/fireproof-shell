import { GLib, readFile, writeFile } from "astal";
import type { LauncherEntry } from "./plugins";

export const sortByRelevancy = (
  query: string,
  entries: LauncherEntry[],
  options?: { minimumScore?: number },
): LauncherEntry[] => {
  if (!query || query.trim() === "") {
    return entries;
  }

  const queryLower = query.toLowerCase().trim();
  const queryWords = queryLower.split(/\s+/);
  const minimumScore = options?.minimumScore ?? 0;

  return entries
    .map((entry) => {
      const nameLower = entry.name.toLowerCase();
      const descLower = entry.description?.toLowerCase() || "";
      const keywords = entry.keywords?.map((kw) => kw.toLowerCase()) || [];
      let relevance = 0;

      // Exact match has highest priority
      if (nameLower === queryLower) {
        relevance += 100;
      }

      // Direct keyword match has very high priority
      if (keywords.some((kw) => kw === queryLower)) {
        relevance += 90;
      }

      // Starts with query is next highest
      if (nameLower.startsWith(queryLower)) {
        relevance += 50;
      }

      // Keyword starts with query
      if (keywords.some((kw) => kw.startsWith(queryLower))) {
        relevance += 40;
      }

      // Contains the query string
      if (nameLower.includes(queryLower)) {
        relevance += 30;
      }

      // Calculate word-level matches
      for (const word of queryWords) {
        if (word.length < 2) continue;

        // Keyword contains the query term
        if (keywords.some((kw) => kw.includes(word))) {
          relevance += 25;
        }

        // Word match
        if (nameLower.split(/\s+/).some((nameWord) => nameWord === word)) {
          relevance += 20;
        }

        // Word starts with query term
        if (
          nameLower.split(/\s+/).some((nameWord) => nameWord.startsWith(word))
        ) {
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

      return { entry, relevance };
    })
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
    return entries.sort((a, b) => {
      const aFreq = this.data[a.name] || 0;
      const bFreq = this.data[b.name] || 0;
      return bFreq - aFreq;
    });
  }

  update(name: string) {
    const existing = this.data[name] || 0;
    this.data[name] = existing + 1;
    this.save(this.data);
  }
}
