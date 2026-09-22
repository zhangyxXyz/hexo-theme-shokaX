interface CommentDateLocale {
  seconds: string
  minutes: string
  hours: string
  days: string
  now: string
}

// Match Waline's date utility and the theme's relativeTimeDays build adapter.
// Keep this small formatter independent of the full client used by comments.
export function formatCommentTime(value: number | string, now: number, days: number, locale: CommentDateLocale): string {
  const date = new Date(typeof value === 'string' && value.includes(' ') ? value.replaceAll('-', '/') : value)
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(now) || !Number.isSafeInteger(days) || days < 0) return ''
  const absolute = () => [date.getFullYear(), date.getMonth() + 1, date.getDate()].map(part => String(part).padStart(2, '0')).join('-')
  if (days === 0) return absolute()
  const elapsed = now - date.getTime()
  const elapsedDays = Math.floor(elapsed / 86400000)
  if (elapsedDays === 0) {
    const remainingDay = elapsed % 86400000
    const hours = Math.floor(remainingDay / 3600000)
    if (hours) return `${hours} ${locale.hours}`
    const remainingHour = remainingDay % 3600000
    const minutes = Math.floor(remainingHour / 60000)
    if (minutes) return `${minutes} ${locale.minutes}`
    return `${Math.round((remainingHour % 60000) / 1000)} ${locale.seconds}`
  }
  if (elapsedDays < 0) return locale.now
  return elapsedDays < days ? `${elapsedDays} ${locale.days}` : absolute()
}
