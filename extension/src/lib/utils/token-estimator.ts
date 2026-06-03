/**
 * Rough token estimation for text
 * Based on GPT tokenization patterns (~4 chars per token for English)
 */
export function estimateTokens(text: string): number {
  if (!text) return 0

  // Count words and punctuation
  const words = text.split(/\s+/).filter(Boolean).length
  const chars = text.length

  // Rough estimate: ~1.3 tokens per word for English
  // or ~4 characters per token
  const byWords = Math.ceil(words * 1.3)
  const byChars = Math.ceil(chars / 4)

  // Use the higher estimate to be safe
  return Math.max(byWords, byChars)
}

/**
 * Estimate tokens for a tab (URL + title)
 */
export function estimateTabTokens(url: string, title: string): number {
  return estimateTokens(url) + estimateTokens(title) + 10 // overhead for formatting
}

/**
 * Estimate tokens for a batch of items
 */
export function estimateBatchTokens(
  items: Array<{ url: string; title: string }>,
  overheadPerItem = 10
): number {
  let total = 0
  for (const item of items) {
    total += estimateTabTokens(item.url, item.title) + overheadPerItem
  }
  return total
}

/**
 * Calculate optimal batch size for a given context limit
 */
export function calculateBatchSize(
  items: Array<{ url: string; title: string }>,
  maxContextTokens: number,
  reservedTokens = 2500 // system prompt + examples + response
): number {
  const availableTokens = maxContextTokens - reservedTokens
  if (availableTokens <= 0) return 1

  // Calculate average tokens per item
  let totalTokens = 0
  for (const item of items) {
    totalTokens += estimateTabTokens(item.url, item.title) + 10
  }
  const avgTokensPerItem = totalTokens / items.length

  // Calculate batch size
  const batchSize = Math.floor(availableTokens / avgTokensPerItem)

  // Clamp between reasonable bounds
  return Math.max(5, Math.min(batchSize, 100))
}

/**
 * Split items into batches based on token limits
 */
export function splitIntoBatches<T extends { url: string; title: string }>(
  items: T[],
  maxContextTokens: number,
  reservedTokens = 2500
): T[][] {
  const batches: T[][] = []
  const availableTokens = maxContextTokens - reservedTokens

  let currentBatch: T[] = []
  let currentTokens = 0

  for (const item of items) {
    const itemTokens = estimateTabTokens(item.url, item.title) + 10

    if (currentTokens + itemTokens > availableTokens && currentBatch.length > 0) {
      batches.push(currentBatch)
      currentBatch = []
      currentTokens = 0
    }

    currentBatch.push(item)
    currentTokens += itemTokens
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch)
  }

  return batches
}
