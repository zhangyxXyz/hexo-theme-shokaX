import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../', import.meta.url))
const bundle = await build({
  stdin: { contents: "export * from './source/js/_app/components/reading-tools/live2d-calendar'", resolveDir: root, loader: 'ts' },
  bundle: true, write: false, format: 'esm', platform: 'node'
})
const { selectCalendarTip, calendarYears } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)

// 2026 schedule from the State Council notice, as published by NateScarlet/holiday-cn.
const days = `2026-01-01 元旦 1; 2026-01-02 元旦 1; 2026-01-03 元旦 1; 2026-01-04 元旦 0; 2026-02-14 春节 0; 2026-02-15 春节 1;
2026-02-16 春节 1; 2026-02-17 春节 1; 2026-02-18 春节 1; 2026-02-19 春节 1; 2026-02-20 春节 1; 2026-02-21 春节 1; 2026-02-22 春节 1;
2026-02-23 春节 1; 2026-02-28 春节 0; 2026-04-04 清明节 1; 2026-04-05 清明节 1; 2026-04-06 清明节 1; 2026-05-01 劳动节 1;
2026-05-02 劳动节 1; 2026-05-03 劳动节 1; 2026-05-04 劳动节 1; 2026-05-05 劳动节 1; 2026-05-09 劳动节 0; 2026-06-19 端午节 1;
2026-06-20 端午节 1; 2026-06-21 端午节 1; 2026-09-20 国庆节 0; 2026-09-25 中秋节 1; 2026-09-26 中秋节 1; 2026-09-27 中秋节 1;
2026-10-01 国庆节 1; 2026-10-02 国庆节 1; 2026-10-03 国庆节 1; 2026-10-04 国庆节 1; 2026-10-05 国庆节 1; 2026-10-06 国庆节 1;
2026-10-07 国庆节 1; 2026-10-10 国庆节 0`.split(';').map(row => {
  const [date, name, off] = row.trim().split(' ')
  return { date, name, isOffDay: off === '1' }
})

const tips = JSON.parse(await fs.readFile(new URL('../source/live2d/waifu-tips.json', import.meta.url), 'utf8')).calendar
const calendar = {
  ...tips,
  solarTermEve: 'termEve',
  holiday: Object.fromEntries(Object.keys(tips.holiday).map(key => [key, key === 'upcoming' ? 'upcoming {days}' : key])),
  solarTerms: Object.fromEntries(Object.entries(tips.solarTerms).map(([key, term]) => [key, { name: term.name, text: 'term' }]))
}
const at = date => new Date(date.includes('T') ? date : `${date}T12:00:00+08:00`)
let checked = 0
const expect = (date, message, name, list = days) => {
  const tip = selectCalendarTip(calendar, list, at(date))
  assert.deepEqual(tip && [tip.message, tip.name], message && [message, name], date)
  checked++
}

for (const [date, message, name] of [
  ['2026-01-01', 'first', '元旦'], ['2026-01-02', 'day', '元旦'], ['2026-01-03', 'last', '元旦'],
  ['2026-01-04', 'workday', '元旦'], ['2026-02-12', 'upcoming 3', '春节'], ['2026-02-13', 'workdayEve', '春节'],
  ['2026-02-14', 'workday', '春节'], ['2026-02-15', 'first', '春节'], ['2026-02-23', 'last', '春节'],
  ['2026-02-27', 'workdayEve', '春节'], ['2026-02-28', 'workday', '春节'], ['2026-04-03', 'eve', '清明节'],
  // A holiday outranks the solar term sharing its date.
  ['2026-04-05', 'day', '清明节'], ['2026-09-24', 'eve', '中秋节'], ['2026-09-27', 'last', '中秋节'],
  ['2026-09-30', 'eve', '国庆节'], ['2026-10-07', 'last', '国庆节'], ['2026-10-08', 'term', '寒露'],
  ['2026-10-09', 'workdayEve', '国庆节'], ['2026-11-06', 'termEve', '立冬'], ['2026-11-07', 'term', '立冬'],
  ['2026-10-31', undefined], ['2026-12-21', 'termEve', '冬至'], ['2026-12-22', 'term', '冬至']
]) expect(date, message, name)

// Solar terms need no network data; holidays simply drop out.
expect('2026-02-04', 'term', '立春', [])
expect('2026-02-12', undefined, undefined, [])
// Civil-day boundaries follow the configured zone, not the visitor's clock.
expect('2026-01-03T23:30:00+08:00', 'last', '元旦')
expect('2026-01-03T16:30:00Z', 'workday', '元旦')
// Outside the solar-term table nothing is extrapolated.
expect('2051-02-04', undefined, undefined, [])

assert.deepEqual(calendarYears(at('2026-12-05'), calendar), [2026, 2027])
assert.deepEqual(calendarYears(at('2026-11-30'), calendar), [2026])
assert.deepEqual(calendarYears(at('2026-12-31T16:30:00Z'), calendar), [2027])
assert.equal(Object.keys(tips.solarTerms).length, 24)
console.log(`live2d calendar: ${checked + 4} checks passed`)
