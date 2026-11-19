import { describe, expect, it } from 'vitest'
import type { Week } from '~/data'
import { activity } from './activity'

const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute).getTime()
const week = (chestTimes: number[], matchDays: number[]) =>
  ({ chestTimes, matches: matchDays.map(day => ({ startUtc: new Date(2026, 10, day, 20).toISOString() })) }) as unknown as Week

describe('chest activity', () => {
  it('buckets chests by local hour and weekday and picks the peaks', () => {
    const result = activity(week([at(12, 21, 5), at(12, 21, 50), at(13, 9), at(14, 23, 59), at(15, 0, 1)], [12, 13, 14, 15]))
    expect(result.hourBars).toHaveLength(24)
    expect(result.hourBars[21].count).toBe(2)
    expect(result.hourBars[23].count).toBe(1)
    expect(result.hourBars[0].count).toBe(1)
    expect(result.peakHour).toBe(result.hourBars[21])
    expect(result.dayBars.map(bar => bar.count)).toEqual([2, 1, 1, 1])
    expect(result.peakDay).toBe(result.dayBars[0])
  })

  it('keeps a played day with no chests at zero instead of dropping it', () => {
    const result = activity(week([at(12, 21)], [12, 13]))
    expect(result.dayBars.map(bar => bar.count)).toEqual([1, 0])
  })
})
