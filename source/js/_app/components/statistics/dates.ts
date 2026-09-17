export function dateKey(date: Date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
}

export function calendarRange() {
  const today = new Date()
  const yearAgo = new Date(today)
  yearAgo.setFullYear(today.getFullYear() - 1)
  return { today, yearAgo }
}
