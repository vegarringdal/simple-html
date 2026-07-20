import { expect, test } from '@playwright/test';
import { columnOrder, dragFrom, resizeHandleAt, widthOfColumnLabelled } from './helpers';

/**
 * Resize and drag/drop cannot be captured by `npm run e2e:record` - the playwright recorder
 * does not record drag operations. These drive raw mouse events instead, which is what the
 * grid listens for: the resize handle has an onmousedown that then tracks mousemove/mouseup
 * on document, and dragEvent does the same for the header cells.
 */

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.simple-html-grid-cell-input').first()).toBeVisible();
    await page.getByRole('button', { name: 'set to 10 rows' }).click();
});

test('dragging the resize handle makes a column wider', async ({ page }) => {
    const before = await widthOfColumnLabelled(page, 'Age');
    expect(before).toBeGreaterThan(0);

    await dragFrom(page, await resizeHandleAt(page, 'Age'), 80);

    await expect(async () => {
        expect(await widthOfColumnLabelled(page, 'Age')).toBeGreaterThan(before);
    }).toPass();
});

test('dragging the resize handle makes a column narrower', async ({ page }) => {
    await dragFrom(page, await resizeHandleAt(page, 'Age'), 120);
    const wide = await widthOfColumnLabelled(page, 'Age');

    await dragFrom(page, await resizeHandleAt(page, 'Age'), -60);

    await expect(async () => {
        expect(await widthOfColumnLabelled(page, 'Age')).toBeLessThan(wide);
    }).toPass();
});

test('a column cannot be resized below the minimum width', async ({ page }) => {
    // the resize handler clamps at 25px
    await dragFrom(page, await resizeHandleAt(page, 'Age'), -500);

    await expect(async () => {
        expect(await widthOfColumnLabelled(page, 'Age')).toBeGreaterThanOrEqual(25);
    }).toPass();
});

test('dragging a column header sideways reorders the columns', async ({ page }) => {
    const before = await columnOrder(page);
    expect(before.length).toBeGreaterThan(2);

    const box = await page.getByText('Age').first().boundingBox();
    if (!box) {
        throw new Error('could not find the Age column header');
    }

    // drag left, across the neighbouring columns
    await dragFrom(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, -300, 0, 20);

    await expect(async () => {
        expect(await columnOrder(page)).not.toEqual(before);
    }).toPass();
});
