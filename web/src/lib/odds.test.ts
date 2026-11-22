import { expect, test } from 'vitest'
import { percent, tokenChance } from './odds'

test('token odds match the published table', () => {
  expect(percent(tokenChance(3626))).toBe('2.60%')
  expect(percent(tokenChance(7167))).toBe('5.08%')
  expect(percent(tokenChance(95_308))).toBe('50.00%')
  expect(percent(tokenChance(0))).toBe('0.00%')
})
