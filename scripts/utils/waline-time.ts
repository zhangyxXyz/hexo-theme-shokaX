import fs from 'node:fs/promises'
import type { Plugin } from 'esbuild'
import { adaptWalinePreview } from './waline-preview'

// Waline 3.15.2 has no public date formatter hook. Adapt its pinned bundle at
// build time, keeping native timestamps, locale strings and reactive updates.
export function adaptWalineTime(source: string, days: number): string {
  // Both full and slim expose the same formatter with different minified names.
  const matches = [...source.matchAll(/a<8\?`\$\{a\} \$\{n\.days\}`:([\w$]+)\(r\)/g)]
  const cutoff = matches[0]?.[0]
  const absolute = matches[0]?.[1]
  const sameDay = 'if(a===0){let e=i%(24*3600*1e3)'
  if (matches.length !== 1 || source.split(sameDay).length !== 2) {
    throw new Error('Waline time adapter expects @waline/client 3.15.2; review it before upgrading the client.')
  }
  return source
    .replace(cutoff, `a<${days}?\`\${a} \${n.days}\`:${absolute}(r)`)
    .replace(sameDay, `${days === 0 ? `return ${absolute}(r);` : ''}${sameDay}`)
}

export function walineTimePlugin(value: unknown): Plugin {
  const days = value ?? 60
  if (typeof days !== 'number' || !Number.isSafeInteger(days) || days < 0) {
    throw new Error('waline.relativeTimeDays must be a non-negative integer')
  }
  return {
    name: 'shokax-waline-relative-time',
    setup(build) {
      let applied = false
      build.onLoad({ filter: /[\\/]@waline[\\/]client[\\/]dist[\\/](?:waline|slim)\.js$/ }, async ({ path }) => {
        const contents = adaptWalinePreview(adaptWalineTime(await fs.readFile(path, 'utf8'), days))
        applied = true
        return { contents, loader: 'js' }
      })
      build.onEnd(result => {
        if (!applied && !result.errors.length) return { errors: [{ text: 'Waline time adapter did not match the client entry; check the resolved bundle.' }] }
      })
    }
  }
}
