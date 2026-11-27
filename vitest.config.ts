import { configDefaults, defineConfig } from 'vitest/config';

// Every test runs in one time zone with summer time, whatever the machine's: GitHub's runners are UTC,
// a developer's machine is not. Set here, before the workers start, so a test file's dates made when it
// loads (`const TODAY = new Date(2026, 10, 22)`) are in it too - a `beforeAll` that sets TZ comes after
// them: on a UTC runner those dates were UTC and the code's Oslo, an hour apart. A test that wants
// another zone sets it and puts this one back (columnFormat.test.ts)
process.env.TZ = 'Europe/Oslo';

export default defineConfig({
    test: {
        // happy-dom has no showPopover() / hidePopover(): a minimal stub, see the file
        setupFiles: ['./src/__tests__/popoverStub.ts'],
        // .claude/worktrees holds git worktrees of other work in progress (Claude Code's agents): their
        // tests are not this tree's
        exclude: [...configDefaults.exclude, '.claude/**'],
        // the default 5s is too short on GitHub's runners: the tests that mount whole grids (the texts,
        // the docs site, 1000 rows scrolled) take 2-3s here and timed out there. 30s still stops a test
        // that hangs
        testTimeout: 30_000
    }
});
