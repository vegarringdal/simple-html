

* dont over complicate things
* never guess js/typescript
* we want simple code and well documented
* we want everything well tested (datasource)
* always format code with biomejs when we are done
* always run tests before we are done
* always update IMPORVEMENT.md for each task we do
* before every push run `npm run verify` (the checks of GitHub Actions, read from checks.yml) and push only when it ends with "all 5 passed" and exit code 0 - read its summary, not a count of lines from grep
* the pre-push hook runs it too: turn it on once per clone with `npm run hooks`
* browser checks live in `scripts/browser/checks/` (see scripts/browser/README.md): `npm run build:demo && npm run check:browser`; GitHub Actions runs them in its own job
