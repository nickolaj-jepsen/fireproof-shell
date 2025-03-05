export function patternsToCompare(
  patterns: string[],
): ((str: string) => boolean)[] {
  return patterns.map((pattern) => {
    // Check if the pattern should be treated as a regex
    if (
      pattern.startsWith("/") &&
      pattern.endsWith("/") &&
      pattern.length > 1
    ) {
      try {
        const regexPattern = pattern.slice(1, -1);
        const regex = new RegExp(regexPattern);
        return (str: string) => regex.test(str);
      } catch (e) {
        // If regex is invalid, fall back to substring match
        console.warn(
          `Invalid regex pattern: ${pattern}. Using as substring match instead.`,
        );
        return (str: string) => str.includes(pattern);
      }
    }

    // Otherwise, use substring match
    return (str: string) => str.includes(pattern);
  });
}

/**
 *  Compare a string against multiple compare functions.
 */
export function compareMany(
  str: string,
  compareFunctions: ((str: string) => boolean)[],
): boolean {
  return compareFunctions.some((compareFunction) => compareFunction(str));
}
