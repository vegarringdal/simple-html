// Real browser check of Delete on a row number (#sample/editing): click row numbers (Shift+click for
// more), Delete marks them (struck through, the trash can), Ctrl+Z on the number unmarks, Delete in a
// cell types; a screenshot.
// Usage: node row-delete-check.js <site url> [screenshot dir]
const path = require('node:path');
const [, , base, shots] = process.argv;
const { chromium } = require('playwright');

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];
    const page = await browser.newPage({ viewport: { width: 1300, height: 1400 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${base}#sample/editing`);
    await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
    await page.waitForTimeout(300);
    const number = (row) =>
        page.evaluateHandle(
            (r) =>
                [
                    ...document.querySelectorAll('.stage .simple-html-grid-body-row-container-selector > .simple-html-grid-row')
                ].find((el) => el.$row === r && el.style.display !== 'none').firstElementChild,
            row
        );
    const states = () =>
        page.evaluate(() =>
            document
                .querySelector('.stage simple-html-grid')
                .grid.gridInterface.getDatasource()
                .getRows()
                .slice(0, 5)
                .map((row) => row.__rowState ?? '-')
                .join('')
        );

    await (await number(1)).click();
    await page.keyboard.down('Shift');
    await (await number(2)).click();
    await page.keyboard.up('Shift');
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('role'));
    check('a click on a row number: the focus on it', focused === 'gridcell', focused);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(150);
    check('Delete: rows 2 and 3 marked', (await states()) === '-DD--', await states());
    const struck = await page.evaluate(() => {
        const cell = [...document.querySelectorAll('.stage .simple-html-grid-col-cell')].find(
            (c) => c.$row === 1 && c.$attribute
        );
        return cell?.classList.contains('simple-html-cell-deleted');
    });
    check('the marked row is struck through', struck === true);
    if (shots) {
        const box = await page.locator('.stage simple-html-grid').boundingBox();
        await page.screenshot({ path: `${shots}/row-delete.png`, clip: { x: box.x, y: box.y, width: 700, height: 220 } });
    }
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(150);
    check('Ctrl+Z on the number: unmarked', (await states()) === '-----', await states());

    // Delete in a cell is the input's
    const input = await page.evaluateHandle(() =>
        [...document.querySelectorAll('.stage input[data-attribute="company"]')].find(
            (i) => i.closest('.simple-html-grid-col-cell').$row === 0 && i.offsetParent
        )
    );
    await input.click();
    await page.keyboard.press('Home');
    await page.keyboard.press('Delete');
    await page.waitForTimeout(150);
    // it deleted a character: the row is edited (M), none is marked (D)
    check('Delete in a cell: no row marked, the text edited', !(await states()).includes('D'), await states());

    check('no page errors', errors.length === 0, errors.join(' | '));
    await browser.close();
    console.log(results.join('\n'));
    console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
})();
