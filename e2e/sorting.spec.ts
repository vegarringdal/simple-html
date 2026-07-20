import { expect, test } from '@playwright/test';
import { asNumbers, isAscending, isDescending, readColumn } from './helpers';

/**
 * Built from a recorded session (npm run e2e:record), with assertions added.
 *
 * The selectors are the ones the recorder picked while clicking the real app, which is
 * why they are getByText on the label rather than a css path - the header stacks two
 * overlapping label elements, so hand picked selectors get rejected as "covered".
 */

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.simple-html-grid-cell-input').first()).toBeVisible();
    // smaller set so a sort is easy to eyeball and quick to settle
    await page.getByRole('button', { name: 'set to 10 rows' }).click();
});

test('clicking a column label sorts ascending', async ({ page }) => {
    await page.getByText('Age').click();

    await expect(async () => {
        const ages = asNumbers(await readColumn(page, 'age'));
        expect(ages.length).toBeGreaterThan(1);
        expect(isAscending(ages)).toBe(true);
    }).toPass();
});

test('clicking the same label again sorts descending', async ({ page }) => {
    await page.getByText('Age').click();
    await page.getByText('Age').click();

    await expect(async () => {
        const ages = asNumbers(await readColumn(page, 'age'));
        expect(ages.length).toBeGreaterThan(1);
        expect(isDescending(ages)).toBe(true);
    }).toPass();
});

test('shift clicking a second label adds it to the sort', async ({ page }) => {
    await page.getByText('my Company name').click();
    await page.getByText('Latitude').click({ modifiers: ['Shift'] });

    // the grid shows a sort number per sorted column once more than one is active
    await expect(page.locator('.simple-html-grid-sort-number').first()).toBeVisible();
    expect(await page.locator('.simple-html-grid-sort-number').count()).toBeGreaterThan(1);
});

test('sorting still works after adding more rows', async ({ page }) => {
    await page.getByRole('button', { name: 'add to 100 rows' }).click();
    await page.getByText('Age').click();

    await expect(async () => {
        const ages = asNumbers(await readColumn(page, 'age'));
        expect(ages.length).toBeGreaterThan(1);
        expect(isAscending(ages)).toBe(true);
    }).toPass();
});
