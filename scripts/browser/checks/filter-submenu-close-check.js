// Real browser check: the filter menu's Filter › submenu closes when the value list is used (the user:
// "when I start using other parts of filter, then filter menu should close") - the search clicked and typed
// in, a checkbox clicked, the pointer resting on the list; it opens again on its item; the pointer moving
// from the item into the submenu keeps it. The "Filtering" sample (#sample/filtering), light and dark.
// Usage: node filter-submenu-close-check.js <site url> [shots dir]
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
        const page = await browser.newPage({ viewport: { width: 1300, height: 1000 } });
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.addInitScript((d) => localStorage.setItem('simple-html-demo-theme', d ? 'dark' : 'light'), dark);
        await page.goto(`${base}#sample/filtering`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
        await page.waitForTimeout(300);

        const menus = () => page.evaluate(() => document.querySelectorAll('.simple-html-grid-menu').length);
        const filterItem = () => page.locator('.simple-html-grid-menu [data-menu-id="filter.filter"]').first();
        const open = async () => {
            await page.keyboard.press('Escape');
            await page.locator('.stage input[aria-label="Filter Company"]').first().click({ button: 'right' });
            await page.waitForSelector('.simple-html-grid-menu [data-menu-id="filter.values"]');
            await filterItem().hover();
            await page.waitForTimeout(300);
        };

        const ids = await page.evaluate(() => [...document.querySelectorAll('[data-menu-id]')].map((e) => e.dataset.menuId));
        await page.locator('.stage input[aria-label="Filter Company"]').first().click({ button: 'right' });
        await page.waitForSelector('.simple-html-grid-menu [data-menu-id="filter.values"]');
        const shown = await page.evaluate(() =>
            [...document.querySelectorAll('.simple-html-grid-menu [data-menu-id]')].map((e) => e.dataset.menuId)
        );
        check(
            `${theme}: the filter menu has a Filter › item and the value list`,
            shown.includes('filter.filter') && shown.includes('filter.values'),
            shown.join(',') || ids.join(',')
        );

        await open();
        check(`${theme}: hovering Filter › opens its submenu`, (await menus()) === 2);

        // the search: a click into it, then typing
        const search = page
            .locator('[data-menu-id="filter.values"] input[type="text"], [data-menu-id="filter.values"] input:not([type])')
            .first();
        await search.click();
        check(`${theme}: a click in the value list's search closes the submenu at once`, (await menus()) === 1);
        await page.keyboard.type('a');
        check(`${theme}: typing in the search keeps the menu, the submenu closed`, (await menus()) === 1);

        // back on the item: open again, then a checkbox
        await filterItem().hover();
        await page.waitForTimeout(300);
        check(`${theme}: back on Filter › the submenu opens again`, (await menus()) === 2);
        await page.locator('[data-menu-id="filter.values"] input[type="checkbox"]').nth(1).click();
        check(`${theme}: a checkbox clicked closes the submenu`, (await menus()) === 1);

        // the pointer resting on the list
        await open();
        const list = await page.locator('[data-menu-id="filter.values"]').boundingBox();
        await page.mouse.move(list.x + list.width / 2, list.y + list.height / 2, { steps: 4 });
        await page.waitForTimeout(400);
        check(`${theme}: the pointer resting on the value list closes the submenu`, (await menus()) === 1);
        if (shots) {
            await page.screenshot({ path: `${shots}/${theme}-filter-submenu-closed.png` });
        }

        // from the item into the submenu: it stays
        await open();
        const item = await filterItem().boundingBox();
        const submenu = await page.locator('.simple-html-grid-menu').nth(1).boundingBox();
        await page.mouse.move(item.x + item.width - 4, item.y + item.height / 2);
        await page.mouse.move(submenu.x + 20, submenu.y + 10, { steps: 6 });
        await page.waitForTimeout(400);
        // resting on Operator in it opens that one's submenu too: two or three menus
        check(
            `${theme}: the pointer moving from the item into the submenu keeps it`,
            (await menus()) >= 2,
            `${await menus()} menus`
        );
        if (shots) {
            await page.screenshot({ path: `${shots}/${theme}-filter-submenu-open.png` });
        }
        await page.close();
    }
    check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    await browser.close();
    console.log(results.join('\n'));
    const failed = results.filter((r) => r.startsWith('FAIL')).length;
    console.log(`${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})();
