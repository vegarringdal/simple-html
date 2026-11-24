// Real browser check of the edit permissions (GridConfig.edit, editPermissions.ts) on the "Edit
// permissions" sample (#sample/edit-permissions), light and dark. It starts as add only
// ({ add: true, change: false, delete: false }):
//
// - a row that was there: real typing writes nothing (the input is readonly), Ctrl+V of a block writes
//   nothing, Ctrl+D fills nothing, the row menu's Paste cell / Clear cell and Delete › Row are greyed out,
//   the detail form's field is readonly, Delete on its row number marks nothing
// - "Add new row": the new row is typed into, Ctrl+D fills it from the row above, Ctrl+V pastes into it,
//   its detail form field takes typing, its row menu entries are usable; Delete on its number takes it
//   out, Ctrl+Z brings it back
// - the buttons as a developer sets them: change allowed -> typing a row that was there writes; delete
//   allowed -> Delete › Row usable; add and change off -> the new row readonly, no Paste › / Clear ›, the
//   add button disabled; "Save" (acceptChanges) -> the new row is locked as the rest
// - screenshots of the grid and of the row menu, light and dark
//
// Usage: node edit-permissions-check.js <site url> [screenshot dir]
const path = require('node:path');
const fs = require('node:fs');
const [, , base, shots] = process.argv;
if (!base) {
    console.log('usage: node edit-permissions-check.js <site url> [screenshot dir]');
    process.exit(2);
}
const { chromium } = require('playwright');
// a column's settings are in tabs: an element of a hidden one, its tab clicked first
require('../sections')();
if (shots) {
    fs.mkdirSync(shots, { recursive: true });
}

