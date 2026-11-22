import { SITE } from '../config.ts'
import type { Page } from '../types.ts'
import { link, pathCode, steps } from '../html.ts'

const source = `${SITE.repo}/tree/main/companion`
const releases = `${SITE.repo}/releases`
const download = `${SITE.repo}/releases/latest/download/ChestLogCompanion.exe`

export const companion: Page = {
  slug: 'companion',
  type: 'guide',
  label: 'Companion app',
  title: 'Chest Log Companion: Count Fortnite Chests Automatically',
  description: 'A small, open-source Windows app that hands your Fortnite replays to Chest Log as each match ends. What it reads, why it exists, and how to check it.',
  h1: 'Chest Log Companion',
  lede: `<p>A small, free Windows app that lets Chest Log count every match as soon as it ends, without picking your replay folder each time. It reads one folder, talks only to Chest Log on your own PC, and its code is public.</p>`,
  ctas: [
    { label: 'Download for Windows', href: download, kind: 'primary' },
    { label: 'Read the code', href: source, kind: 'secondary' },
  ],
  published: '2026-11-22',
  updated: '2026-11-22',
  breadcrumbs: [],
  sections: [
    {
      id: 'why',
      heading: 'Why Chest Log needs it',
      html: `<p>Fortnite saves replays in ${pathCode(SITE.demosPath)}. That folder is inside AppData, and Chrome and Edge do not let any website keep access to AppData. If a site asks, Chrome answers that it "can't open this folder because it contains system files".</p><p>A website can still read the folder once when you pick it, which is how Chest Log works without the companion. But counting each match as it ends needs something on your PC that can read the folder by itself. That is all the companion does.</p>`,
    },
    {
      id: 'what',
      heading: 'What it does, exactly',
      html: `<ul>
<li>It lists the <code>.replay</code> files in your Demos folder and hands them to Chest Log when the Chest Log page asks.</li>
<li>It only answers on <code>127.0.0.1</code>, an address that never leaves your PC. Other computers cannot reach it.</li>
<li>It only answers Chest Log's own web pages. Your browser refuses to let any other site read its replies.</li>
<li>It never uploads anything. Your browser reads the replays, exactly as when you pick the folder yourself.</li>
<li>It never changes, moves or deletes a replay. It reads no other folder.</li>
<li>It needs no administrator rights and installs nothing else. It starts with Windows so it is ready when you play, and you can switch that off from its tray icon.</li>
</ul>`,
    },
    {
      id: 'install',
      heading: 'Set it up',
      html: `${steps([
        { title: 'Download and run it', body: `Get ${link(download, 'ChestLogCompanion.exe')} and open it. It has no installer and runs from wherever you keep it.` },
        { title: 'Get past the Windows warning', body: 'The app is not signed with a paid certificate yet, so Windows SmartScreen may say it protected your PC. Choose More info, then Run anyway. The next section shows how to check the file first.' },
        { title: 'Connect Chest Log', body: `Open ${link(SITE.app.track, 'Chest Log')} and choose Connect. Chrome asks to let the site access other apps and services on this device. Choose Allow, because that is how the page reaches the companion.` },
        { title: 'Play', body: 'Keep the Chest Log tab open. Each match shows up a few seconds after it ends.' },
      ])}`,
    },
    {
      id: 'check',
      heading: 'Check it yourself',
      html: `<p>The companion is about 300 lines of Go. ${link(source, 'Read the source on GitHub')}, including its own README.</p><p>Every download is built from that source by GitHub's servers, not on anyone's computer. Each ${link(releases, 'release')} lists a SHA-256 checksum for every file, and GitHub signs a record of which commit and workflow built it. With the GitHub CLI you can check a download against that record:</p><pre class="formula" tabindex="0"><code>gh attestation verify ChestLogCompanion.exe --repo Abe-54/chest-log</code></pre><p>You can also build it yourself with Go. The steps are in the companion's README.</p>`,
    },
    {
      id: 'remove',
      heading: 'Turn it off or remove it',
      html: `<p>Right-click the Chest Log icon in the tray by the clock. Untick Start with Windows to stop it starting on its own, or choose Quit to stop it now. To remove it, quit it and delete the file. It leaves nothing else behind except the start-with-Windows entry, which unticking removes.</p>`,
    },
    {
      id: 'extension',
      heading: 'Why not a browser extension',
      html: `<p>We looked at an extension first. Chrome only lets an extension read files on your PC after you find it on the extensions page and switch on Allow access to file URLs, which most people never see. That switch also lets it read every file on your computer, a much bigger permission than one folder. The companion asks for less and does not depend on one browser's extension store.</p>`,
    },
  ],
  faq: [],
  related: ['fortnite-replay-files', 'privacy', 'faq'],
}
