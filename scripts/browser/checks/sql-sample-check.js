// Real browser check of the "SQL from the filter" sample (#sample/sql) and the SQL guide: the WHERE of the
// four dialects under the grid, following the buttons and a header filter typed in; a field that is not a
// column shows the error; a hostile text is only a parameter; no page errors; screenshots light and dark.
// Usage: node sql-sample-check.js <site url> [screenshot dir]
const [, , base, shots] = process.argv;
const { chromium } = require('playwright');

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];
    for (const dark of [false, true]) {
        const theme = dark ? 'dark' : 'light';
        const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, timezoneId: 'Europe/Oslo' });
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.addInitScript((d) => localStorage.setItem('simple-html-demo-theme', d ? 'dark' : 'light'), dark);
        await page.goto(`${base}#sample/sql`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
        await page.waitForTimeout(300);
        const blocks = () =>
            page.evaluate(() => [...document.querySelectorAll('.stage .demo-sql-block')].map((b) => b.textContent));
        const button = (label) => page.locator('.stage .demo-btn', { hasText: label }).first().click();

        let shown = await blocks();
        check(
            `${theme}: four dialects, no filter is WHERE 1=1`,
            shown.length === 4 && shown.every((b) => b.includes('WHERE 1=1')),
            JSON.stringify(shown)
        );

        await button('Norway, age 30-40');
        await page.waitForTimeout(100);
        shown = await blocks();
        check(
            `${theme}: Norway, age 30-40 in each dialect's placeholders`,
            shown[0].includes('$1') &&
                shown[1].includes(':1') &&
                shown[2].includes('?') &&
                shown[3].includes('@p1') &&
                // the value folded in JavaScript before it is bound (ASCII): "norway" - not the case typed
                shown.every((b) => b.toLowerCase().includes('"norway"') && b.includes('30,40')),
            shown.join(' | ')
        );
        const rows = await page.evaluate(() => document.querySelectorAll('.stage simple-html-grid .simple-html-grid-row').length);
        check(`${theme}: the grid filters too`, rows > 0, String(rows));

        await button('date in March');
        await page.waitForTimeout(100);
        shown = await blocks();
        check(
            `${theme}: a date in the browser's time zone`,
            shown[0].includes('2026-03-01 00:00:00') && shown[0].includes('2026-04-01 00:00:00'),
            shown[0]
        );

        await button('hostile text');
        await page.waitForTimeout(100);
        shown = await blocks();
        check(
            `${theme}: a hostile text is only a parameter`,
            shown.every(
                (b) => !b.split('\n')[1].toLowerCase().includes('drop') && b.toLowerCase().includes('drop table customer')
            ),
            shown.join(' | ')
        );

        await button('phone (not a column)');
        await page.waitForTimeout(100);
        shown = await blocks();
        check(
            `${theme}: a field that is not a column shows the error`,
            shown.every((b) => b.includes('is not one of the columns')),
            shown[0]
        );

        await button('Clear filter');
        await page.waitForTimeout(100);
        // a header filter typed in
        const input = page.locator('.stage input[aria-label="Filter Company"]').first();
        const found = await input.count();
        if (found) {
            await input.click();
            await input.fill('a*');
            await input.press('Enter');
            await page.waitForTimeout(200);
            shown = await blocks();
        }
        check(
            `${theme}: a header filter typed in follows`,
            found && shown[0].includes('company_name') && shown[0].includes('"a%"'),
            shown[0]
        );

        if (shots) {
            await page.screenshot({ path: `${shots}/sql-sample-${theme}.png`, fullPage: true });
        }

        // the guide, with the sample in it
        await page.goto(`${base}#guide/sql`);
        await page.waitForTimeout(800);
        const guide = await page.evaluate(() => ({
            samples: document.querySelectorAll('.doc-sample simple-html-grid').length,
            missing: document.querySelectorAll('.doc-missing').length,
            blocks: document.querySelectorAll('.doc-sample .demo-sql-block').length
        }));
        check(
            `${theme}: the guide shows the sample`,
            guide.samples === 1 && guide.missing === 0 && guide.blocks === 4,
            JSON.stringify(guide)
        );
        if (shots) {
            await page.screenshot({ path: `${shots}/sql-guide-${theme}.png` });
        }
        await page.close();
    }
    check('no page errors', errors.length === 0, errors.join(' | '));
    await browser.close();
    console.log(results.join('\n'));
    process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
})();
