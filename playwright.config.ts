import { defineConfig, devices } from '@playwright/test';

/**
 * Browser level gui tests.
 *
 * These run against the real grid01 sample in a real chromium, so they cover the things
 * the happy-dom tests cannot: drag/drop, column resize, context menus, key navigation -
 * anything that needs real layout and real events.
 *
 * The happy-dom tests in packages/grid/src are still the fast feedback loop, these are the
 * slower second layer.
 *
 * Record a new test by clicking through the app:
 *   npm run e2e:record
 */
export default defineConfig({
    testDir: './e2e',

    /**
     * codegen writes getByTestId('firstname') instead of brittle css paths.
     * The grid already puts data-attribute on every cell input and filter input.
     */
    use: {
        baseURL: 'http://localhost:8080',
        testIdAttribute: 'data-attribute',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        /**
         * the sample puts the grid in a fixed box with a button panel to the left,
         * a small window makes the grid tiny and scrolling behave oddly.
         * keep this in sync with the --viewport-size in the e2e:record script.
         */
        viewport: { width: 1600, height: 900 }
    },

    /**
     * chromium only - the grid is used in chromium based browsers.
     * Add firefox/webkit here if that ever changes.
     */
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] }
        }
    ],

    /**
     * boots the normal dev server, and reuses one that is already running
     * so `npm start` in another terminal makes the tests start instantly
     */
    webServer: {
        command: 'npm start',
        url: 'http://localhost:8080',
        reuseExistingServer: true,
        timeout: 120_000
    },

    // the grid re-renders on scroll, so give assertions room to settle
    expect: { timeout: 10_000 },
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]]
});
