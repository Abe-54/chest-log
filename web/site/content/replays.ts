import { SITE } from '../config.ts'
import type { Page } from '../types.ts'
import { cite, link, pathCode, steps } from '../html.ts'
import { FAQ_POOL } from './faq-pool.ts'

export const replays: Page = {
  slug: 'fortnite-replay-files',
  type: 'guide',
  label: 'Replay files',
  title: 'Where Are Fortnite Replay Files? Find the Demos Folder',
  description: `Fortnite saves replays on PC in ${SITE.demosPath}. Turn replays on, open the folder, then point Chest Log at it.`,
  h1: 'Where are Fortnite replay files?',
  lede: `<p>Fortnite saves a replay file for each match you play on PC. Chest Log counts your chests from those files, so the first job is finding them and making sure Fortnite is saving them.</p>`,
  ctas: [{ label: 'Count my chests', href: SITE.app.track, kind: 'primary' }],
  published: '2026-11-22',
  updated: '2026-11-22',
  breadcrumbs: [],
  sections: [
    {
      id: 'folder',
      heading: 'The replay folder',
      html: `<p>On a Windows PC, Fortnite saves replay files in this folder.</p><pre class="path" tabindex="0"><code>${SITE.demosPath}</code></pre><p>Paste it into the address bar of File Explorer and press Enter. <code>%LOCALAPPDATA%</code> is a Windows shortcut for <code>C:\\Users\\your name\\AppData\\Local</code>, so the path works on every account. Each match is one file that ends in <code>.replay</code>.</p><p>The Epic help articles we read do not name the folder. This is where Fortnite on PC writes its replay files.</p>`,
    },
    {
      id: 'turn-on',
      heading: 'Turn replays on',
      html: `${steps([
        { title: 'Open Settings', body: 'In Fortnite, open the main menu and choose Settings.' },
        { title: 'Go to the Game tab', body: 'Scroll all the way down to the Replays group.' },
        { title: 'Turn recording on', body: 'Fortnite saves replays for matches you play after the switch is on. It cannot recover earlier matches.' },
      ])}<p>To watch a replay in the game, open Career, then Replays, pick a replay and choose Play.</p>${cite('epic-replays', 'epic-play-replays')}`,
    },
    {
      id: 'platform',
      heading: 'PC only',
      html: `<p>Epic says replays are available on PC, PlayStation and Xbox, and not in Save the World. Chest Log needs the files themselves, and only the PC keeps them in a folder you can open. On a console or phone there is nothing to import.</p>${cite('epic-replays')}`,
    },
    {
      id: 'how-long',
      heading: 'How long replays last',
      html: `<p>Epic says you can only play a replay in the version of Fortnite that recorded it. After an update, older replays stop being valid unless you saved them. You save a replay by renaming it in the replay browser.</p><p>On PC, Epic says the number of saved replays is unlimited. PlayStation and Xbox allow 10. A replay of a full match is about 10 MB.</p><p>We could not find how many unsaved replays Fortnite keeps on PC or when it clears them. Import your matches soon after you play, and before the next game update. ${link('/auto-track/', 'Auto-track')} does that for you while a tab is open.</p>${cite('epic-replays')}`,
    },
    {
      id: 'use-chest-log',
      heading: 'Point Chest Log at the folder',
      html: `${steps([
        { title: 'Open Chest Log', body: `On your PC, choose ${link(SITE.app.track, 'Count my chests')} and pick your replay folder.` },
        { title: 'Open the Demos folder', body: `In the window that opens, paste ${pathCode(SITE.demosPath)} into the address bar, press Enter, then select the folder.` },
        { title: 'Wait for the import', body: 'Chest Log takes about two seconds for each replay file. Keep the tab open while it works.' },
      ])}<p>Chrome and Edge remember the folder. In other browsers you can pick the files or drop the folder onto the page each time.</p>`,
    },
    {
      id: 'contents',
      heading: 'What is inside a replay file',
      html: `<p>A replay records a whole match, including the names of the other players. Chest Log reads the files in your browser and does not upload them. Keep that in mind before you share a replay file with anyone. ${link('/privacy/', 'Chest Log privacy details')}.</p>`,
    },
  ],
  faq: [
    FAQ_POOL.where,
    FAQ_POOL.turnOn,
    FAQ_POOL.platform,
    {
      q: 'How many replays does Fortnite keep?',
      a: `Epic says PC can keep an unlimited number of saved replays and that replays from an older game version stop being valid after an update unless you saved them. We could not find a limit for unsaved replays.`,
    },
  ],
  related: ['auto-track', 'treasure-hunters-odds', 'privacy', 'faq'],
}
