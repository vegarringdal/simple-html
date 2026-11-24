// Real browser check of the row menu on a row number (contextmenuRow.ts): the user - "row number context
// menu have too many options that does not belong there". On a row number: Undo / Redo, Select, Copy,
// Delete, Size - no Paste, Clear, Filter, View, Export; on a cell the whole menu as before.
// Usage: node row-number-menu-check.js <site url> [shots dir]
const path = require('node:path');
const [, , base, shots] = process.argv;
const { chromium } = require('playwright');

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];
    for (const scheme of ['light', 'dark']) {
        const page = await browser.newPage({ viewport: { width: 1300, height: 900 }, colorScheme: scheme });
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto(`${base}#sample/full-grid`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
        const topLevel = () =>
            page.$$eval('.simple-html-grid-popover > .simple-html-grid-menu > [data-menu-id]', (items) =>
                items.filter((item) => item.offsetParent !== null).map((item) => item.getAttribute('data-menu-id'))
            );
        // a row number
        // a body row's number: the column numbers in the header have the same text class
        const number = page.locator('.stage .simple-html-grid-body-row-container-selector .simple-html-selector-text').nth(3);
        await number.click({ button: 'right' });
        await page.waitForSelector('.simple-html-grid-popover .simple-html-grid-menu');
        const onNumber = await topLevel();
        check(
            `${scheme}: on a row number Undo / Redo, Select, Copy, Delete, Size`,
            JSON.stringify(onNumber) === JSON.stringify(['row.edit', 'row.select', 'row.copy', 'row.delete', 'row.size']),
            onNumber.join(', ')
        );
        // Copy ›: the rows only
        if (!onNumber.includes('row.copy')) {
            console.log('menu:', await page.$eval('.simple-html-grid-popover', (menu) => menu.outerHTML.slice(0, 1500)));
        }
        await page.hover('.simple-html-grid-popover [data-menu-id="row.copy"]', { timeout: 3000 });
        await page.waitForTimeout(400);
        const copy = await page.$$eval('.simple-html-grid-popover [data-menu-id^="row.copy."]', (items) =>
            items.map((item) => item.getAttribute('data-menu-id'))
        );
        check(
            `${scheme}: Copy › the rows only`,
            !copy.includes('row.copy.cell') && copy.includes('row.copy.row'),
            copy.join(', ')
        );
        if (shots) {
            await page.screenshot({
                path: `${shots}/row-number-menu-${scheme}.png`,
                clip: { x: 230, y: 250, width: 600, height: 450 }
            });
        }
        await page.keyboard.press('Escape');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
        // a cell: the whole menu
        await page.locator('.stage .simple-html-grid-col-cell input').nth(20).click({ button: 'right' });
        await page.waitForSelector('.simple-html-grid-popover .simple-html-grid-menu');
        const onCell = await topLevel();
        check(
            `${scheme}: on a cell the whole menu`,
            ['row.paste', 'row.clear', 'row.filter', 'row.view', 'row.export'].every((id) => onCell.includes(id)),
            onCell.join(', ')
        );
        await page.close();
    }
    check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    await browser.close();
    console.log(results.join('\n'));
    const failed = results.filter((r) => r.startsWith('FAIL')).length;
    console.log(`${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})();
