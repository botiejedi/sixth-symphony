// Common tracking parameters to strip
const TRACKING_PARAMS = new Set([
  // Google Analytics
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'utm_id', 'utm_source_platform', 'utm_creative_format', 'utm_marketing_tactic',
  // Facebook
  'fbclid', 'fb_action_ids', 'fb_action_types', 'fb_source', 'fb_ref',
  // Twitter
  'twclid',
  // Microsoft
  'msclkid',
  // Google Ads
  'gclid', 'gclsrc', 'dclid',
  // Mailchimp
  'mc_cid', 'mc_eid',
  // HubSpot
  'hsa_acc', 'hsa_cam', 'hsa_grp', 'hsa_ad', 'hsa_src', 'hsa_tgt',
  'hsa_kw', 'hsa_mt', 'hsa_net', 'hsa_ver',
  // Generic tracking
  'ref', 'ref_src', 'ref_url', 'source', 'referrer',
  'affiliate', 'aff_id', 'campaign_id',
  // Session/click IDs
  'sessionid', 'session_id', 'clickid', 'click_id',
  // Others
  'trk', 'trkid', 'share', 'si', 's', 'feature',
])

export interface NormalizeOptions {
  stripTracking?: boolean
  stripWww?: boolean
  stripProtocol?: boolean
  stripTrailingSlash?: boolean
  stripHash?: boolean
  lowercase?: boolean
  sortParams?: boolean
}

const DEFAULT_OPTIONS: NormalizeOptions = {
  stripTracking: true,
  stripWww: true,
  stripProtocol: true,
  stripTrailingSlash: true,
  stripHash: true,
  lowercase: true,
  sortParams: true,
}

export function normalizeUrl(url: string, options: NormalizeOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  try {
    const parsed = new URL(url)

    // Skip non-http(s) URLs
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return url
    }

    let hostname = parsed.hostname

    // Strip www
    if (opts.stripWww) {
      hostname = hostname.replace(/^www\./, '')
    }

    // Lowercase hostname
    if (opts.lowercase) {
      hostname = hostname.toLowerCase()
    }

    // Process search params
    if (opts.stripTracking || opts.sortParams) {
      const params = new URLSearchParams()
      const entries = [...parsed.searchParams.entries()]

      // Sort params if needed
      if (opts.sortParams) {
        entries.sort((a, b) => a[0].localeCompare(b[0]))
      }

      for (const [key, value] of entries) {
        // Skip tracking params
        if (opts.stripTracking && TRACKING_PARAMS.has(key.toLowerCase())) {
          continue
        }
        params.set(key, value)
      }

      parsed.search = params.toString()
    }

    // Build normalized URL
    let normalized = ''

    if (!opts.stripProtocol) {
      normalized += 'https://'
    }

    normalized += hostname
    normalized += parsed.pathname

    // Handle trailing slash
    if (opts.stripTrailingSlash && normalized.endsWith('/') && normalized.length > 1) {
      normalized = normalized.slice(0, -1)
    }

    // Add search params
    if (parsed.search) {
      normalized += parsed.search
    }

    // Add hash
    if (!opts.stripHash && parsed.hash) {
      normalized += parsed.hash
    }

    return normalized
  } catch {
    // Return original if URL parsing fails
    return url
  }
}

export function getDomain(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return url
  }
}

export function getBaseDomain(url: string): string {
  const domain = getDomain(url)
  const parts = domain.split('.')
  if (parts.length <= 2) return domain
  // Handle common TLDs like .co.uk, .com.au
  const commonTlds = ['co', 'com', 'org', 'net', 'gov', 'edu']
  if (parts.length >= 3 && commonTlds.includes(parts[parts.length - 2] ?? '')) {
    return parts.slice(-3).join('.')
  }
  return parts.slice(-2).join('.')
}

export function getPath(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.pathname
  } catch {
    return ''
  }
}

export function isSameDomain(url1: string, url2: string): boolean {
  return getDomain(url1) === getDomain(url2)
}

export function isSameBaseDomain(url1: string, url2: string): boolean {
  return getBaseDomain(url1) === getBaseDomain(url2)
}

export function isInternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ['chrome:', 'chrome-extension:', 'edge:', 'about:', 'file:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

export function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}
