/** Preserve supplied geography, removing only adjacent duplicate levels. */
export function formatCommentRegion(raw: string, template: string): string {
  const levels: string[] = []
  const municipality = (value: string) => value.replace(/^(北京|天津|上海|重庆|重慶)市?$/u, '$1')
  for (const level of raw.trim().split(/[\s,，/|>]+/u).filter(Boolean)) {
    const previous = levels.at(-1)
    if (previous && municipality(previous) === municipality(level)) {
      if (level.length > previous.length) levels[levels.length - 1] = level
    } else levels.push(level)
  }
  return levels.length ? template.replace('{region}', () => levels.join(' ')) : ''
}
