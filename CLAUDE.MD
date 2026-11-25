* dont over complicate things
* never guess js/typescript
* we want simple code and well documented
* we want everything well tested (datasource)
* always format code with biomejs when we are done
* always update IMPORVEMENT.md for each task we do

## Checks - after every change, before we are done

* run the tests and the typecheck: `npx vitest run` and `npm run typecheck` - a change is not done while either fails
* a test that waits for async work waits for what it waits for (an element, a text), not a fixed time: a slow CI runner takes longer
* a change to what the UI does or shows: `npm run build:demo && npm run check:browser -- --jobs 4` (browser checks in `scripts/browser/checks/`, see scripts/browser/README.md) - read its result, and update the checks the change breaks
* before every push run `npm run verify` (the checks of GitHub Actions, read from checks.yml) and push only when it ends with "all 5 passed" and exit code 0 - read its summary, not a count of lines from grep
* never push in the same command as the checks: read their results first. GitHub Actions runs the browser checks in a job of its own
* the pre-push hook runs verify too: turn it on once per clone with `npm run hooks`

## Docs - update them with every change

* a change of behaviour, an option, a text or an API updates its docs in the same commit:
    * the developer guides in `guides/` (and the JSDoc of the API: `npm run check:docs` typechecks every example and link)
    * the user guide in `user-guide/` - for the people who use a grid, by kind of action (filtering, sorting, grouping, columns, formatting, editing, export, import ...): what they see and click, the names of the buttons and menus as the grid shows them (src/texts.ts), no code
    * a new text id: src/texts.ts, its row in guides/12-texts.md, and the Norwegian of the demo (samples/demo/samples/translation.ts)
    * CHANGELOG.md for what a user of the package sees, IMPORVEMENT.md for how and why
* `npm run check:docs` checks the guides, the API examples and the user guide's links: it is part of verify
