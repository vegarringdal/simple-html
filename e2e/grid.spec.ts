import { expect, test } from '@playwright/test';

/**
 * Example browser tests against the grid01 sample.
 *
 * These are here mostly as a starting point / reference for what a recorded test looks
 * like after a small cleanup. To add more, record them instead of writing them:
 *
 *   npm run e2e:record
 *
 * Click through the app, playwright writes the test as you go, then paste it into a file
 * in this folder.
 */

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // the grid renders its first rows once the datasource is attached
    await expect(page.locator('.simple-html-grid-cell-input').first()).toBeVisible();
});

test('grid renders rows from the sample data', async ({ page }) => {
    // the sample overrides the value formater so every country cell reads "Open D"
    await expect(page.locator('input[data-attribute="country"]').first()).toHaveValue('Open D');
});

test('footer shows the row count', async ({ page }) => {
    await expect(page.locator('.simple-html-grid-footer')).toContainText('/');
});

test('typing in a column filter reduces the rows', async ({ page }) => {
    const footer = page.locator('.simple-html-grid-footer');
    const before = await footer.textContent();

    const filter = page.locator('input.simple-html-grid-cell-filter-input').first();
    await filter.click();
    await filter.fill('a*');
    await filter.press('Enter');

    // auto retrying assertion - the grid rebuilds rows asynchronously on filter
    await expect(footer).not.toHaveText(before || '');
});

/**
 * Sorting by clicking a column label is deliberately NOT hand written here.
 *
 * The header stacks two overlapping .simple-html-label elements at the same coordinates,
 * so a hand picked selector gets rejected as "covered" and it turns into a guessing game.
 * This is the sort of interaction to capture with `npm run e2e:record` - the recorder picks
 * the element you actually clicked, so the selector is right the first time.
 */

test('scrolling down renders different rows', async ({ page }) => {
    const firstCell = page.locator('input[data-attribute="age"]').first();
    const before = await firstCell.inputValue();

    await page.locator('.simple-html-grid-body-scroller').evaluate((el) => {
        el.scrollTop = 2000;
    });

    await expect(async () => {
        expect(await firstCell.inputValue()).not.toEqual(before);
    }).toPass();
});

test('right click on a row opens the row context menu', async ({ page }) => {
    await page.locator('input[data-attribute="company"]').first().click({ button: 'right' });
    await expect(page.locator('.simple-html-grid-menu')).toBeVisible();
});
