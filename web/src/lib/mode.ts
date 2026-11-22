/**
 * Which build this is, and where it is served. The local app reads data its own server builds. The hosted site reads
 * each visitor's replays, kept in their browser, or a fixed demo library.
 */
export const hosted = import.meta.env.VITE_HOSTED === '1'

/** '/' for the local app. The hosted app lives under '/app/' because the site root is a separate static page. */
export const base = import.meta.env.BASE_URL

/** The demo is this same app mounted one level deeper, so every link inside it stays inside the demo. */
const demoRoot = `${base}demo`
export const demo = hosted && typeof location !== 'undefined' && (location.pathname === demoRoot || location.pathname.startsWith(`${demoRoot}/`))

/** Where the router mounts the app. */
export const basepath = (demo ? demoRoot : base).replace(/(?<=.)\/$/, '')
