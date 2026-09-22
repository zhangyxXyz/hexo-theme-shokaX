import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { load } from 'js-yaml'

const root = fileURLToPath(new URL('../', import.meta.url))
const bundle = await build({
  stdin: {
    contents: "export * from './source/js/_app/components/festival/calendar'; export * from './source/js/_app/components/festival/solar-terms'",
    resolveDir: root, loader: 'ts'
  },
  bundle: true, write: false, format: 'esm', platform: 'node'
})
const { selectFestival, solarTermDate, solarTerms, solarTermStartYear, solarTermEndYear } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const defaults = load(await fs.readFile(new URL('../_festivals.yml', import.meta.url), 'utf8'))
const dayMs = 86400000
let checked = 0
const options = table => ({ enable: true, theme: 'auto', table })
const at = date => new Date(date.includes('T') ? date : `${date}T12:00:00+08:00`)
const expect = (date, scene, table = defaults, overrides = {}) => {
  assert.equal(selectFestival({ ...options(table), ...overrides }, at(date)), scene, `${date} -> ${scene}`)
  checked++
}
const only = (name, overrides = {}) => ({
  timezone: 'Asia/Shanghai', priority: [name],
  items: { daily: { enable: true }, [name]: { ...defaults.items[name], ...overrides } }
})

// Existing festival anchors/windows, plus each newly supported lunar festival.
for (const [date, scene] of [
  ['2026-02-09', 'daily'], ['2026-02-10', 'spring'], ['2026-02-16', 'spring'],
  ['2026-02-17', 'spring'], ['2026-02-18', 'spring'], ['2026-02-28', 'spring'],
  ['2026-03-01', 'lantern'], ['2026-03-02', 'lantern'], ['2026-03-03', 'lantern'],
  ['2026-03-04', 'daily'], ['2026-06-15', 'daily'], ['2026-06-16', 'dragon_boat'],
  ['2026-06-19', 'dragon_boat'], ['2026-06-21', 'dragon_boat'], ['2026-06-22', 'xiazhi'],
  ['2026-08-17', 'daily'], ['2026-08-18', 'qixi'], ['2026-08-19', 'qixi'],
  ['2026-08-20', 'qixi'], ['2026-08-21', 'daily'], ['2026-09-17', 'daily'],
  ['2026-09-18', 'mid_autumn'], ['2026-09-23', 'mid_autumn'], ['2026-09-25', 'mid_autumn'],
  ['2026-09-28', 'mid_autumn'], ['2026-09-29', 'daily'], ['2026-10-16', 'daily'],
  ['2026-10-17', 'chongyang'], ['2026-10-18', 'chongyang'], ['2026-10-19', 'chongyang'],
  ['2026-10-20', 'daily'], ['2026-01-24', 'daily'], ['2026-01-25', 'laba'],
  ['2026-01-26', 'laba'], ['2026-01-27', 'laba'], ['2026-01-28', 'daily'],
  ['2026-12-21', 'daily'], ['2026-12-22', 'dongzhi'], ['2026-12-23', 'dongzhi'],
  ['2026-12-24', 'daily']
]) expect(date, scene)

// Published HKO 2026 fixtures in chronological order, independent of packed data.
const dates2026 = [
  '01-05', '01-20', '02-04', '02-18', '03-05', '03-20',
  '04-05', '04-20', '05-05', '05-21', '06-05', '06-21',
  '07-07', '07-23', '08-07', '08-23', '09-07', '09-23',
  '10-08', '10-23', '11-07', '11-22', '12-07', '12-22'
]
assert.equal(new Set(solarTerms).size, 24)
for (const [i, name] of solarTerms.entries()) {
  const date = at(`2026-${dates2026[i]}`)
  const [month, day] = dates2026[i].split('-').map(Number)
  assert.deepEqual(solarTermDate(2026, name), { month, day })
  for (const delta of [-1, 0, 1, 2]) {
    expect(new Date(+date + delta * dayMs).toISOString(), delta === 0 || delta === 1 ? name : 'daily', only(name))
  }
}

