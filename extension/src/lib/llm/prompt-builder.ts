import type { LLMMessage } from './types'

export const CATEGORIES = [
  'Technology',
  'Shopping',
  'News',
  'Entertainment',
  'Social',
  'Finance',
  'Reference',
  'Productivity',
  'Other',
] as const

export type Category = typeof CATEGORIES[number]

// System prompts - kept minimal for small models
const SYSTEM_PROMPTS = {
  categorize: 'You categorize browser tabs. Output ONLY valid JSON arrays. No explanations.',
  topic: 'You analyze browser tabs and suggest topic labels. Output ONLY valid JSON. No explanations.',
  folder: 'You suggest folder names for bookmarks. Output ONLY valid JSON. No explanations.',
  smartAssign: 'You analyze bookmarks and assign them to the most appropriate existing folder. Output ONLY valid JSON. No explanations.',
  smartCategorize: 'You intelligently categorize items by topic and subtopic based on content, not just domain. Output ONLY valid JSON. No explanations.',
}

export interface TabItem {
  index: number
  title: string
  url: string
}

export function buildCategorizePrompt(items: TabItem[]): LLMMessage[] {
  const itemList = items
    .map((item) => `${item.index}. "${truncate(item.title, 60)}" | ${truncateDomain(item.url)}`)
    .join('\n')

  const userPrompt = `Categorize each item into exactly ONE category.

Categories: ${CATEGORIES.join(', ')}

Items:
${itemList}

Example output:
[{"i":1,"c":"Shopping"},{"i":2,"c":"Technology"},{"i":3,"c":"News"}]

Output JSON array only:`

  return [
    { role: 'system', content: SYSTEM_PROMPTS.categorize },
    { role: 'user', content: userPrompt },
  ]
}

export function buildTopicPrompt(tabs: Array<{ title: string; url: string }>): LLMMessage[] {
  const tabList = tabs
    .slice(0, 15) // Limit to 15 tabs for topic detection
    .map((tab, i) => `${i + 1}. "${truncate(tab.title, 60)}" | ${truncateDomain(tab.url)}`)
    .join('\n')

  const userPrompt = `Analyze these browser tabs and suggest ONE topic label (2-4 words) for this window.

Tabs:
${tabList}

Examples of good topic labels:
- "React State Management"
- "Home Renovation Ideas"
- "Python Machine Learning"
- "Job Search NYC"

Respond with ONLY this JSON format:
{"topic": "your 2-4 word topic here", "confidence": 0.85}`

  return [
    { role: 'system', content: SYSTEM_PROMPTS.topic },
    { role: 'user', content: userPrompt },
  ]
}

export function buildFolderNamePrompt(
  currentName: string,
  bookmarks: Array<{ title: string; url: string }>
): LLMMessage[] {
  const bookmarkList = bookmarks
    .slice(0, 10) // Limit to 10 bookmarks
    .map((b, i) => `${i + 1}. "${truncate(b.title, 50)}" | ${truncateDomain(b.url)}`)
    .join('\n')

  const userPrompt = `These bookmarks are in a folder called "${currentName}". Suggest a better name (2-4 words).

Bookmarks:
${bookmarkList}

Respond ONLY with: {"name": "suggested folder name"}`

  return [
    { role: 'system', content: SYSTEM_PROMPTS.folder },
    { role: 'user', content: userPrompt },
  ]
}

export function buildSimpleCategorizePrompt(
  title: string,
  url: string
): LLMMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPTS.categorize },
    {
      role: 'user',
      content: `Categorize this tab: "${truncate(title, 60)}" | ${truncateDomain(url)}

Categories: ${CATEGORIES.join(', ')}

Respond with the category name only:`,
    },
  ]
}

// Helper functions
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}

function truncateDomain(url: string): string {
  try {
    const parsed = new URL(url)
    const domain = parsed.hostname.replace(/^www\./, '')
    const path = parsed.pathname
    const truncatedPath = path.length > 30 ? path.slice(0, 27) + '...' : path
    return domain + truncatedPath
  } catch {
    return truncate(url, 50)
  }
}

// ============================================
// SMART AI CATEGORIZATION PROMPTS
// ============================================

export interface ExistingFolder {
  id: string
  name: string
  sampleItems?: string[] // Sample bookmark titles in this folder
}

export interface BookmarkItem {
  id: string
  index: number
  title: string
  url: string
}

/**
 * Smart folder assignment - assigns orphan bookmarks to existing folders
 * based on content analysis, not just domain matching
 */
export function buildSmartAssignPrompt(
  bookmarks: BookmarkItem[],
  existingFolders: ExistingFolder[]
): LLMMessage[] {
  const folderList = existingFolders
    .map((f, i) => {
      const samples = f.sampleItems?.slice(0, 3).join(', ') || 'empty'
      return `${i + 1}. "${f.name}" (contains: ${samples})`
    })
    .join('\n')

  const bookmarkList = bookmarks
    .map((b) => `${b.index}. "${truncate(b.title, 50)}" | ${truncateDomain(b.url)}`)
    .join('\n')

  const userPrompt = `Assign each bookmark to the BEST matching existing folder based on topic/content, NOT just domain.

EXISTING FOLDERS:
${folderList}

BOOKMARKS TO ASSIGN:
${bookmarkList}

Rules:
- Match by TOPIC/CONTENT, not domain (e.g., "React Tutorial" goes to "Programming" not "youtube.com")
- If no folder fits well, use "new:Suggested Name" format
- Consider the bookmark title's meaning, not just keywords

Example output:
[{"i":1,"folder":"Programming"},{"i":2,"folder":"new:3D Printing"},{"i":3,"folder":"Shopping"}]

Output JSON array only:`

  return [
    { role: 'system', content: SYSTEM_PROMPTS.smartAssign },
    { role: 'user', content: userPrompt },
  ]
}

