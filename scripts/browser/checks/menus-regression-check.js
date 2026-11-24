// The grid's three default menus after the submenus came: each opens (header label, row cell, header
// filter), runs one action from inside a submenu (Pin › Pin left, Copy › Cell Value, Blank › Is
// blank), stays in the window with an open submenu near the right and bottom edges, and closes on Esc
// and on a click outside.
// Usage: node menus-regression-check.js <site url> <shots dir>
//   Chromium: CHROMIUM_PATH, else playwright's own
const path = require('node:path');
const fs = require('node:fs');
const [, , base, shots] = process.argv;
if (!base || !shots) {
    console.log('usage: node menus-regression-check.js <site url> <shots dir>');
    process.exit(2);
}
const { chromium } = require('playwright');
const executablePath = process.env.CHROMIUM_PATH || undefined;
fs.mkdirSync(shots, { recursive: true });

const results = [];
const check = (name, pass, detail = '') => results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);

(async () => {
    const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(base).origin });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));

    await page.goto(`${base}/#sample/editing`);
    await page.waitForSelector('.stage input[data-attribute="age"]', { timeout: 15000 });
    await page.evaluate(() => document.body.classList.remove('dark'));

    const entry = (id) => page.locator(`[data-menu-id="${id}"]`);
    const menuCount = () => page.locator('.simple-html-grid-popover').count();
    /** every open menu and submenu inside the window, 4px from its edges */
    const inWindow = () =>
        page.evaluate(() =>
            Array.from(document.querySelectorAll('.simple-html-grid-menu[role="menu"]')).map((menu) => {
                const r = menu.parentElement.getBoundingClientRect();
                return {
                    inside: r.left >= 3.5 && r.top >= 3.5 && r.right <= innerWidth - 3.5 && r.bottom <= innerHeight - 3.5,
                    rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]
                };
            })
        );
    /** the element of `selector` furthest right / lowest that is shown, and a point in it: left of the
     * resize handle at the right edge of a column - and of the operator indicator of a text header
     * filter (filterOperatorIndicator, ~24px at its right): 30px in from the right edge */
    const extreme = (selector, side) =>
        page.evaluate(
            ([selector, side]) => {
                const shown = Array.from(document.querySelectorAll(selector))
                    .map((element) => ({ element, r: element.getBoundingClientRect() }))
                    .filter(
                        ({ element, r }) =>
                            r.width > 0 &&
                            r.right <= innerWidth &&
                            r.bottom <= innerHeight &&
                            element.contains(document.elementFromPoint(r.left + 5, r.top + 5)) &&
                            element.contains(document.elementFromPoint(r.right - 30, r.top + 5))
                    );
                const best = shown.sort((a, b) => (side === 'right' ? b.r.right - a.r.right : b.r.bottom - a.r.bottom))[0];
                return best ? { x: best.r.right - 30, y: best.r.top + 5 } : null;
            },
            [selector, side]
        );
    const pinnedLeft = () =>
        page.evaluate(
            () =>
                !!document.querySelector(
                    '.stage .simple-html-grid-header-row-container-pinned-left [data-attribute-header="age"]'
                )
        );

    // the header label menu: Pin › Pin left
    const ageLabel = page.locator('.stage [data-attribute-header="age"]').first();
    await ageLabel.click({ button: 'right' });
    await entry('header.column.pin').click();
    await entry('header.column.pinLeft').click();
    await page.waitForTimeout(200);
    check('header menu: Pin › Pin left pins the column, the menu closes', (await pinnedLeft()) && (await menuCount()) === 0);
    await ageLabel.click({ button: 'right' });
    await entry('header.column.pin').click();
    await entry('header.column.unpin').click();
    await page.waitForTimeout(200);
    check('header menu: Pin › Unpin back', !(await pinnedLeft()));

    // the row menu: Copy › Cell Value
    const company = page.locator('.stage input[data-attribute="company"]').first();
    await company.click({ button: 'right' });
    await entry('row.copy').click();
    await entry('row.copy.cell').click();
    await page.waitForTimeout(150);
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    check(
        'row menu: Copy › Cell Value copies the value, the menu closes',
        clip === (await company.inputValue()) && (await menuCount()) === 0,
        clip
    );

    // the filter menu: Filter › Blank › Is blank. No company is blank: no rows
    const companyFilter = page.locator('.stage input[aria-label="Filter Company"]').first();
    await companyFilter.click({ button: 'right' });
    await entry('filter.filter').click();
    await entry('filter.filter.blank').click();
    await entry('filter.filter.isBlank').click();
    await page.waitForTimeout(200);
    const footer = await page.locator('.stage .simple-html-grid-footer').first().innerText();
    check(
        'filter menu: Filter › Blank › Is blank filters, the menu closes',
        /\b0\/500\b/.test(footer) && (await menuCount()) === 0,
        footer.replace(/\s+/g, ' ')
    );
    await companyFilter.click({ button: 'right' });
    await entry('filter.filter').click();
    await entry('filter.filter.clear').click();
    await page.waitForTimeout(200);
    const cleared = await page.locator('.stage .simple-html-grid-footer').first().innerText();
    check('filter menu: Filter › Clear Filter gives the rows back', /500\/500/.test(cleared), cleared.replace(/\s+/g, ' '));

    // in the window near the right and the bottom edges, a submenu open in each (the filter menu's
    // operator submenu is in its Filter submenu: both open)
    const cases = [
        { name: 'row menu, right edge', selector: '.stage input[data-attribute]', side: 'right', submenu: 'row.size' },
        {
            name: 'row menu, bottom edge',
            selector: '.stage input[data-attribute="company"]',
            side: 'bottom',
            submenu: 'row.size'
        },
        {
            name: 'header menu, right edge',
            selector: '.stage .simple-html-grid-col-cell.simple-html-label[role="columnheader"]',
            side: 'right',
            submenu: 'header.aggregate'
        },
        {
            name: 'filter menu, right edge',
            selector: '.stage input.simple-html-grid-cell-filter-input',
            side: 'right',
            submenu: ['filter.filter', 'filter.operator']
        }
    ];
    for (const [width, height] of [
        [1400, 900],
        [1250, 900]
    ]) {
        await page.setViewportSize({ width, height });
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(300);
        for (const { name, selector, side, submenu } of cases) {
            const point = await extreme(selector, side);
            if (!point) {
                check(`${width}x${height} ${name}: an element to open it on`, false);
                continue;
            }
            await page.mouse.click(point.x, point.y, { button: 'right' });
            await page.waitForTimeout(150);
            const path = [].concat(submenu);
            let opened = true;
            for (const id of path) {
                const opener = entry(id);
                if ((await opener.count()) !== 1) {
                    opened = false;
                    break;
                }
                await opener.click();
                await page.waitForTimeout(100);
            }
            if (!opened) {
                check(`${width}x${height} ${name}: opens with ${path.join(' › ')}`, false, `menus: ${await menuCount()}`);
                await page.keyboard.press('Escape');
                continue;
            }
            const menus = await inWindow();
            check(
                `${width}x${height} ${name}: the menu and its submenu${path.length > 1 ? 's' : ''} in the window`,
                menus.length === path.length + 1 && menus.every((menu) => menu.inside),
                JSON.stringify(menus.map((menu) => menu.rect))
            );
            await page.screenshot({ path: `${shots}/${width}x${height}-${name.replace(/[ ,]+/g, '-')}.png` });
            // Esc closes all; the submenu was opened with the mouse, the focus is not in it
            await page.keyboard.press('Escape');
            await page.waitForTimeout(80);
            check(`${width}x${height} ${name}: Esc closes it`, (await menuCount()) === 0);
        }
    }
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.waitForTimeout(200);

    // a click outside closes each, with a submenu open
    for (const [name, open, submenu] of [
        ['header menu', () => ageLabel.click({ button: 'right' }), 'header.size'],
        ['row menu', () => company.click({ button: 'right' }), 'row.filter'],
        ['filter menu', () => companyFilter.click({ button: 'right' }), ['filter.filter', 'filter.operator']]
    ]) {
        await open();
        const path = [].concat(submenu);
        for (const id of path) {
            await entry(id).click();
            await page.waitForTimeout(100);
        }
        const before = await menuCount();
        await page.mouse.click(5, 890);
        await page.waitForTimeout(100);
        check(
            `${name}: a click outside closes it and its submenus`,
            before === path.length + 1 && (await menuCount()) === 0,
            `open before: ${before}`
        );
    }

    check('no page errors', errors.length === 0, errors.join(' / '));
    await browser.close();
    console.log(results.join('\n'));
    const failed = results.filter((r) => r.startsWith('FAIL')).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