const results = [];
const check = (name, ok, detail = '') =>
    results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? `  (${JSON.stringify(detail)})` : ''}`);

const GRID = '.stage simple-html-grid';

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];
    for (const theme of ['light', 'dark']) {
        const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
        await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(base).origin });
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push(`${theme}: ${e}`));
        page.on('console', (m) => m.type() === 'error' && errors.push(`${theme} console: ${m.text()}`));
        await page.addInitScript((t) => {
            localStorage.setItem('simple-html-demo-theme', t);
            localStorage.setItem('simple-html-demo-grid-theme', 'default');
        }, theme);
        await page.goto(`${base}#sample/edit-permissions`);
        await page.waitForSelector(`${GRID} .simple-html-grid-col-cell`);
        await page.waitForTimeout(400);
        const t = (name) => `${theme}: ${name}`;

        // the datasource of the sample's grid, a row's value
        const value = (row, field) =>
            page.evaluate(
                ([r, f]) => {
                    const v = document.querySelector('.stage simple-html-grid').grid.gridInterface.getDatasource().getRows()[r]?.[
                        f
                    ];
                    return v instanceof Date ? v.toISOString() : (v ?? null);
                },
                [row, field]
            );
        const rowState = (row) =>
            page.evaluate(
                (r) =>
                    document.querySelector('.stage simple-html-grid').grid.gridInterface.getDatasource().getRows()[r]
                        ?.__rowState ?? '-',
                row
            );
        const rowCount = () =>
            page.evaluate(() => document.querySelector('.stage simple-html-grid').grid.gridInterface.getDatasource().length());
        // the input of a cell on screen
        const input = (row, field) =>
            page.evaluateHandle(
                ([r, f]) =>
                    [...document.querySelectorAll(`.stage input[data-attribute="${f}"]`)].find(
                        (i) => i.closest('.simple-html-grid-col-cell').$row === r && i.offsetParent
                    ),
                [row, field]
            );
        const number = (row) =>
            page.evaluateHandle(
                (r) =>
                    [
                        ...document.querySelectorAll(
                            '.stage .simple-html-grid-body-row-container-selector > .simple-html-grid-row'
                        )
                    ].find((el) => el.$row === r && el.style.display !== 'none')?.firstElementChild,
                row
            );
        const permission = (name) => page.locator(`.stage .demo-toolbar button[data-permission="${name}"]`);
        const button = (text) => page.locator('.stage .demo-toolbar button', { hasText: text });
        const formControl = (field) => page.locator(`${GRID} .simple-html-grid-detail-form [data-field="${field}"] input`);
        // the row menu of a cell: the ids shown at the top, and whether an entry is greyed out
        const openMenu = async (row, field) => {
            await page.keyboard.press('Escape');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(80);
            await (await input(row, field)).click({ button: 'right' });
            await page.waitForSelector('.simple-html-grid-popover .simple-html-grid-menu');
            return page.$$eval('.simple-html-grid-popover > .simple-html-grid-menu > [data-menu-id]', (items) =>
                items.filter((item) => item.offsetParent !== null).map((item) => item.getAttribute('data-menu-id'))
            );
        };
        const openSubmenu = async (id) => {
            await page.hover(`.simple-html-grid-popover [data-menu-id="${id}"]`, { timeout: 3000 });
            await page.waitForTimeout(300);
        };
        const disabled = (id) =>
            page.$eval(`.simple-html-grid-popover [data-menu-id="${id}"]`, (el) =>
                el.classList.contains('simple-html-grid-menu-item-disabled')
            );
        const closeMenus = async () => {
            await page.keyboard.press('Escape');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(80);
        };
        const writeClipboard = (text) => page.evaluate((x) => navigator.clipboard.writeText(x), text);

        const labels = await page.$$eval('.stage .demo-toolbar button[data-permission]', (bs) => bs.map((b) => b.textContent));
        check(
            t('the permission buttons: add only'),
            labels.join('|') === 'add: allowed|change: not allowed|delete: not allowed',
            labels
        );

        // ---- a row that was there: nothing changes
        const company1 = await value(1, 'company');
        await (await input(1, 'company')).click();
        await page.keyboard.type('XYZ');
        await page.waitForTimeout(100);
        check(
            t('typing in a row that was there writes nothing'),
            (await value(1, 'company')) === company1,
            await value(1, 'company')
        );
        check(t('its input is readonly'), await (await input(1, 'company')).evaluate((i) => i.readOnly));

        const age1 = await value(1, 'age');
        await writeClipboard('PASTED\tNorway\t99');
        await (await input(1, 'company')).click();
        await page.keyboard.press('Control+v');
        await page.waitForTimeout(150);
        check(
            t('Ctrl+V of a block writes nothing into rows that were there'),
            (await value(1, 'company')) === company1 && (await value(1, 'age')) === age1,
            [await value(1, 'company'), await value(1, 'age')]
        );
        await page.keyboard.press('Escape');
        await (await input(1, 'company')).click();
        await page.keyboard.press('Control+d');
        await page.waitForTimeout(150);
        check(
            t('Ctrl+D fills nothing into a row that was there'),
            (await value(1, 'company')) === company1,
            await value(1, 'company')
        );

        let ids = await openMenu(1, 'company');
        check(
            t('the row menu: Undo / Redo, Paste, Clear, Delete listed'),
            ['row.edit', 'row.paste', 'row.clear', 'row.delete'].every((id) => ids.includes(id)),
            ids
        );
        await openSubmenu('row.paste');
        check(t('Paste › Paste cell greyed out on a row that was there'), await disabled('row.paste.current'));
        await openMenu(1, 'company');
        await openSubmenu('row.clear');
        check(t('Clear › Clear cell greyed out on a row that was there'), await disabled('row.clear.current'));
        await openMenu(1, 'company');
        await openSubmenu('row.delete');
        check(t('Delete › Row greyed out on a row that was there'), await disabled('row.delete.row'));
        if (shots) {
            await page.screenshot({ path: `${shots}/edit-permissions-menu-${theme}.png` });
        }
        await closeMenus();

        // the detail form: the current row is row 1 (clicked)
        check(
            t('the detail form field of a row that was there is readonly'),
            await formControl('company').evaluate((i) => i.readOnly)
        );
        await formControl('company').click();
        await page.keyboard.type('FORM');
        await page.waitForTimeout(100);
        check(t('typing in the detail form writes nothing'), (await value(1, 'company')) === company1, await value(1, 'company'));

        await (await number(1)).click();
        await page.keyboard.press('Delete');
        await page.waitForTimeout(150);
        check(
            t('Delete on the row number of a row that was there marks nothing'),
            (await rowState(1)) === '-',
            await rowState(1)
        );

        // ---- a new row: filled in
        await button('Add new row').click();
        await page.waitForTimeout(300);
        const last = (await rowCount()) - 1;
        check(t('Add new row: a new row at the end'), (await rowState(last)) === 'N', await rowState(last));
        const newCompany = await input(last, 'company');
        await newCompany.click();
        await page.keyboard.press('Control+a');
        await page.keyboard.type('NEW CO');
        await page.waitForTimeout(100);
        check(t('typing in the new row writes'), (await value(last, 'company')) === 'NEW CO', await value(last, 'company'));
        await (await input(last, 'country')).click();
        await page.keyboard.press('Control+d');
        await page.waitForTimeout(150);
        const above = await value(last - 1, 'country');
        check(t('Ctrl+D fills the new row from the row above'), (await value(last, 'country')) === above, [
            await value(last, 'country'),
            above
        ]);
        await writeClipboard('42');
        await (await input(last, 'age')).click();
        await page.keyboard.press('Control+a');
        await page.keyboard.press('Control+v');
        await page.waitForTimeout(150);
        check(t('Ctrl+V into the new row writes'), (await value(last, 'age')) === 42, await value(last, 'age'));

        check(t('the detail form field of the new row is editable'), !(await formControl('company').evaluate((i) => i.readOnly)));
        await formControl('company').click();
        await page.keyboard.press('End');
        await page.keyboard.type(' AS');
        await page.waitForTimeout(100);
        check(
            t('typing in the detail form of the new row writes'),
            (await value(last, 'company')) === 'NEW CO AS',
            await value(last, 'company')
        );

        ids = await openMenu(last, 'company');
        await openSubmenu('row.paste');
        check(t('Paste › Paste cell usable on the new row'), !(await disabled('row.paste.current')));
        await openMenu(last, 'company');
        await openSubmenu('row.delete');
        check(t('Delete › Row usable on the new row'), !(await disabled('row.delete.row')));
        await closeMenus();

        if (shots) {
            const box = await page.locator(GRID).boundingBox();
            await page.screenshot({
                path: `${shots}/edit-permissions-${theme}.png`,
                clip: { x: box.x, y: box.y, width: box.width, height: box.height }
            });
        }

        await (await number(last)).click();
        await page.keyboard.press('Delete');
        await page.waitForTimeout(150);
        check(t('Delete on the number of the new row takes it out'), (await rowState(last)) === 'D', await rowState(last));
        await page.keyboard.press('Control+z');
        await page.waitForTimeout(150);
        check(t('Ctrl+Z on the number brings it back'), (await rowState(last)) === 'N', await rowState(last));

        // ---- the buttons, as a developer sets the permissions
        await permission('change').click();
        await page.waitForTimeout(150);
        await (await input(last - 1, 'company')).click();
        await page.keyboard.press('End');
        await page.keyboard.type('!');
        await page.waitForTimeout(100);
        check(
            t('change allowed: typing in a row that was there writes'),
            String(await value(last - 1, 'company')).endsWith('!'),
            await value(last - 1, 'company')
        );
        await page.keyboard.press('Control+z');
        await page.keyboard.press('Escape');
        await permission('change').click();
        await page.waitForTimeout(150);

        await permission('delete').click();
        await page.waitForTimeout(150);
        await openMenu(last - 1, 'company');
        await openSubmenu('row.delete');
        check(t('delete allowed: Delete › Row usable on a row that was there'), !(await disabled('row.delete.row')));
        await closeMenus();
        await permission('delete').click();
        await page.waitForTimeout(150);

        await permission('add').click();
        await page.waitForTimeout(150);
        check(t('add and change off: the new row readonly'), await (await input(last, 'company')).evaluate((i) => i.readOnly));
        check(t('add off: the add button disabled'), await button('Add new row').isDisabled());
        ids = await openMenu(last, 'company');
        check(
            t('add and change off: no Paste › and Clear ›'),
            !ids.includes('row.paste') && !ids.includes('row.clear') && ids.includes('row.delete'),
            ids
        );
        await closeMenus();
        await permission('add').click();
        await page.waitForTimeout(150);

        await button('Save').click();
        await page.waitForTimeout(200);
        check(
            t('Save: the new row is a row that was there, locked'),
            (await rowState(last)) === '-' && (await (await input(last, 'company')).evaluate((i) => i.readOnly))
        );

        await context.close();
    }
    check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    await browser.close();
    console.log(results.join('\n'));
    const failed = results.filter((r) => r.startsWith('FAIL')).length;
    console.log(`${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})();