// All 744 stored dates are valid, ordered and schedulable, including leap years.
for (let year = solarTermStartYear; year <= solarTermEndYear; year++) {
  let previous = 0
  for (const [i, name] of solarTerms.entries()) {
    const date = solarTermDate(year, name)
    assert.equal(date.month, Math.floor(i / 2) + 1)
    assert.ok(Number.isInteger(date.day) && date.day >= 1 && date.day <= 31)
    const instant = Date.UTC(year, date.month - 1, date.day, 4)
    assert.equal(new Date(instant).getUTCMonth() + 1, date.month)
    assert.ok(instant > previous)
    previous = instant
    expect(new Date(instant).toISOString(), name, only(name))
  }
}

// Variable official dates catch accidentally replacing the table with fixed days.
assert.deepEqual(solarTermDate(2024, 'qingming'), { month: 4, day: 4 })
assert.deepEqual(solarTermDate(2026, 'qingming'), { month: 4, day: 5 })
assert.deepEqual(solarTermDate(2025, 'lichun'), { month: 2, day: 3 })
assert.deepEqual(solarTermDate(2026, 'lichun'), { month: 2, day: 4 })
assert.deepEqual(solarTermDate(2024, 'daxue'), { month: 12, day: 6 })
assert.deepEqual(solarTermDate(2026, 'daxue'), { month: 12, day: 7 })
assert.deepEqual(solarTermDate(2025, 'dongzhi'), { month: 12, day: 21 })
assert.deepEqual(solarTermDate(2026, 'dongzhi'), { month: 12, day: 22 })
assert.deepEqual(solarTermDate(2049, 'dahan'), { month: 1, day: 19 })
assert.deepEqual(solarTermDate(2050, 'dahan'), { month: 1, day: 20 })

// Shanghai midnight, window closing midnight and configured civil timezone.
expect('2026-09-17T15:59:59.999Z', 'daily')
expect('2026-09-17T16:00:00.000Z', 'mid_autumn')
expect('2026-04-04T15:59:59.999Z', 'daily', only('qingming'))
expect('2026-04-04T16:00:00.000Z', 'qingming', only('qingming'))
expect('2026-04-06T15:59:59.999Z', 'qingming', only('qingming'))
expect('2026-04-06T16:00:00.000Z', 'daily', only('qingming'))
expect('2026-04-04T16:00:00.000Z', 'daily', { ...only('qingming'), timezone: 'UTC' })
expect('2026-04-05T00:00:00.000Z', 'qingming', { ...only('qingming'), timezone: 'UTC' })

// Adjacent-year lookup, including data range edges; unsupported term years skip.
expect('2025-12-25', 'daily', only('xiaohan', { before: 10 }))
expect('2025-12-26', 'xiaohan', only('xiaohan', { before: 10 }))
expect('2027-01-01', 'dongzhi', only('dongzhi', { after: 15 }))
expect('2019-12-27', 'xiaohan', only('xiaohan', { before: 10 }))
for (const year of [2019, 2051]) {
  assert.equal(solarTermDate(year, 'qingming'), undefined)
  expect(`${year}-04-05`, 'daily', only('qingming'))
}
assert.equal(solarTermDate(NaN, 'qingming'), undefined)
assert.equal(solarTermDate(2026.5, 'qingming'), undefined)
assert.equal(solarTermDate(2026, 'unknown'), undefined)

// Priorities, disabling, explicit previews and compatibility with old tables.
const noLantern = structuredClone(defaults)
noLantern.items.lantern.enable = false
expect('2026-03-03', 'spring', noLantern)
const noAutumn = structuredClone(defaults)
noAutumn.items.mid_autumn.enable = false
expect('2026-09-23', 'qiufen', noAutumn)
expect('2026-09-23', 'qiufen', { ...defaults, priority: ['qiufen', 'mid_autumn'] })
expect('2026-04-05', 'daily', { ...defaults, priority: ['spring', 'dragon_boat', 'mid_autumn'] })
expect('2026-04-05', 'qingming', { ...defaults, priority: undefined })
expect('2026-04-05', 'none', defaults, { enable: false })
expect('2026-04-05', 'none', defaults, { theme: 'none' })
expect('2019-10-01', 'qingming', defaults, { theme: 'qingming' })
expect('2026-04-05', 'spring', defaults, { theme: 'spring' })
expect('2026-04-05', 'none', noLantern, { theme: 'lantern' })
expect('2026-04-05', 'daily', defaults, { theme: 'daily' })
expect('2026-04-05', 'qingming', defaults, { theme: 'unknown' })
expect('2026-04-05', 'daily', only('qingming', { enable: false }))
expect('2026-04-07', 'none', { ...only('qingming'), items: { daily: { enable: false } } })
expect('invalid', 'daily')
expect('2026-04-05', 'daily', { ...defaults, timezone: 'Invalid/Timezone' })

