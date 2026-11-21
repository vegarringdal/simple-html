import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // happy-dom has no showPopover() / hidePopover(): a minimal stub, see the file
        setupFiles: ['./src/__tests__/popoverStub.ts']
    }
});
