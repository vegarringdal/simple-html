import type { Page } from '@playwright/test';

/**
 * Helpers for the browser tests.
 *
 * The grid recycles a fixed pool of row elements and hides the unused ones, so dom order
 * means nothing. These read back only the rows that are actually on screen, in the order
 * the user sees them.
 */

/**
 * values of one column, in rendered order
 */
export async function readColumn(page: Page, attribute: string): Promise<string[]> {
    return page.evaluate((attr) => {
        const container = document.querySelector('.simple-html-grid-body-row-container-pinned-middle');
        if (!container) {
            return [];
        }
        return Array.from(container.children)
            .filter((row) => (row as HTMLElement).style.display !== 'none')
            .sort((a, b) => Number(a.getAttribute('aria-rowindex')) - Number(b.getAttribute('aria-rowindex')))
            .map((row) => {
                const input = row.querySelector(`input[data-attribute="${attr}"]`) as HTMLInputElement | null;
                return input?.value ?? '';
            });
    }, attribute);
}

/**
 * "filtered/total" as shown in the footer
 */
export async function readFooter(page: Page): Promise<string> {
    return (await page.locator('.simple-html-grid-footer').textContent())?.trim() || '';
}

/**
 * rendered width of a column, used by the resize tests
 */
export async function columnWidth(page: Page, attribute: string): Promise<number> {
    return page.evaluate((attr) => {
        const input = document.querySelector(`input[data-attribute="${attr}"]`);
        const col = input?.closest('.simple-html-grid-col') as HTMLElement | null;
        return col ? Math.round(col.getBoundingClientRect().width) : 0;
    }, attribute);
}

/**
 * the order the columns are rendered in, used by the drag/drop tests
 */
export async function columnOrder(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        const container = document.querySelector('.simple-html-grid-body-row-container-pinned-middle');
        const row = container?.children[0];
        if (!row) {
            return [];
        }
        return Array.from(row.querySelectorAll('.simple-html-grid-col'))
            .map((col) => {
                const el = col as HTMLElement;
                const input = col.querySelector('input[data-attribute]');
                return {
                    left: new DOMMatrix(getComputedStyle(el).transform).m41,
                    attribute: input?.getAttribute('data-attribute') || ''
                };
            })
            .filter((c) => c.attribute)
            .sort((a, b) => a.left - b.left)
            .map((c) => c.attribute);
    });
}

/**
 * Centre point of a column's resize handle.
 *
 * The handle spans the whole header height, but the filter input sits on top of its lower
 * half - grabbing it at the vertical centre hits the filter box instead. So aim near the
 * top, level with the label row.
 */
export async function resizeHandleAt(page: Page, label: string): Promise<{ x: number; y: number }> {
    return page.evaluate((text) => {
        const lbl = Array.from(document.querySelectorAll('.simple-html-label')).find((e) => e.textContent?.trim() === text);
        const col = lbl?.closest('.simple-html-grid-col');
        const handle = col?.querySelector('.simple-html-grid-col-resize');
        const box = handle?.getBoundingClientRect();
        if (!box) {
            throw new Error(`no resize handle found for column "${text}"`);
        }
        return { x: box.x + box.width / 2, y: box.y + 5 };
    }, label);
}

/**
 * rendered width of the column with the given header label
 */
export async function widthOfColumnLabelled(page: Page, label: string): Promise<number> {
    return page.evaluate((text) => {
        const lbl = Array.from(document.querySelectorAll('.simple-html-label')).find((e) => e.textContent?.trim() === text);
        const col = lbl?.closest('.simple-html-grid-col') as HTMLElement | null;
        return col ? Math.round(col.getBoundingClientRect().width) : 0;
    }, label);
}

/**
 * drags from a point by an offset, in steps - the grid tracks mousemove and needs
 * more than a single event to react
 */
export async function dragFrom(page: Page, from: { x: number; y: number }, dx: number, dy = 0, steps = 10) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) {
        await page.mouse.move(from.x + (dx * i) / steps, from.y + (dy * i) / steps);
    }
    await page.mouse.up();
}

/**
 * numbers as the grid renders them, for asserting sort order
 */
export function asNumbers(values: string[]): number[] {
    return values.filter((v) => v !== '').map((v) => Number(v.replace(/\s/g, '').replace(',', '.')));
}

export function isAscending(values: number[]): boolean {
    return values.every((v, i) => i === 0 || values[i - 1] <= v);
}

export function isDescending(values: number[]): boolean {
    return values.every((v, i) => i === 0 || values[i - 1] >= v);
}
