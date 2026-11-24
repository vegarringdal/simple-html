// Real browser check of the summary of the selected cells in the footer (#sample/ranges): it shows for
// ranges of more than one cell, with the right numbers, follows a drag, an edit and a second range, is
// gone for one cell, stays clear of the filter chips, and screenshots light and dark.
// Usage: node footer-summary-check.js <site url> [screenshot dir]
const path = require('node:path');
const [, , base, shots] = process.argv;
const { chromium } = require('playwright');

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];
    for (const dark of [false, true]) {
        const theme = dark ? 'dark' : 'light';
        const page = await browser.newPage({ viewport: { width: 1300, height: 1400 }, deviceScaleFactor: 2 });
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.addInitScript((d) => localStorage.setItem('simple-html-demo-theme', d ? 'dark' : 'light'), dark);
        await page.goto(`${base}#sample/ranges`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
        await page.waitForTimeout(300);

        const summaryText = () =>
            page.evaluate(() => {
                const el = document.querySelector('.stage simple-html-grid .footer-summary');
                return el ? [...el.querySelectorAll('.footer-summary-item')].map((item) => item.textContent.trim()) : null;
            });
        // what the summary should say, from the datasource: every cell of the ranges once
        const expected = () =>
            page.evaluate(() => {
                const gi = document.querySelector('.stage simple-html-grid').grid.gridInterface;
                const ds = gi.getDatasource();
                const fields = gi.getLayoutFields();
                const cells = new Map();
                for (const r of gi.getRanges()) {
                    const [a, b] = [fields.indexOf(r.fromField), fields.indexOf(r.toField)];
                    for (let row = Math.min(r.fromRow, r.toRow); row <= Math.max(r.fromRow, r.toRow); row++) {
                        for (let f = Math.min(a, b); f <= Math.max(a, b); f++) {
                            cells.set(`${row}:${f}`, [row, fields[f]]);
                        }
                    }
                }
                let count = 0;
                const numbers = [];
                for (const [row, field] of cells.values()) {
                    const value = ds.getRow(row)?.[field];
                    if (value === null || value === undefined || value === '') continue;
                    count++;
                    if (ds.getField(field).type === 'number' && typeof value === 'number') numbers.push(value);
                }
                const sum = numbers.reduce((s, n) => s + n, 0);
                return {
                    count,
                    sum,
                    min: Math.min(...numbers),
                    max: Math.max(...numbers),
                    avg: sum / numbers.length,
                    numbers: numbers.length
                };
            });
        const setRanges = (ranges) =>
            page.evaluate((r) => document.querySelector('.stage simple-html-grid').grid.gridInterface.setRanges(r), ranges);
        const num = (text) =>
            Number(
                text
                    .replace(/^[^:]+:\s*/, '')
                    .replace(/[^\d.,-]/g, '')
                    .replace(/,/g, '')
            );

        // 1. company..age over five rows: a count, and the age's numbers
        await setRanges([{ fromRow: 0, fromField: 'company', toRow: 4, toField: 'age' }]);
        await page.waitForTimeout(100);
        let shown = await summaryText();
        let want = await expected();
        check(`${theme}: a range of 20 cells shows the summary`, shown?.length === 5, JSON.stringify(shown));
        if (shown?.length === 5) {
            check(
                `${theme}: count, sum, average, min, max as the datasource has them`,
                num(shown[0]) === want.count &&
                    Math.abs(num(shown[1]) - want.sum) < 0.01 &&
                    Math.abs(num(shown[2]) - Math.round(want.avg * 100) / 100) < 0.01 &&
                    num(shown[3]) === want.min &&
                    num(shown[4]) === want.max,
                `${shown.join(' | ')} vs ${JSON.stringify(want)}`
            );
        }
        if (shots) {
            const footer = page.locator('.stage simple-html-grid .simple-html-grid-footer');
            await footer.screenshot({ path: `${shots}/footer-summary-${theme}.png` });
        }

        if (!dark) {
            // 2. text only: a count, no numbers
            await setRanges([{ fromRow: 0, fromField: 'company', toRow: 3, toField: 'country' }]);
            await page.waitForTimeout(50);
            shown = await summaryText();
            check('text cells only: the count alone', shown?.length === 1 && /^Count: 8$/.test(shown[0]), JSON.stringify(shown));

            // 3. one cell: none
            await setRanges([{ fromRow: 2, fromField: 'age', toRow: 2, toField: 'age' }]);
            await page.waitForTimeout(50);
            check('one cell: no summary', (await summaryText()) === null, JSON.stringify(await summaryText()));

            // 4. a drag with the mouse makes a range: the summary follows it
            const cellBox = async (row, field) =>
                page.evaluate(
                    ([r, f]) => {
                        const input = [...document.querySelectorAll(`.stage input[data-attribute="${f}"]`)].find(
                            (i) => i.closest('.simple-html-grid-col-cell')?.$row === r && i.offsetParent !== null
                        );
                        const rect = input.getBoundingClientRect();
                        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
                    },
                    [row, field]
                );
            // the grid fills the window under the sample's text: the window is tall enough for its first rows
            const from = await cellBox(0, 'age');
            const to = await cellBox(3, 'age');
            await page.mouse.move(from.x, from.y);
            await page.mouse.down();
            await page.mouse.move(to.x, to.y, { steps: 6 });
            await page.mouse.up();
            await page.waitForTimeout(100);
            shown = await summaryText();
            want = await expected();
            check(
                'a drag over four ages: count 4 and their sum',
                shown && num(shown[0]) === 4 && Math.abs(num(shown[1]) - want.sum) < 0.01,
                `${JSON.stringify(shown)} vs ${want.sum}`
            );

            // 5. an edit of a value in the range: the sum follows
            await page.evaluate(() => {
                const ds = document.querySelector('.stage simple-html-grid').grid.gridInterface.getDatasource();
                ds.getRow(1).age = ds.getRow(1).age + 100;
            });
            await page.waitForTimeout(150);
            const after = await summaryText();
            check(
                'an edit in the range: the sum is 100 more',
                after && Math.abs(num(after[1]) - (want.sum + 100)) < 0.01,
                `${after?.[1]} vs ${want.sum + 100}`
            );

            // 6. Ctrl/Cmd+click another range: both count, a common cell once
            await setRanges([
                { fromRow: 0, fromField: 'age', toRow: 3, toField: 'age' },
                { fromRow: 2, fromField: 'age', toRow: 5, toField: 'age' }
            ]);
            await page.waitForTimeout(50);
            shown = await summaryText();
            check('two overlapping ranges: their six cells once', shown && num(shown[0]) === 6, JSON.stringify(shown));

            // 7. with a filter: the chips stay clear of the summary
            // a filter of two conditions: chips in the footer
            await page.evaluate(() => {
                const gi = document.querySelector('.stage simple-html-grid').grid.gridInterface;
                gi.getDatasource().filter({
                    group: 'AND',
                    children: [
                        { field: 'age', operator: 'GREATER_THAN', value: 20 },
                        { field: 'company', operator: 'IS_NOT_BLANK' }
                    ]
                });
            });
            await page.waitForTimeout(200);
            await setRanges([{ fromRow: 0, fromField: 'company', toRow: 4, toField: 'age' }]);
            await page.waitForTimeout(100);
            const overlap = await page.evaluate(() => {
                const footer = document.querySelector('.stage simple-html-grid .simple-html-grid-footer');
                const chips = footer.querySelector('.footer-filter-chips')?.getBoundingClientRect();
                const summary = footer.querySelector('.footer-summary')?.getBoundingClientRect();
                return {
                    chips: chips && [chips.left, chips.right],
                    summary: summary && [summary.left, summary.right],
                    overlaps: !!(chips && summary && chips.right > summary.left)
                };
            });
            check(
                'with a filter: the chips and the summary do not overlap',
                overlap.summary && !overlap.overlaps,
                JSON.stringify(overlap)
            );
            if (shots) {
                const footer = page.locator('.stage simple-html-grid .simple-html-grid-footer');
                await footer.screenshot({ path: `${shots}/footer-summary-filter-${theme}.png` });
            }
        }
        await page.close();
    }
    check('no page errors', errors.length === 0, errors.join(' | '));
    await browser.close();
    console.log(results.join('\n'));
    console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
})();
