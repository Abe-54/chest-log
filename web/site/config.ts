export type IsoDate = `${number}-${number}-${number}`

export const SITE = {
  name: 'Chest Log',
  origin: (process.env.SITE_ORIGIN ?? 'https://fortnite-chestcounter.vercel.app').replace(/\/$/, ''),
  repo: 'https://github.com/Abe-54/chest-log',
  disclaimer: 'Not affiliated with or endorsed by Epic Games. Fortnite is a trademark of Epic Games, Inc.',
  app: { home: '/app/', track: '/app/track', demo: '/app/demo' },
  demosPath: '%LOCALAPPDATA%\\FortniteGame\\Saved\\Demos',
  ogImage: { path: '/og.png', width: 1200, height: 630, alt: 'Chest Log. Every chest, every match, replayed on the map.' },
  logoPath: '/logo.png',
  // Search Console's HTML-tag check: the content value of the tag it hands out, set in Vercel's environment.
  googleVerification: process.env.GOOGLE_SITE_VERIFICATION ?? null,
  // IndexNow proves site ownership with a public key served at /<key>.txt, so it is not a secret.
  indexNowKey: '6d50cfe8fb0d008302faffa1d3693304',
  // Search Console ownership file for the URL-prefix property. Removing it unverifies the site.
  googleVerificationFile: 'googlead448a3a9208227b.html',
} as const

export const CHECKED: IsoDate = '2026-11-22'