/**
 * Smart topic categorization - extracts topic AND subtopic from content
 * Groups by meaning, not domain
 */
export function buildSmartCategorizePrompt(
  items: TabItem[],
  windowTopic?: string
): LLMMessage[] {
  const itemList = items
    .map((item) => `${item.index}. "${truncate(item.title, 60)}" | ${truncateDomain(item.url)}`)
    .join('\n')

  const contextHint = windowTopic
    ? `\nWindow Context: This window is about "${windowTopic}". Use this to inform categorization.`
    : ''

  const userPrompt = `Categorize each item by TOPIC and SUBTOPIC based on the actual content/title meaning.
${contextHint}

Items:
${itemList}

Rules:
- topic: Main category (2-3 words, e.g., "Web Development", "PC Building", "Job Search")
- subtopic: Specific focus (2-4 words, e.g., "React Hooks", "GPU Reviews", "Resume Tips")
- Group by CONTENT MEANING, not by domain
- "YouTube - React Tutorial" → topic: "Web Development", subtopic: "React Tutorial"
- "Reddit r/buildapc" → topic: "PC Building", subtopic: "Community Discussion"

Example output:
[{"i":1,"topic":"Web Development","subtopic":"React Hooks"},{"i":2,"topic":"Shopping","subtopic":"PC Components"}]

Output JSON array only:`

  return [
    { role: 'system', content: SYSTEM_PROMPTS.smartCategorize },
    { role: 'user', content: userPrompt },
  ]
}

/**
 * Analyze existing folder structure to understand user's organization scheme
 */
export function buildAnalyzeFoldersPrompt(
  folders: Array<{ name: string; itemCount: number; sampleTitles: string[] }>
): LLMMessage[] {
  const folderList = folders
    .slice(0, 20)
    .map((f) => `- "${f.name}" (${f.itemCount} items): ${f.sampleTitles.slice(0, 3).join(', ')}`)
    .join('\n')

  const userPrompt = `Analyze this user's bookmark folder structure and identify their organization pattern.

FOLDERS:
${folderList}

Identify:
1. Main categories they use
2. Naming conventions (short vs descriptive, emoji usage, etc.)
3. Topics they care about most

Output JSON:
{
  "categories": ["category1", "category2", ...],
  "namingStyle": "short" | "descriptive" | "emoji",
  "topInterests": ["interest1", "interest2", ...]
}`

  return [
    { role: 'system', content: 'You analyze bookmark organization patterns. Output ONLY valid JSON.' },
    { role: 'user', content: userPrompt },
  ]
}

/**
 * Suggest reorganization for a messy folder
 */
export function buildReorganizeFolderPrompt(
  folderName: string,
  bookmarks: Array<{ title: string; url: string }>,
  existingFolders: string[]
): LLMMessage[] {
  const bookmarkList = bookmarks
    .slice(0, 30)
    .map((b, i) => `${i + 1}. "${truncate(b.title, 50)}" | ${truncateDomain(b.url)}`)
    .join('\n')

  const existingList = existingFolders.slice(0, 15).join(', ')

  const userPrompt = `The folder "${folderName}" has ${bookmarks.length} items and needs reorganization.

BOOKMARKS IN THIS FOLDER:
${bookmarkList}

EXISTING FOLDERS (can move items here): ${existingList}

Suggest how to reorganize:
1. Which items should move to existing folders?
2. What NEW subfolders should be created?
3. What should stay in "${folderName}"?

Output JSON:
{
  "moveToExisting": [{"item": 1, "targetFolder": "FolderName"}, ...],
  "newSubfolders": [{"name": "SubfolderName", "items": [2, 5, 8]}, ...],
  "keepInPlace": [3, 4, 7]
}`

  return [
    { role: 'system', content: 'You reorganize bookmark folders intelligently. Output ONLY valid JSON.' },
    { role: 'user', content: userPrompt },
  ]
}

/**
 * Generate smart group names based on tab content
 */
export function buildSmartGroupNamePrompt(
  tabs: Array<{ title: string; url: string }>,
  category: string
): LLMMessage[] {
  const tabList = tabs
    .slice(0, 10)
    .map((t, i) => `${i + 1}. "${truncate(t.title, 50)}"`)
    .join('\n')

  const userPrompt = `These tabs are in the "${category}" category. Suggest a specific, descriptive group name (2-4 words).

TABS:
${tabList}

Bad names: "Technology", "Misc", "Stuff"
Good names: "React State Management", "GPU Benchmark Research", "TypeScript Migration"

Output JSON: {"name": "Specific Group Name"}`

  return [
    { role: 'system', content: SYSTEM_PROMPTS.topic },
    { role: 'user', content: userPrompt },
  ]
}
