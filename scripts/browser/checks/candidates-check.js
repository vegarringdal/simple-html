// Real browser check of the fixes of "Candidates checked" (IMPORVEMENT.md, 2026-11-21) that show on the
// docs site:
// - the date picker of a header filter (#sample/basic-grid, the date1 column): it opens on the date typed
//   in the filter, not on what the cell had when it was rendered (empty: today); a date picked filters as a
//   typed one does, the input shows it, the grid's state holds a Date (it was the text)
// - the copy button of a sample's source: "copied!" with the clipboard allowed, "copy failed" when the
//   browser refuses it (it was an uncaught rejection) - no page error either way
// Usage: node candidates-check.js <site url> [screenshot dir]
const [, , base, shots] = process.argv;
const { chromium } = require('playwright');

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];

    // ------------------------------------------------------------------ the header filter's date picker
    {
        const page = await browser.newPage({ viewport: { width: 1300, height: 1000 }, deviceScaleFactor: 1 });
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto(`${base}#sample/basic-grid`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
        await page.waitForTimeout(300);
        const grid = '.stage simple-html-grid';
        const filterInput = `${grid} input.simple-html-grid-cell-filter-input[aria-label*="date" i]`;
        check('the date column has a header filter', (await page.locator(filterInput).count()) === 1);

        await page.locator(filterInput).fill('2026-03-05');
        await page.locator(filterInput).press('Enter');
        await page.waitForTimeout(200);
        const state = () =>
            page.evaluate((g) => {
                const value = document.querySelector(g).grid.gridInterface.getState().headerFilters.date1?.value;
                return { isDate: value instanceof Date, text: value instanceof Date ? value.toDateString() : String(value) };
            }, grid);
        const typed = await state();
        check('a typed date is stored as a Date', typed.isDate, typed.text);

        await page.locator(filterInput).click();
        await page.waitForSelector('simple-html-date .simple-html-date-day');
        await page.waitForTimeout(100);
        const opened = await page.evaluate(() => ({
            month: document.querySelector('simple-html-date .simple-html-date-month-name')?.textContent?.trim(),
            year: document.querySelector('simple-html-date .simple-html-date-year')?.textContent?.trim(),
            selected: document.querySelector('simple-html-date .simple-html-date-day-selected')?.textContent?.trim()
        }));
        check(
            'the picker opens on the date typed (March 2026, the 5th selected)',
            opened.year === '2026' && /^Mar/.test(opened.month || '') && opened.selected === '5',
            JSON.stringify(opened)
        );
        if (shots) {
            await page.screenshot({ path: `${shots}/header-filter-picker.png` });
        }

        await page
            .locator('simple-html-date .simple-html-date-day:not(.simple-html-date-day-dimmed)', { hasText: /^\s*10\s*$/ })
            .first()
            .click();
        await page.locator('simple-html-date .simple-html-date-button-primary').click();
        await page.waitForTimeout(200);
        const picked = await state();
        check(
            'a picked date is stored as a Date, as a typed one',
            picked.isDate && picked.text === 'Tue Mar 10 2026',
            picked.text
        );
        check('the input shows the date picked', (await page.locator(filterInput).inputValue()) === '2026-03-10');
        const dates = await page.evaluate(
            (g) =>
                document
                    .querySelector(g)
                    .grid.gridInterface.getDatasource()
                    .getDataRows()
                    .map((row) => row.date1.getTime()),
            grid
        );
        check(
            'the rows are filtered on it (date >= 2026-03-10)',
            dates.length > 0 && dates.every((time) => time >= new Date(2026, 2, 10).getTime()),
            `${dates.length} rows`
        );
        if (shots) {
            await page.screenshot({ path: `${shots}/header-filter-picked.png` });
        }
        await page.close();
    }

    // ------------------------------------------------------------------ the copy button of a source
    for (const allowed of [true, false]) {
        const context = await browser.newContext();
        if (allowed) {
            await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(base).origin });
        }
        const page = await context.newPage();
        const pageErrors = [];
        page.on('pageerror', (e) => pageErrors.push(String(e)));
        await page.goto(`${base}#sample/basic-grid`);
        await page.waitForSelector('.code-panel .copy-btn');
        if (!allowed) {
            // a browser that refuses the write, as one without the permission does
            await page.evaluate(() => {
                navigator.clipboard.writeText = () =>
                    Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError'));
            });
        }
        await page.locator('.code-panel .copy-btn').click();
        await page.waitForTimeout(300);
        const text = await page.locator('.code-panel .copy-btn').textContent();
        if (allowed) {
            const copied = await page.evaluate(() => navigator.clipboard.readText());
            check('copy: the source is on the clipboard, "copied!"', text === 'copied!' && copied.includes('basicGrid'), text);
        } else {
            check(
                'copy refused: "copy failed", no uncaught error',
                text === 'copy failed' && pageErrors.length === 0,
                `${text} ${pageErrors.join(' | ')}`
            );
        }
        errors.push(...pageErrors);
        await context.close();
    }

    check('no page errors', errors.length === 0, errors.join(' | '));
    await browser.close();
    console.log(results.join('\n'));
    const failed = results.filter((line) => line.startsWith('FAIL')).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})();
