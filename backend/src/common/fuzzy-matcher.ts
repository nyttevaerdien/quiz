import { fuzzy } from 'fast-fuzzy';

/**
 * Checks if a player answer matches the expected answer key using fuzzy matching.
 *
 * - Strips leading/trailing punctuation and extra whitespace
 * - Case-insensitive
 * - Handles small typos or spelling errors using Levenshtein distance metrics via `fast-fuzzy`
 * - Strict checking on purely numeric answers (e.g. year, count) to avoid wrong numbers matching
 */
export function isFuzzyAnswerMatch(playerAnswer: string, expectedAnswer: string, threshold: number = 0.82): boolean {
  if (!playerAnswer || !expectedAnswer) return false;

  const normalize = (str: string) =>
    str
      .toLowerCase()
      .trim()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, '')
      .replace(/\s+/g, ' ');

  const cleanPlayer = normalize(playerAnswer);
  const cleanExpected = normalize(expectedAnswer);

  if (cleanPlayer === cleanExpected) {
    return true;
  }

  // If expected answer is purely numeric (e.g., "1984" or "42"), require exact match
  if (/^\d+$/.test(cleanExpected)) {
    return cleanPlayer === cleanExpected;
  }

  // For very short answers (1-3 chars), require exact match to avoid false positives (e.g., "cat" vs "cot")
  if (cleanExpected.length <= 3) {
    return cleanPlayer === cleanExpected;
  }

  // Use fast-fuzzy score (0.0 to 1.0)
  const score = fuzzy(cleanPlayer, cleanExpected, {
    ignoreCase: true,
    normalizeWhitespace: true,
  });

  return score >= threshold;
}
