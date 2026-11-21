import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // happy-dom has no showPopover() / hidePopover(): a minimal stub, see the file
        setupFiles: ['./src/__tests__/popoverStub.ts'],
        // .claude/worktrees holds git worktrees of other work in progress (Claude Code's agents): their
        // tests are not this tree's
        exclude: [...configDefaults.exclude, '.claude/**']
    }
});
