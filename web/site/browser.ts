import { chromium } from 'playwright'

/** Playwright's own Chromium when it is installed, otherwise the Chrome on this machine. */
export const launchBrowser = () => chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }))
