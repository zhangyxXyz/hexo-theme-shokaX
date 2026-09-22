# Festival calendar sources

## Solar terms: Hong Kong Observatory, 2020–2050

`source/js/_app/components/festival/solar-terms.ts` contains the 744 solar-term
civil dates published in the Hong Kong Observatory's annual Gregorian–Lunar
Calendar Conversion Tables, retrieved on 2026-09-22. The annual text tables were
read in full; extraction checked all 24 names, their chronological order, the
year, and the two terms belonging to each Gregorian month in all 31 years.

- [Official calendar index and accuracy notes](https://www.hko.gov.hk/en/gts/time/conversion.htm)
- [Official text-table index](https://www.hko.gov.hk/tc/gts/time/conversion1_text.htm)
- Annual source URL: `https://www.hko.gov.hk/tc/gts/time/calendar/text/files/T{year}c.txt`, with every integer year from 2020 through 2050.
- Examples: [2020](https://www.hko.gov.hk/tc/gts/time/calendar/text/files/T2020c.txt), [2026](https://www.hko.gov.hk/tc/gts/time/calendar/text/files/T2026c.txt), [2050](https://www.hko.gov.hk/tc/gts/time/calendar/text/files/T2050c.txt).
- [HKO solar-term times and UTC+8 convention](https://www.hko.gov.hk/en/gts/astronomy/Solar_Term.htm)

The observations/data are credited to the Hong Kong Observatory. This is a local
date snapshot, not an HKO service integration or endorsement. The HKO warns that
an event close to midnight can change date when its astronomical prediction is
revised; its index specifically discusses the 2021 winter solstice. Retain the
published table value, and recheck official revisions when refreshing this data.

### Encoding and limits

Each year's 48 ASCII digits contain 24 two-digit days, beginning with 小寒、大寒
in January and ending with 大雪、冬至 in December. The month is derived from the
term's position; no lunar date, approximation formula or network request is used
for solar terms. The date payload is 1,488 digits before code/array overhead.

SHA-256 of the 31 encoded strings, in ascending year order, separated by LF with
one final LF:

```text
78fcf16a80d2a26d865ee95aafa021ff5daec62b624f4cbf7f1f1e6fc7e90b8c
```

These are UTC+8 calendar dates, not exact instants of solar longitude crossings.
The default `Asia/Shanghai` schedule turns a decoration on at the beginning of
that civil date and leaves it visible through the next day. Changing `timezone`
changes when that named civil date begins; it does not recalculate astronomical
dates for another region. A display window may cross a Gregorian year boundary.

Outside 2020–2050, a solar term has no date and is skipped. Lunar and fixed
Gregorian holidays still work, followed by `daily`; the code never extrapolates
the table. Explicit `festival.theme` previews still work outside that range.

### Updating and verification

1. Read each required year's official text table; take only dated rows ending
   with one of the 24 term names. Reject a missing/duplicate name, wrong year,
   unexpected order or month. Do not fill gaps with a recurring date pattern.
2. Encode each row's day as two digits in January-to-December order; update the
   year bounds, the snapshot date and this canonical checksum.
3. Check variable dates such as 清明 and 冬至 against that year's official table.
4. Run `node toolbox/test-festival-calendar.mjs` for deterministic calendar and
   boundary tests. Add `--verify-source` on a machine with access to the HKO
   website to compare every stored term against the current official tables.

The optional source verification makes read-only requests and fails explicitly
on unreachable or malformed sources. Ordinary tests work offline.

## Lunar festivals and priority

Lunar festivals retain browser `Intl.DateTimeFormat` Chinese-calendar support.
Only regular lunar months match; a leap month with the same numeric month is
excluded. An unsupported Chinese calendar skips lunar rules while fixed
Gregorian dates and solar terms continue to work.

| Scene | Regular lunar date | Days before / after |
| --- | --- | --- |
| `spring` | 1/1 | 7 / 14 |
| `lantern` | 1/15 | 2 / 0 |
| `dragon_boat` | 5/5 | 3 / 2 |
| `qixi` | 7/7 | 1 / 1 |
| `mid_autumn` | 8/15 | 7 / 3 |
| `chongyang` | 9/9 | 1 / 1 |
| `laba` | 12/8 | 1 / 1 |

The default priority puts these festivals before solar terms, with `lantern`
before `spring`. Thus lunar January 13–15 uses the Lantern Festival scene.
Winter solstice uses the single `dongzhi` solar-term scene. Custom `priority`
retains its original ordering semantics; omitted entries do not run in auto mode.
`calendar: solar` continues to mean a fixed Gregorian month/day, while
`calendar: solar_term` looks up the item key in the official table.