// Gregorian rules retain bounded windows and do not depend on lunar support.
const newYear = only('spring', { calendar: 'solar', month: 1, day: 1, before: 45, after: 45 })
expect('2026-12-01', 'daily', newYear)
expect('2026-12-02', 'spring', newYear)
expect('2027-01-31', 'spring', newYear)
expect('2027-02-01', 'daily', newYear)
expect('2026-01-02', 'daily', only('spring', { calendar: 'solar', month: 1, day: 1, before: -1, after: NaN }))
expect('2009-05-28', 'dragon_boat', only('dragon_boat', { before: 0, after: 0 }))
expect('2009-06-27', 'daily', only('dragon_boat', { before: 0, after: 0 })) // Leap fifth month.

const nativeDateTimeFormat = Intl.DateTimeFormat
for (const failure of ['throw', 'gregorian', 'format']) {
  try {
    Intl.DateTimeFormat = function (locale, config) {
      if (String(locale).includes('ca-chinese')) {
        if (failure === 'throw') throw new RangeError('Chinese calendar unavailable')
        if (failure === 'gregorian') return new nativeDateTimeFormat('en-US', config)
        return { resolvedOptions: () => ({ calendar: 'chinese' }), formatToParts: () => { throw new RangeError('Unsupported date') } }
      }
      return new nativeDateTimeFormat(locale, config)
    }
    expect('2026-02-17', 'daily')
    expect('2026-02-18', 'yushui')
    expect('2026-04-05', 'qingming')
    expect('2026-10-01', 'spring', only('spring', { calendar: 'solar', month: 10, day: 1, before: 0, after: 0 }))
    expect('2051-10-01', 'spring', only('spring', { calendar: 'solar', month: 10, day: 1, before: 0, after: 0 }))
  } finally {
    Intl.DateTimeFormat = nativeDateTimeFormat
  }
}

if (process.argv.includes('--verify-source')) {
  const sourceNames = '小寒 大寒 立春 雨水 驚蟄 春分 清明 穀雨 立夏 小滿 芒種 夏至 小暑 大暑 立秋 處暑 白露 秋分 寒露 霜降 立冬 小雪 大雪 冬至'.split(' ')
  for (let year = solarTermStartYear; year <= solarTermEndYear; year++) {
    const url = `https://www.hko.gov.hk/tc/gts/time/calendar/text/files/T${year}c.txt`
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
    assert.ok(response.ok, `${url}: HTTP ${response.status}`)
    const rows = (await response.text()).split(/\r?\n/).filter(line =>
      /\d{4}年\d+月\d+日/.test(line) && sourceNames.some(name => line.trimEnd().endsWith(name)))
    assert.equal(rows.length, 24, `${year}: all official term rows required`)
    for (const [i, row] of rows.entries()) {
      const [, sourceYear, month, day] = row.match(/(\d{4})年(\d+)月(\d+)日/)
      assert.equal(Number(sourceYear), year)
      assert.ok(row.trimEnd().endsWith(sourceNames[i]), `${year}: term order`)
      assert.deepEqual(solarTermDate(year, solarTerms[i]), { month: Number(month), day: Number(day) }, `${year}: ${sourceNames[i]}`)
    }
  }
  console.log('HKO live source verification: all 744 dates match.')
}

console.log(`Festival calendar: ${checked} scene checks passed; 744 term dates, lunar/solar windows, priorities, midnight, leap months and Intl fallbacks verified.`)
