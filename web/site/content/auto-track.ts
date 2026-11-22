import { SITE } from '../config.ts'
import type { Page } from '../types.ts'
import { link, pathCode, steps } from '../html.ts'
import { FAQ_POOL } from './faq-pool.ts'

export const autoTrack: Page = {
  slug: 'auto-track',
  type: 'landing',
  label: 'Auto-track',
  title: 'Fortnite Chest Tracker That Counts Matches Automatically',
  description: 'Pick your Fortnite replay folder once. Chest Log rechecks it every 30 seconds in Chrome or Edge and adds each new match to your chest count.',
  h1: 'Auto-track your Fortnite chests',
  lede: `<p>Pick your replay folder once. Chest Log rechecks it every 30 seconds while the tab is open and adds each new match to your count.</p>`,
  ctas: [
    { label: 'Count my chests', href: SITE.app.track, kind: 'primary' },
    { label: 'Try the demo', href: SITE.app.demo, kind: 'secondary' },
  ],
  published: '2026-11-22',
  updated: '2026-11-22',
  breadcrumbs: [],
  sections: [
    {
      id: 'how',
      heading: 'How Auto-track works',
      html: steps([
        { title: 'Move the replay folder once', body: `Chrome and Edge do not let websites watch folders inside AppData, where Fortnite saves replays. Chest Log gives you two commands that move ${pathCode(SITE.demosPath)} out of AppData and leave a link in its place, so Fortnite keeps saving to the same path.` },
        { title: 'Pick the moved folder', body: 'Choose it on the Auto-track page. Chrome and Edge remember it.' },
        { title: 'Leave the tab open', body: 'Keep the Chest Log tab open while you play. Every 30 seconds it checks the folder for new replay files.' },
        { title: 'Watch the count grow', body: 'New matches are read and added to your total. You do not import anything by hand.' },
      ]),
    },
    {
      id: 'needs',
      heading: 'What you need',
      html: `<ul>
<li>Chrome or Edge on the PC where you play Fortnite.</li>
<li>Replays turned on in Fortnite. ${link('/fortnite-replay-files/', 'How to turn them on')}.</li>
<li>The Chest Log tab open.</li>
</ul><p>If you skip the move, Chrome says it "can't open this folder because it contains system files". Counting still works without it: choose the Demos folder after you play and Chest Log reads every replay in it.</p><p>The browser may ask you to allow access to the folder when you open the tab. That prompt comes from the browser, and Chest Log only asks for permission to read.</p>`,
    },
    {
      id: 'other-browsers',
      heading: 'Other browsers',
      html: `<p>Firefox and Safari do not let a web page remember a folder, at the time of writing. You can still import replay files in them, but you choose the files each time and there is no Auto-track. If Chest Log does not offer to remember a folder, your browser does not support it.</p>`,
    },
    {
      id: 'background-tabs',
      heading: 'Background tabs',
      html: `<p>Browsers slow down timers in tabs you are not looking at, so a check can run late when the Chest Log tab sits in the background for a long time. Your replay files are not lost. The next check picks up everything new.</p>`,
    },
    {
      id: 'private',
      heading: 'Everything stays on your computer',
      html: `<p>The folder check and the replay reading both happen in your browser. Nothing is uploaded and there is no account. ${link('/privacy/', 'Read the privacy details')}.</p>`,
    },
  ],
  faq: [
    {
      q: 'Do I need to keep the tab open?',
      a: `Yes. Auto-track runs inside the Chest Log tab, so it stops when you close the tab. Open it again and Chest Log reads any replays it missed.`,
    },
    {
      q: 'Why only Chrome and Edge?',
      a: `Auto-track needs a browser that lets a page remember a folder on your computer. Chrome and Edge do. Firefox and Safari did not when this page was written.`,
    },
    {
      q: 'Does Auto-track upload my replays?',
      a: `No. The browser reads the replay files on your computer and Chest Log stores the results there. Nothing is sent to a server.`,
    },
    FAQ_POOL.where,
  ],
  related: ['fortnite-replay-files', 'privacy', 'treasure-hunters-odds', 'faq'],
}
