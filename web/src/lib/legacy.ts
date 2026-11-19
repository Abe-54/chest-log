const aliases: Record<string, string> = { routes: '/routes', recap: '/wrapped', overview: '/' }

/** Links shared from the first version used hash routes such as #replay?id=X&t=12. */
export function legacyRedirect(hash: string) {
  if (!hash.startsWith('#')) return null
  const [area, query] = hash.slice(1).split('?')
  const params = new URLSearchParams(query)
  const id = params.get('id')
  const t = params.get('t')
  const time = t === null ? '' : `?t=${Number(t).toFixed(1)}`
  if (area === 'replay') return id ? `/matches/${encodeURIComponent(id)}${time}` : '/matches'
  if (area === 'clips') return id ? `/clips/${encodeURIComponent(id)}` : '/clips'
  return aliases[area] ?? null
}
