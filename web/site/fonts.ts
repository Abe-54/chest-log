import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export type FontFace = { family: string; weight: number; style: 'normal' | 'italic'; file: string; preload?: boolean }

/** Latin subsets copied from Fontsource 5.3.0 into assets/fonts. All three families are SIL OFL 1.1, licenses alongside. */
export const FONTS: readonly FontFace[] = [
  { family: 'Barlow Condensed', weight: 900, style: 'italic', file: 'barlow-condensed-latin-900-italic.woff2', preload: true },
  { family: 'Barlow Condensed', weight: 800, style: 'italic', file: 'barlow-condensed-latin-800-italic.woff2' },
  { family: 'Barlow', weight: 400, style: 'normal', file: 'barlow-latin-400-normal.woff2' },
  { family: 'Barlow', weight: 500, style: 'normal', file: 'barlow-latin-500-normal.woff2', preload: true },
  { family: 'Barlow', weight: 600, style: 'normal', file: 'barlow-latin-600-normal.woff2' },
  { family: 'Barlow', weight: 700, style: 'normal', file: 'barlow-latin-700-normal.woff2', preload: true },
  { family: 'Barlow', weight: 800, style: 'normal', file: 'barlow-latin-800-normal.woff2' },
  { family: 'JetBrains Mono', weight: 500, style: 'normal', file: 'jetbrains-mono-latin-500-normal.woff2' },
]

export const fontPath = (face: FontFace) => join(dirname(fileURLToPath(import.meta.url)), 'assets', 'fonts', face.file)

/** font-display optional plus preloading the above-the-fold faces keeps layout shift at zero. */
export const fontFaceCss = (urlOf: (face: FontFace) => string) =>
  FONTS.map(
    face =>
      `@font-face{font-family:'${face.family}';font-style:${face.style};font-weight:${face.weight};font-display:optional;src:url(${urlOf(face)}) format('woff2')}`,
  ).join('\n')
