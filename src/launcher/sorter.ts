import type { LauncherEntry } from "./plugins";

export const sortByRelevancy = (
  query: string,
  entries: LauncherEntry[],
): LauncherEntry[] => {
  if (!query || query.trim() === "") {
    return entries;
  }

  const queryLower = query.toLowerCase().trim();
  const queryWords = queryLower.split(/\s+/);

  return entries
    .map((entry) => {
      const nameLower = entry.name.toLowerCase();
      const descLower = entry.description?.toLowerCase() || "";

      let relevance = 0;

      // Exact match has highest priority
      if (nameLower === queryLower) {
        relevance += 100;
      }

      // Starts with query is next highest
      if (nameLower.startsWith(queryLower)) {
        relevance += 50;
      }

      // Contains the query string
      if (nameLower.includes(queryLower)) {
        relevance += 30;
      }

      // Calculate word-level matches
      for (const word of queryWords) {
        if (word.length < 2) continue;

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
    .sort((a, b) => b.relevance - a.relevance)
    .map(({ entry }) => entry);
};
