/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    const row = matrix[0]
    if (row) row[j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const row = matrix[i]
      const prevRow = matrix[i - 1]
      if (!row || !prevRow) continue

      const cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1
      row[j] = Math.min(
        (prevRow[j] ?? 0) + 1,
        (row[j - 1] ?? 0) + 1,
        (prevRow[j - 1] ?? 0) + cost
      )
    }
  }

  return matrix[b.length]?.[a.length] ?? Math.max(a.length, b.length)
}

/**
 * Calculate normalized Levenshtein similarity (0-1)
 */
export function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshteinDistance(a, b) / maxLen
}

/**
 * Calculate Jaccard similarity between two sets
 */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  if (a.size === 0 || b.size === 0) return 0

  let intersection = 0
  for (const item of a) {
    if (b.has(item)) intersection++
  }

  const union = a.size + b.size - intersection
  return intersection / union
}

/**
 * Calculate Jaccard similarity for strings (using word tokens)
 */
export function jaccardStringSimilarity(a: string, b: string): number {
  const tokensA = new Set(tokenize(a))
  const tokensB = new Set(tokenize(b))
  return jaccardSimilarity(tokensA, tokensB)
}

/**
 * Calculate cosine similarity between two strings (using word tokens)
 */
export function cosineSimilarity(a: string, b: string): number {
  const tokensA = tokenize(a)
  const tokensB = tokenize(b)

  const freqA = getFrequency(tokensA)
  const freqB = getFrequency(tokensB)

  const allTokens = new Set([...freqA.keys(), ...freqB.keys()])

  let dotProduct = 0
  let magnitudeA = 0
  let magnitudeB = 0

  for (const token of allTokens) {
    const countA = freqA.get(token) ?? 0
    const countB = freqB.get(token) ?? 0
    dotProduct += countA * countB
    magnitudeA += countA * countA
    magnitudeB += countB * countB
  }

  if (magnitudeA === 0 || magnitudeB === 0) return 0
  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB))
}

/**
 * Tokenize a string into words
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0)
}

/**
 * Get word frequency map
 */
function getFrequency(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>()
  for (const token of tokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1)
  }
  return freq
}

/**
 * Calculate domain overlap between two sets of URLs
 */
export function domainOverlap(urls1: string[], urls2: string[]): number {
  const getDomain = (url: string): string => {
    try {
      return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
    } catch {
      return url
    }
  }

  const domains1 = new Set(urls1.map(getDomain))
  const domains2 = new Set(urls2.map(getDomain))

  return jaccardSimilarity(domains1, domains2)
}

/**
 * Find best matching string from a list
 */
export function findBestMatch(
  query: string,
  candidates: string[],
  minSimilarity = 0.5
): { match: string; similarity: number } | null {
  let bestMatch: string | null = null
  let bestSimilarity = minSimilarity

  for (const candidate of candidates) {
    const similarity = jaccardStringSimilarity(query, candidate)
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity
      bestMatch = candidate
    }
  }

  if (bestMatch === null) return null
  return { match: bestMatch, similarity: bestSimilarity }
}
