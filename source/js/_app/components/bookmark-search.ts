// Keep matching independent of the DOM so both bookmark layouts use the same index.
const normalize = (value: string) => value.normalize('NFKC').toLowerCase().trim()

export const bookmarkSearchIndex = (fields: string[]) => fields.map(normalize).filter(Boolean)

// Restricted Damerau–Levenshtein: tolerate missing, extra, or transposed Latin letters.
const nearWord = (query: string, word: string) => {
  const limit = query.length >= 8 ? 2 : 1
  if (Math.abs(query.length - word.length) > limit) return false
  let previous = Array.from({ length: word.length + 1 }, (_, index) => index)
  let beforePrevious = previous
  for (let row = 1; row <= query.length; row++) {
    const current = [row]
    for (let col = 1; col <= word.length; col++) {
      current[col] = Math.min(current[col - 1] + 1, previous[col] + 1,
        previous[col - 1] + Number(query[row - 1] !== word[col - 1]))
      if (row > 1 && col > 1 && query[row - 1] === word[col - 2] && query[row - 2] === word[col - 1]) {
        current[col] = Math.min(current[col], beforePrevious[col - 2] + 1)
      }
    }
    beforePrevious = previous
    previous = current
  }
  return previous[word.length] <= limit
}

export const matchesBookmark = (fields: string[], query: string) => {
  const terms = normalize(query).split(/\s+/).filter(Boolean)
  return terms.every(term => fields.some(field => {
    if (field.includes(term)) return true
    // Short terms and Chinese text must not accidentally match unrelated names.
    if (!/^[a-z]{4,64}$/.test(term)) return false
    return (field.match(/[a-z]+/g) || []).some(word => nearWord(term, word))
  }))
}
