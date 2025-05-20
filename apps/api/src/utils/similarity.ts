/**
 * Calculate the Levenshtein distance between two strings
 * @param a - The first string
 * @param b - The second string
 * @returns The Levenshtein distance between the two strings
 */
export const calculateEditDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  // Initialize the matrix
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost, // substitution
      );
    }
  }

  return matrix[a.length][b.length];
};

/**
 * Find the best match from a list of candidates
 * @param source - The source string
 * @param candidates - The list of candidates
 * @param options - The options
 */
export const findBestMatch = (
  source: string,
  candidates: string[],
  options?: { threshold?: number },
): string | null => {
  const { threshold = 3 } = options ?? {};

  // Find the contentItem with the smallest edit distance to the contextItemId
  let bestMatch: string | null = null;
  let smallestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    if (!candidate) continue;

    const distance = calculateEditDistance(source, candidate);
    if (distance < smallestDistance) {
      smallestDistance = distance;
      bestMatch = candidate;
    }
  }

  // If a match was found and it's reasonably close, add it to the matched items
  // (Using a threshold to avoid completely unrelated matches)
  if (bestMatch && smallestDistance <= threshold) {
    return bestMatch;
  }

  return null;
};
