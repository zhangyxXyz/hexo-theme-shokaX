export function dateKey(date: Date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
}

export function calendarRange(now = new Date()) {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const yearAgo = new Date(today)
  yearAgo.setFullYear(today.getFullYear() - 1)
  const calendarStart = new Date(yearAgo)
  calendarStart.setDate(calendarStart.getDate() - calendarStart.getDay())
  return { today, yearAgo, calendarStart }
}
