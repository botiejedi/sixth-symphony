// Browser detection and compatibility layer
import browser from 'webextension-polyfill'

export const isFirefox = navigator.userAgent.includes('Firefox')
export const isChrome = !isFirefox && typeof chrome !== 'undefined'
export const isSafari = navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')

// Firefox doesn't support tab groups
export const supportsTabGroups = isChrome && typeof chrome !== 'undefined' && 'tabGroups' in chrome

// Firefox uses sidebar_action, Chrome uses side_panel
export const supportsSidePanel = isChrome && typeof chrome !== 'undefined' && 'sidePanel' in chrome

// Use webextension-polyfill for cross-browser compatibility
export const browserAPI = browser

// Feature flags
export const features = {
  tabGroups: supportsTabGroups,
  sidePanel: supportsSidePanel,
  sidebar: isFirefox,
  isSafari,
}
