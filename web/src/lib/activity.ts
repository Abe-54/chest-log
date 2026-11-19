import type { Tally, Week } from '~/data'

export interface Activity { dayBars: Tally[]; hourBars: Tally[]; peakHour: Tally; peakDay: Tally }

export function activity(week: Week): Activity {
  const days = new Map<string, number>()
  const hours = Array.from({ length: 24 }, () => 0)
  const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
  for (const match of week.matches) {
    const day = dayFormat.format(new Date(match.startUtc))
    days.set(day, days.get(day) ?? 0)
  }
  for (const time of week.chestTimes) {
    const date = new Date(time)
    const day = dayFormat.format(date)
    days.set(day, (days.get(day) ?? 0) + 1)
    hours[date.getHours()]++
  }
  const hourFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric' })
  const hourBars = hours.map((count, hour) => ({ label: hourFormat.format(new Date(2000, 0, 1, hour)).replace(' ', ''), count }))
  const dayBars = [...days].map(([label, count]) => ({ label, count }))
  const peakHour = hourBars.reduce((a, b) => (b.count > a.count ? b : a))
  const peakDay = dayBars.reduce((a, b) => (b.count > a.count ? b : a))
  return { dayBars, hourBars, peakHour, peakDay }
}
