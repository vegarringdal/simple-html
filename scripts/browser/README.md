# Browser checks

Scripts that drive the docs site (`dist_demo`) in a real Chromium: what happy-dom can not show -
layout, scrolling, real pointer and touch events, focus, the clipboard, colours on screen. Each script
in `checks/` opens a sample, acts like a user and prints a line per check, `PASS` or `FAIL`.

```sh
npm run build:demo
npm run check:browser                       # all of them, two at a time
npm run check:browser -- --only fill        # the scripts whose file name has "fill"
npm run check:browser -- --jobs 4           # four at a time
```

`run.js` serves `dist_demo` on `PORT` (8090), runs the scripts and sums up: exit code 0 when every
script ran to its end, printed at least one `PASS` and no `FAIL`. The output of a script that failed is
printed after the summary. Screenshots go to `SHOTS` (a folder in the temp dir).

Chromium is playwright's own (`npx playwright install chromium`), or the one `CHROMIUM_PATH` names.
GitHub Actions runs them in the `browser checks` job of `checks.yml`. `npm run verify` leaves them out:
they take minutes.

## A new check

A script takes `<site url> <shots dir>`, launches Chromium with
`chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] })`,
opens `${base}#sample/<id>`, prints `PASS  <what>` / `FAIL  <what>  (<detail>)` lines and closes the
browser. A setting in the grid config dialog sits on a tab: `require('../sections')()` makes
Playwright click its tab first.
