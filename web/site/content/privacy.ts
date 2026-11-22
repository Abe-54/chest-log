import { SITE } from '../config.ts'
import type { Page } from '../types.ts'
import { link } from '../html.ts'

export const privacy: Page = {
  slug: 'privacy',
  type: 'legal',
  label: 'Privacy',
  title: 'Chest Log Privacy: Replays Never Leave Your Browser',
  description: 'How Chest Log handles your Fortnite replays. They are read in your browser and stored on your device. Nothing is uploaded. Analytics use no cookies.',
  h1: 'Privacy',
  lede: `<p>Chest Log does not upload your replays and has no accounts. This page explains what stays on your computer and the one thing the site measures.</p>`,
  published: '2026-11-22',
  updated: '2026-11-22',
  breadcrumbs: [],
  sections: [
    {
      id: 'replays',
      heading: 'What happens to your replays',
      html: `<p>When you pick your replay folder or files, your browser reads them with a WebAssembly program that Chest Log serves with the page. The reading happens on your computer.</p><p>The results are your match list and your chest counts. They are saved in IndexedDB, which is storage built into your browser and tied to this site. They are not sent anywhere. In Chrome and Edge, the browser also remembers the folder you picked so Chest Log can recheck it.</p>`,
    },
    {
      id: 'names',
      heading: 'What a replay file contains',
      html: `<p>A replay records a whole match, including the names of the other players. The match data Chest Log stores in your browser can include those names. It stays in your browser. Chest Log reads your replay files without changing them.</p>`,
    },
    {
      id: 'analytics',
      heading: 'What the site measures',
      html: `<p>This site uses Vercel Web Analytics to count page views. It sets no cookies. It records things like the page you viewed, the page you came from, and your country, browser and device type. It does not see your replays or your chest counts.</p>`,
    },
    {
      id: 'hosting',
      heading: 'Hosting',
      html: `<p>Chest Log is hosted on Vercel. As with any website, the host receives your IP address and the page you asked for when your browser requests it.</p>`,
    },
    {
      id: 'delete',
      heading: 'Delete your data',
      html: `<p>Clear the site data for this site in your browser settings. That removes the stored match list and the remembered folder. Your replay files stay where they are.</p>`,
    },
    {
      id: 'code',
      heading: 'Check it yourself',
      html: `<p>The code is public on ${link(SITE.repo, 'GitHub')}, including the code that reads replays in your browser.</p>`,
    },
  ],
  faq: [],
  related: ['auto-track', 'fortnite-replay-files', 'faq'],
}
