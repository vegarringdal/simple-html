import { expect, test } from '@playwright/test';

/**
 * Context menus cannot be captured by `npm run e2e:record` - the playwright recorder does
 * not record right clicks. These are hand written, but they reuse the label selectors the
 * recorder found, which is the part that was hard to get right.
 */

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.simple-html-grid-cell-input').first()).toBeVisible();
    await page.getByRole('button', { name: 'set to 10 rows' }).click();
});

test('right click on a column label opens the label menu', async ({ page }) => {
    await page.getByText('my Company name').click({ button: 'right' });

    const menu = page.locator('.simple-html-grid-menu');
    await expect(menu).toBeVisible();
    await expect(menu).toContainText(/pin/i);
});

test('right click on a row cell opens the row menu', async ({ page }) => {
    await page.locator('input[data-attribute="country"]').first().click({ button: 'right' });

    const menu = page.locator('.simple-html-grid-menu');
    await expect(menu).toBeVisible();
    await expect(menu).toContainText(/copy/i);
});

test('right click on a filter input opens the filter menu', async ({ page }) => {
    await page.locator('input.simple-html-grid-cell-filter-input').first().click({ button: 'right' });

    const menu = page.locator('.simple-html-grid-menu');
    await expect(menu).toBeVisible();
});

test('opening a second menu replaces the first', async ({ page }) => {
    await page.getByText('my Company name').click({ button: 'right' });
    await expect(page.locator('.simple-html-grid-menu')).toHaveCount(1);

    await page.getByText('Age').click({ button: 'right' });
    await expect(page.locator('.simple-html-grid-menu')).toHaveCount(1);
});

test('the label menu can hide a column', async ({ page }) => {
    await expect(page.locator('input[data-attribute="latitude"]').first()).toBeAttached();

    await page.getByText('Latitude').click({ button: 'right' });
    // an anchored regex does not match here, the menu item text is not the whole text node
    await page.locator('.simple-html-grid-menu-item', { hasText: 'Hide' }).first().click();

    await expect(page.locator('input[data-attribute="latitude"]')).toHaveCount(0);
});
