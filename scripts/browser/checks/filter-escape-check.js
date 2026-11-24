// Real browser check of the escape `\` in a text header filter (textPattern.ts): typed in the full grid
// sample's first text column, the rows the grid shows - `_` one character, `\_` an underscore, `\%` a
// percent - and the SQL sample's WHERE of it. Usage: node filter-escape-check.js <site url>
const [, , base] = process.argv;
const { chromium } = require('playwright');
const results = [];
const check = (name, ok, detail = '') =>
    results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${JSON.stringify(detail)})` : ''}`);
const grid = '.stage simple-html-grid';

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];
    const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${base}#sample/full-grid`);
    await page.waitForSelector(`${grid} .simple-html-grid-col-cell`);
    await page.waitForTimeout(300);

    // a text field shown in the grid, its data replaced with names that need the escape
    const field = await page.evaluate((g) => {
        const gi = document.querySelector(g).grid.gridInterface;
        const ds = gi.getDatasource();
        const f = gi
            .getLayoutFields()
            .map((x) => x.attribute ?? x)
            .find((x) => ds.getField(x).type === 'text' && !gi.__getLookupColumn(x));
        const names = ['S__den', 'Sweden', 'S_den', '50% off', '500', 'a\\b', 'C:\\temp'];
        const rows = ds.getAllData().slice(0, names.length);
        rows.forEach((row, i) => {
            row[f] = names[i];
        });
        ds.setData(rows);
        return f;
    }, grid);
    // the header filter input of the column: its aria-label has the column's label
    const label = await page.evaluate(
        ([g, f]) => {
            const gi = document.querySelector(g).grid.gridInterface;
            const inputs = [...document.querySelectorAll('.stage .simple-html-grid-cell-filter-input')].map((i) =>
                i.getAttribute('aria-label')
            );
            return { inputs: inputs.slice(0, 4), f };
        },
        [grid, field]
    );
    const input = page
        .locator('.stage .simple-html-grid-cell-filter-input')
        .filter({ has: page.locator('xpath=self::*') })
        .nth(
            await page.evaluate((f) => {
                const inputs = [...document.querySelectorAll('.stage .simple-html-grid-cell-filter-input')];
                return inputs.findIndex((i) => (i.getAttribute('aria-label') ?? '').toLowerCase().includes(f.toLowerCase()));
            }, field)
        );
    check(`the header filter input of ${field}`, (await input.count()) === 1, label);
    const typeAndRead = async (text) => {
        await input.click();
        await input.fill('');
        await page.keyboard.type(text);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(250);
        return page.evaluate(
            ([g, f]) =>
                document
                    .querySelector(g)
                    .grid.gridInterface.getDatasource()
                    .getRows()
                    .map((r) => r[f]),
            [grid, field]
        );
    };
    for (const [typed, want, name] of [
        ['S__den', ['S__den', 'Sweden'], '_ is one character'],
        ['S\\_\\_den', ['S__den'], 'the underscores only'],
        ['S\\__den', ['S__den'], 'one escaped, one wildcard'],
        ['50\\%*', ['50% off'], '50\\%*: starts with 50%, not 500'],
        ['C:\\temp', ['C:\\temp'], 'a backslash before a letter'],
        ['a\\\\b', ['a\\b'], 'two backslashes: one']
    ]) {
        const rows = await typeAndRead(typed);
        const value = await input.inputValue();
        check(`typed ${typed}: ${name}`, JSON.stringify(rows) === JSON.stringify(want) && value === typed, { rows, value });
    }
    check('no page errors', errors.length === 0, errors);
    console.log(results.join('\n'));
    console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
    await browser.close();
    process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
})();
