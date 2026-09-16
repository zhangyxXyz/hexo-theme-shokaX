import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as yaml from 'js-yaml'
import { selectFestival } from '../source/js/_app/components/festival/calendar.ts'

const table = yaml.load(readFileSync(new URL('../_festivals.yml', import.meta.url), 'utf8'))
const options = { enable: true, theme: 'auto', table }
const check = (date, expected) => assert.equal(selectFestival(options, new Date(date)), expected, date)
// 2026 dates checked against the Hong Kong Observatory calendar.
check('2026-02-09T12:00:00+08:00', 'daily')
check('2026-02-10T00:00:00+08:00', 'spring')
check('2026-02-17T12:00:00+08:00', 'spring')
check('2026-03-03T23:59:59+08:00', 'spring')
check('2026-03-04T00:00:00+08:00', 'daily')
check('2026-06-15T12:00:00+08:00', 'daily')
check('2026-06-16T12:00:00+08:00', 'dragon_boat')
check('2026-06-21T12:00:00+08:00', 'dragon_boat')
check('2026-06-22T12:00:00+08:00', 'daily')
check('2026-09-17T23:59:59+08:00', 'daily')
check('2026-09-18T00:00:00+08:00', 'mid_autumn')
check('2026-09-28T23:59:59+08:00', 'mid_autumn')
check('2026-09-29T00:00:00+08:00', 'daily')
assert.equal(selectFestival({ ...options, theme: 'spring' }, new Date('2026-09-16')), 'spring')
assert.equal(selectFestival({ ...options, enable: false }), 'none')
assert.equal(selectFestival({ ...options, theme: 'none' }), 'none')
const disabled = structuredClone(options)
disabled.table.items.daily.enable = false
assert.equal(selectFestival(disabled, new Date('2026-09-16')), 'none')
disabled.table.items.spring.enable = false
assert.equal(selectFestival(disabled, new Date('2026-02-17')), 'none')
const custom = structuredClone(options)
custom.table.items.mid_autumn.before = 0
assert.equal(selectFestival(custom, new Date('2026-09-20')), 'daily')
const solar = structuredClone(options)
Object.assign(solar.table.items.spring, { calendar: 'solar', month: 1, day: 1, before: 3, after: 2 })
assert.equal(selectFestival(solar, new Date('2025-12-30')), 'spring')
console.log('Festival schedule checks passed')
