# Static site

The indexable pages for Chest Log. They are plain HTML and one CSS file, built after the React app by `tsx site/build.ts` and written into `web/dist-hosted/`. The app itself lives under `/app/`.

## Contract with the app build

- The hosted app build must emit into `dist-hosted/app/` (`base: '/app/'`). `vercel.json` rewrites only `/app/*` to `/app/index.html`.
- The pages link to `/app/track` (add replays and auto tracking) and `/app/demo`. Those routes must exist in the app.
- `site/build.ts` replaces `dist-hosted/index.html`. It warns if that file is still the app shell.

## Files

| File | Job |
| --- | --- |
| `pages.ts`, `types.ts` | The page registry and its types. One entry per page. |
| `content/*.ts` | The words. `faq-pool.ts` holds each question once and pages pick from it. |
| `odds.ts` | Epic's per-chest odds and the math the calculator shares with the build. |
| `sources.ts` | Every cited URL with the date it was checked. |
| `template.ts`, `jsonld.ts` | The one HTML template and the structured data. |
| `validate.ts` | Rules the build enforces. Title and description length, links, one h1, JSON-LD, prose. |
| `site.css` | Styles. The token block at the top is the only place with colors, fonts and radii. |
| `build.ts` | Writes pages, `sitemap.xml`, `robots.txt`, `404.html`, hashed CSS and fonts. |
| `og.ts` | Renders `assets/og.png` and `assets/logo.png`. Reads the tokens from `site.css`. |
| `serve.ts`, `verify.ts` | A local server that routes like `vercel.json` and a Playwright check of every page. |

## Commands

Run from `web/`.

```bash
npm run site            # build the pages into dist-hosted (or SITE_OUT=<dir>)
npm run site:serve      # serve dist-hosted on http://127.0.0.1:4181
npm run site:verify     # check a running server, or pass a URL: npm run site:verify -- https://example.vercel.app
npm run site:test       # odds math, registry rules, structured data
npm run site:typecheck
npm run site:og         # regenerate the share image after a theme change
```

Preview deployments sit behind Vercel's login. Create a Protection Bypass for Automation secret in the project settings and pass it as `VERCEL_PROTECTION_BYPASS=<secret>` when you run `site:verify` against one.

Add `--app` to `site:verify` once the app build lands under `/app/`. It then requires `/app/` and `/app/demo` to serve the app shell.

## Retheming

Replace the `:root` block at the top of `site.css`. Then run `npm run site:og` to redraw the share image. Fonts are loaded in the `@font-face` rules below the block, and `build.ts` copies the two woff2 files from `@fontsource-variable`.

## Adding a page

Create `content/<name>.ts` that exports a `Page`, add it to `PAGES` in `pages.ts`, and add its slug to the `related` list of at least three other pages. The build fails with the broken rule when something is off. Cite any number from Epic through `sources.ts` and record the date you checked it.
