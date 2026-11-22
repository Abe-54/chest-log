import { cn } from '~/lib/cn'

/** A gold rounded diamond with an ink diamond inside. Original art, drawn here. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden className={cn('shrink-0', className)}>
      <rect x="6" y="6" width="28" height="28" rx="6" transform="rotate(45 20 20)" fill="var(--color-gold)" />
      <rect x="15.25" y="15.25" width="9.5" height="9.5" rx="1.5" transform="rotate(45 20 20)" fill="var(--color-ink)" />
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <LogoMark className="size-9 lg:size-11" />
      <span className="display text-[22px] leading-none lg:text-[26px]">Chest Log</span>
    </span>
  )
}

export type Glyph = 'diamond' | 'circle' | 'square'

/** Tab bar icons: gold-filled when active, a dim outline otherwise. */
export function TabGlyph({ shape }: { shape: Glyph }) {
  const paint = 'fill-transparent stroke-dim stroke-2 group-data-[status=active]:fill-gold group-data-[status=active]:stroke-gold'
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-[22px] overflow-visible">
      {shape === 'diamond' && <rect x="5" y="5" width="14" height="14" rx="3" transform="rotate(45 12 12)" className={paint} />}
      {shape === 'circle' && <circle cx="12" cy="12" r="9" className={paint} />}
      {shape === 'square' && <rect x="3.5" y="3.5" width="17" height="17" rx="4" className={paint} />}
    </svg>
  )
}

export const DISCLAIMER = 'Not affiliated with or endorsed by Epic Games. Fortnite is a trademark of Epic Games, Inc.'
