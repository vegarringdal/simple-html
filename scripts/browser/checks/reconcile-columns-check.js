// Real browser check of the sample "Columns from a source" (reconcile-columns): version 1's grid, then
// Update to version 2 - age gone from the header, its colours, the calculated column, the filter, the
// view; the chooser lists Fruit and Phone, not Age; shown with showNew; back to version 1; the views
// button on and off.
// Usage: node reconcile-columns-check.js <site url> [screenshot dir]
const [, , base, shots] = process.argv;
const { chromium } = require('playwright');
const results = [];
const check = (name, ok, detail = '') =>
    results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? `  (${JSON.stringify(detail)})` : ''}`);
const grid = '.stage simple-html-grid';
(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];
    const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${base}#sample/reconcile-columns`);
    await page.waitForSelector(`${grid} .simple-html-grid-col-cell`);
    await page.waitForTimeout(300);
    const look = () =>
        page.evaluate((g) => {
            const root = document.querySelector(g);
            const gi = root.grid.gridInterface;
            return {
                header: [...root.querySelectorAll('.simple-html-grid-header [data-attribute-header]')].map((e) =>
                    e.getAttribute('data-attribute-header')
                ),
                sorting: gi.getState().sorting.map((s) => s.attribute),
                rows: gi.getDatasource().getRows().length,
                coloured: root.querySelectorAll('.simple-html-grid-cell-bg-orange, .simple-html-grid-cell-text-blue').length,
                green: root.querySelectorAll('.simple-html-grid-cell-bg-green').length,
                views: gi.getViews().map((v) => v.name + ':' + JSON.stringify(v.state.filter)),
                viewsButton: !!root.querySelector('.footer-views-button'),
                log: [...document.querySelectorAll('.demo-log *')]
                    .map((e) => e.textContent)
                    .slice(-2)
                    .join(' / ')
            };
        }, grid);
    const button = (name) => page.getByRole('button', { name, exact: true }).click();
    const chooser = async () => {
        await page.evaluate((g) => {
            const label = document.querySelector(`${g} [data-attribute-header="company"]`);
            label.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 50, clientY: 50 }));
        }, grid);
        await page.waitForTimeout(150);
        await page.locator('[data-menu-id="header.column.chooser"]').click();
        await page.waitForTimeout(200);
        const fields = await page.evaluate(() =>
            [...document.querySelectorAll('.simple-html-grid-menu-sub .simple-html-grid-menu-item')].map((i) => i.$attribute)
        );
        await page.keyboard.press('Escape');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
        return fields;
    };

    let s = await look();
    check(
        'version 1: age and Age next year shown, sorted on age, coloured by its rules',
        s.header.includes('age') && s.header.includes('nextAge') && s.sorting[0] === 'age' && s.coloured > 0,
        s
    );
    if (shots) await page.locator(grid).screenshot({ path: `${shots}/reconcile-v1.png` });

    await button('Update to version 2');
    await page.waitForTimeout(300);
    s = await look();
    check(
        'version 2: age and Age next year gone from the header, the sort, its colours',
        !s.header.includes('age') && !s.header.includes('nextAge') && s.sorting.length === 0 && s.coloured === 0,
        s
    );
    check('version 2: the rule on Balance still colours', s.green > 0, s.green);
    check(
        'version 2: the view on age has no filter left, the other keeps its own',
        s.views[0] === 'Young customers:null' && /balance/.test(s.views[1]),
        s.views
    );
    check(
        'version 2: the log has the report',
        /added \[favoriteFruit, phone\], removed \[age\], calculated removed \[nextAge\], rules removed: 2/.test(s.log),
        s.log
    );
    const listed = await chooser();
    check(
        'version 2: the chooser lists Fruit and Phone, not Age',
        listed.includes('favoriteFruit') && listed.includes('phone') && !listed.includes('age'),
        listed
    );
    if (shots) await page.locator(grid).screenshot({ path: `${shots}/reconcile-v2.png` });

    await button('Start again');
    await page.waitForTimeout(200);
    await button('Update to version 2, new columns shown');
    await page.waitForTimeout(300);
    s = await look();
    check(
        'version 2 with showNew: Fruit and Phone at the end of the header',
        s.header.slice(-2).join() === 'favoriteFruit,phone',
        s.header
    );

    await button('Back to version 1');
    await page.waitForTimeout(300);
    s = await look();
    check(
        'back to version 1: age back, shown at the end; Fruit and Phone gone',
        s.header.at(-1) === 'age' && !s.header.includes('phone'),
        s.header
    );

    s = await look();
    const before = s.viewsButton;
    await button('Views button on / off');
    await page.waitForTimeout(200);
    s = await look();
    check('viewsButton: the views button shown, then hidden', before === true && s.viewsButton === false, [
        before,
        s.viewsButton
    ]);
    check('no page errors', errors.length === 0, errors);
    console.log(results.join('\n'));
    console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
    await browser.close();
    process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
})();
