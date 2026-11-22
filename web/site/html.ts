import type { IsoDate } from './config.ts'
import { SOURCES, type SourceId } from './sources.ts'

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export const esc = (text: string) => text.replace(/[&<>"']/g, ch => ESCAPES[ch]!)

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' }

export const plainText = (html: string) =>
  html
    .replace(/<\/?(?:a|code|strong|em|b|i|span|sup|sub|wbr)\b[^>]*>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&([a-z0-9#]+);/gi, (whole, name: string) => ENTITIES[name] ?? whole)
    .replace(/\s+/g, ' ')
    .trim()

export const longDate = (iso: IsoDate) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))

export const shortDate = (iso: IsoDate) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))

export const pathCode = (path: string) => `<code>${esc(path).replaceAll('\\', '\\<wbr>')}</code>`

export const link = (href: string, text: string) => `<a href="${esc(href)}">${text}</a>`

export const sourceLink = (id: SourceId, text?: string) => {
  const source = SOURCES[id]
  return `<a href="${esc(source.url)}" rel="noopener">${text ?? esc(source.label)}</a>`
}

export const cite = (...ids: SourceId[]) => {
  const items = ids.map(id => {
    const source = SOURCES[id]
    return `${sourceLink(id)}, ${esc(source.publisher)}, checked ${longDate(source.checked)}`
  })
  return `<p class="source">Source${ids.length > 1 ? 's' : ''}. ${items.join('; ')}.</p>`
}

type TableSpec = { caption: string; head: string[]; rows: string[][]; numeric?: number[]; bodyId?: string }

export const table = ({ caption, head, rows, numeric = [], bodyId }: TableSpec) => {
  const cell = (tag: 'th' | 'td', value: string, at: number) =>
    `<${tag}${numeric.includes(at) ? ' class="num"' : ''}${tag === 'th' ? ' scope="col"' : ''}>${value}</${tag}>`
  const body = rows
    .map(row => `<tr>${row.map((value, at) => (at === 0 ? `<th scope="row">${value}</th>` : cell('td', value, at))).join('')}</tr>`)
    .join('')
  return `<div class="table-wrap" role="region" aria-label="${esc(caption)}" tabindex="0"><table><caption>${esc(caption)}</caption><thead><tr>${head.map((value, at) => cell('th', value, at)).join('')}</tr></thead><tbody${bodyId ? ` id="${bodyId}" aria-live="polite"` : ''}>${body}</tbody></table></div>`
}

export const steps = (items: { title: string; body: string }[]) =>
  `<ol class="steps">${items.map(item => `<li><h3>${item.title}</h3><p>${item.body}</p></li>`).join('')}</ol>`
