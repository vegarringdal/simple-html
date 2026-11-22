import { configDefaults, defineConfig } from 'vitest/config';

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
