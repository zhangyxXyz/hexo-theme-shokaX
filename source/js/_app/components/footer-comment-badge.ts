import { matchesFriendWebsite } from './comment-friend'

export type FooterBadgeColors = { light?: Record<string, string>; dark?: Record<string, string> }

export function getFooterLevelBadge(
  item: { type?: string; level?: number; levelLabel?: string; levelColors?: FooterBadgeColors },
  locale: Record<string, string>,
  overrides: Record<string, string> = {},
  colors: Record<string, FooterBadgeColors> = {},
  hideAdminLevel = false
) {
  if ((hideAdminLevel && item.type === 'administrator') || typeof item.level !== 'number') return undefined
  const key = `level${item.level}`
  return {
    text: overrides[key] ?? item.levelLabel ?? locale[key] ?? `Level ${item.level}`,
    colors: item.levelColors,
    override: colors[key]
  }
}

const normalizeWebsite = (link: string) => {
  const value = link.trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value) || value.startsWith('//')) return value
  // Waline accepts bare hostnames, but other schemes and relative paths are not websites.
  if (/^[a-z][a-z\d+.-]*:/i.test(value) || /^[\/\\]/.test(value)) return ''
  return `https://${value}`
}

export function getFooterCommentBadge(
  item: { label?: string; type?: string; link?: string },
  friends: string[],
  friendLabel: string
): { text: string; kind: 'author' | 'member' | 'friend' } | undefined {
  const label = typeof item.label === 'string' ? item.label.trim() : ''
  const administrator = item.type === 'administrator'
  // Native labels take precedence; callers render this text with textContent.
  if (label) return { text: label, kind: administrator ? 'author' : 'member' }
  if (administrator) return undefined

  const text = friendLabel.trim()
  const website = normalizeWebsite(typeof item.link === 'string' ? item.link : '')
  // A matching website is a decorative label, not verified user identity.
  if (text && matchesFriendWebsite(website, friends)) return { text, kind: 'friend' }
  return undefined
}
