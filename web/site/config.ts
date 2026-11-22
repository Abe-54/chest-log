export type IsoDate = `${number}-${number}-${number}`

export const SITE = {
  name: 'Chest Log',
  origin: (process.env.SITE_ORIGIN ?? 'https://chestcounter.vercel.app').replace(/\/$/, ''),
  repo: 'https://github.com/Abe-54/chest-log',
  disclaimer: 'Not affiliated with or endorsed by Epic Games. Fortnite is a trademark of Epic Games, Inc.',
  app: { home: '/app/', track: '/app/track', demo: '/app/demo' },
  demosPath: '%LOCALAPPDATA%\\FortniteGame\\Saved\\Demos',
  ogImage: { path: '/og.png', width: 1200, height: 630, alt: 'Chest Log. Every chest, every match, replayed on the map.' },
  logoPath: '/logo.png',
} as const

export const CHECKED: IsoDate = '2026-11-22'
