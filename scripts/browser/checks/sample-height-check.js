// Real browser check: every sample's grid shows at least 15 rows of the default 22px - on the sample's
// own page and in each guide that runs it (a ```sample block), in a window of 1400 x 900 and a low one.
// Usage: node sample-height-check.js <site url> [screenshot dir]
const path = require('node:path');
const [, , base, shots] = process.argv;
const { chromium } = require('playwright');

const ROWS = 15;
const ROW = 22;
const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(base);
    await page.waitForSelector('.nav-item', { state: 'attached' });
    const links = await page.evaluate(() =>
        [...document.querySelectorAll('a.nav-item')]
            .map((a) => a.getAttribute('href'))
            .filter((h) => /^#(sample|guide)\//.test(h))
    );
    check(
        'the sidebar lists samples and guides',
        links.some((h) => h.startsWith('#sample/')) && links.some((h) => h.startsWith('#guide/')),
        `${links.length} pages`
    );

    // the body of every sample grid on the page: its height in rows of 22px
    const measure = () =>
        page.evaluate(() =>
            [...document.querySelectorAll('.demo-grid-host')].map((host) => {
                const body = host.querySelector('.simple-html-grid-body-scroller');
                return { height: body ? body.clientHeight : 0, host: host.clientHeight };
            })
        );

    for (const [width, height] of [
        [1400, 900],
        [1000, 600]
    ]) {
        await page.setViewportSize({ width, height });
        const small = [];
        let grids = 0;
        for (const href of links) {
            await page.goto(`${base}${href}`);
            await page.waitForTimeout(250);
            const found = await measure();
            grids += found.length;
            for (const [index, grid] of found.entries()) {
                if (grid.height < ROWS * ROW) {
                    small.push(`${href}[${index}]: ${Math.floor(grid.height / ROW)} rows (${grid.height}px)`);
                }
            }
        }
        check(
            `${width}x${height}: every sample grid shows ${ROWS} rows or more`,
            small.length === 0,
            small.length ? small.slice(0, 12).join('; ') : `${grids} grids`
        );
    }

    // the SQL guide: the grid of its sample, with rows, and the WHERE under it
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${base}#guide/sql`);
    await page.waitForTimeout(400);
    const sql = await measure();
    check(
        'the SQL guide: its sample grid shows 15 rows',
        sql.length > 0 && sql.every((g) => g.height >= ROWS * ROW),
        JSON.stringify(sql)
    );
    if (shots) {
        const host = page.locator('.demo-grid-host').first();
        await host.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${shots}/sql-guide-sample-height.png` });
    }

    check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    await browser.close();
    console.log(results.join('\n'));
    const failed = results.filter((r) => r.startsWith('FAIL')).length;
    console.log(`${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})();
