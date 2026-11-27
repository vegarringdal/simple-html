// Real browser check of multi-select with a finger (lastPress.ts, renderRowSelector.ts, columnNumbers.ts,
// Select › in contextmenuRow.ts and contextmenuColumn.ts), Chromium's touch emulation on a phone (390 x 844,
// isMobile, hasTouch) - the touches sent with CDP Input.dispatchTouchEvent, so the page gets real touch,
// pointer, mouse-compatibility and click events:
// - taps on row numbers toggle rows (the click of a tap is a PointerEvent, pointerType 'touch')
// - a long press on a row number opens the row menu, the lift selects nothing; its cell entries greyed out
// - Select › Rows from N to here, then Copy › Row usable; All rows; Clear selection
// - a range of cells: a tap on a cell (the active cell), a long press on another, Select › Range from the
//   active cell to here; Add this cell to the ranges; Copy › Range usable; Clear selection
// - taps on column numbers toggle columns, the column menu's Select ›: This column, Columns from N to
//   here, Copy selected columns usable, Clear column selection
// - light and dark screenshots
// - the mouse unchanged: a plain click replaces, Ctrl+click adds, the row number's menu, a right click's
//   active cell is the one that had the focus before it
// Usage: node touch-select-check.js <site url> [screenshot dir]
const fs = require('node:fs');
const [, , base, shots] = process.argv;
if (!base) {
    console.log('usage: node touch-select-check.js <site url> [screenshot dir]');
    process.exit(2);
}
const { chromium } = require('playwright');
if (shots) {
    fs.mkdirSync(shots, { recursive: true });
}

const results = [];
const check = (name, ok, detail = '') =>
    results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? `  (${JSON.stringify(detail)})` : ''}`);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const grid = '.stage simple-html-grid';

// the docs site is not made for a phone (its sidebar takes half of it): the grid is given the page
const PHONE_LAYOUT = `
    html, body { overflow: auto !important; height: auto !important; }
    .sidebar, .code-panel, .main-header, .demo-toolbar, .demo-log { display: none !important; }
    .app, .main { display: block !important; height: auto !important; width: auto !important; }
    .stage { display: block !important; margin: 0 8px !important; }
    .stage simple-html-grid { height: 560px !important; }
`;

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];

    /** a page of the editing sample in a new context: a phone, or a desktop with a mouse */
    const open = async ({ phone, dark }) => {
        const context = await browser.newContext(
            phone
                ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
                : { viewport: { width: 1300, height: 1000 }, deviceScaleFactor: 1 }
        );
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push(`${phone ? 'phone' : 'mouse'}: ${e}`));
        await page.addInitScript((d) => localStorage.setItem('simple-html-demo-theme', d ? 'dark' : 'light'), dark);
        await page.goto(`${base}#sample/editing`);
        await page.waitForSelector(`${grid} .simple-html-grid-col-cell`);
        if (phone) {
            await page.addStyleTag({ content: PHONE_LAYOUT });
            await page.evaluate(() => window.dispatchEvent(new Event('resize')));
        }
        await page.waitForTimeout(400);
        const cdp = await context.newCDPSession(page);
        const send = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
        const finger = {
            /** held still at (x, y) for `ms`, then lifted: 700ms is a long press */
            async hold(x, y, ms = 700) {
                await send('touchStart', [{ x, y }]);
                await page.waitForTimeout(ms);
                await send('touchEnd', []);
                await page.waitForTimeout(250);
            },
            async tap(at) {
                await page.touchscreen.tap(at.x, at.y);
                await page.waitForTimeout(200);
            }
        };
        return { page, context, finger };
    };

    const api = (page, code) =>
        page.evaluate(
            ([g, c]) => new Function('gi', `return (${c})`)(document.querySelector(g).grid.gridInterface),
            [grid, code]
        );
    const selectedRows = (page) => api(page, 'gi.getDatasource().getSelection().getSelectedRows()');
    const selectedColumns = (page) => api(page, 'gi.getSelectedColumns()');
    const ranges = (page) => api(page, 'gi.getRanges()');

    /** the middle of the `nth` element on screen that matches, and what it shows: its row ($row) */
    const centerOf = (page, selector, nth = 0) =>
        page.evaluate(
            ([s, n]) => {
                const visible = [...document.querySelectorAll(s)].filter((e) => {
                    const r = e.getBoundingClientRect();
                    return (
                        r.width > 0 &&
                        r.height > 0 &&
                        r.top >= 0 &&
                        r.bottom <= innerHeight &&
                        r.left >= 0 &&
                        r.right <= innerWidth
                    );
                });
                const el = visible[n];
                if (!el) {
                    return null;
                }
                const r = el.getBoundingClientRect();
                // a body cell, or the row number's gridcell: its parent is the cell
                const cell = el.closest('.simple-html-grid-col-cell') ?? el.parentElement;
                return { x: r.left + r.width / 2, y: r.top + r.height / 2, row: cell?.$row, field: cell?.$attribute };
            },
            [selector, nth]
        );
    const rowNumber = (page, nth) =>
        centerOf(page, `${grid} .simple-html-grid-body-row-container-selector [aria-colindex="1"]`, nth);
    const cell = (page, field, nth) => centerOf(page, `${grid} .simple-html-grid-body input[data-attribute="${field}"]`, nth);
    /** a column number on screen, by the number it shows */
    const columnNumber = (page, number) =>
        page.evaluate(
            ([g, n]) => {
                const el = [...document.querySelectorAll(`${g} .simple-html-grid-header [type="selector"]`)].find((e) => {
                    const r = e.getBoundingClientRect();
                    return e.textContent.trim() === String(n) && r.width > 0 && r.left >= 0 && r.right <= innerWidth;
                });
                const r = el?.getBoundingClientRect();
                return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
            },
            [grid, number]
        );
    /** the open menus: their entries, `!` in front of a greyed out one, `✓` in front of a checked one */
    const menus = (page) =>
        page.evaluate(() =>
            [...document.querySelectorAll('.simple-html-grid-menu[role="menu"]')].map((m) =>
                [...m.querySelectorAll('[data-menu-id]')].map(
                    (e) =>
                        `${e.getAttribute('aria-disabled') === 'true' ? '!' : ''}${e.getAttribute('aria-checked') === 'true' ? '✓' : ''}${e.dataset.menuId}`
                )
            )
        );
    const entryText = (page, id) =>
        page.evaluate((i) => document.querySelector(`[data-menu-id="${i}"]`)?.textContent.replace(/\s+/g, ' ').trim(), id);
    const entryDisabled = (page, id) =>
        page.evaluate((i) => document.querySelector(`[data-menu-id="${i}"]`)?.getAttribute('aria-disabled') === 'true', id);
    const entryAt = async (page, id) => {
        await page.evaluate((i) => document.querySelector(`[data-menu-id="${i}"]`)?.scrollIntoView({ block: 'nearest' }), id);
        await page.waitForTimeout(50);
        return centerOf(page, `[data-menu-id="${id}"]`);
    };
    const closeMenus = async (page) => {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
    };
    const shot = async (page, name) => {
        if (shots) {
            await page.screenshot({ path: `${shots}/${name}.png` });
        }
    };

    await (async () => {
        // ------------------------------------------------------------ the phone, light and dark
        for (const dark of [false, true]) {
            const theme = dark ? 'dark' : 'light';
            const { page, context, finger } = await open({ phone: true, dark });
            /** taps the entry `id` of the open menu (a submenu's opener opens it) */
            const tapEntry = async (id) => {
                const at = await entryAt(page, id);
                await finger.tap(at);
            };

            // a long press on a cell before anything is selected: Copy › Row greyed out
            let at = await cell(page, 'company', 2);
            await finger.hold(at.x, at.y);
            await tapEntry('row.copy');
            check(`${theme}: nothing selected: Copy › Row greyed out`, await entryDisabled(page, 'row.copy.row'));
            await closeMenus(page);

            // taps on row numbers toggle
            const r1 = await rowNumber(page, 1);
            const r3 = await rowNumber(page, 3);
            await finger.tap(r1);
            await finger.tap(r3);
            check(
                `${theme}: taps on two row numbers: both selected`,
                same(await selectedRows(page), [r1.row, r3.row]),
                await selectedRows(page)
            );
            await finger.tap(r1);
            check(
                `${theme}: a tap on a selected row number: out again, the other stays`,
                same(await selectedRows(page), [r3.row]),
                await selectedRows(page)
            );
            await shot(page, `${theme}-phone-taps`);

            // a long press on a row number: the row menu, the lift no tap
            const r5 = await rowNumber(page, 5);
            await finger.hold(r5.x, r5.y);
            let open1 = await menus(page);
            check(
                `${theme}: long press on a row number: the row menu`,
                open1.length === 1 && open1[0].includes('row.select'),
                open1
            );
            check(
                `${theme}: long press on a row number: the lift selects nothing`,
                same(await selectedRows(page), [r3.row]),
                await selectedRows(page)
            );
            await tapEntry('row.select');
            open1 = await menus(page);
            check(
                // on a row number the cell entries are left out (visible), not greyed out: commit 26101022, guide 10
                `${theme}: Select ›: its entries, none of the cell's on a row number`,
                same(open1[1], [
                    'row.select.row',
                    'row.select.rowsTo',
                    'row.select.allRows',
                    'row.select.clearSeparator',
                    'row.select.clear'
                ]),
                open1[1]
            );
            // the anchor: the row tapped last - in or out, as Ctrl+click
            check(
                `${theme}: Rows from N to here: N the row tapped last`,
                (await entryText(page, 'row.select.rowsTo')) === `Rows from ${r1.row + 1} to here`,
                await entryText(page, 'row.select.rowsTo')
            );
            await shot(page, `${theme}-phone-row-number-select`);
            await tapEntry('row.select.rowsTo');
            // added to the row tapped before
            const range15 = Array.from({ length: r5.row - r1.row + 1 }, (_, i) => r1.row + i);
            check(
                `${theme}: Rows from N to here: the rows from the anchor`,
                same(await selectedRows(page), range15),
                await selectedRows(page)
            );
            check(`${theme}: the menu closed`, (await menus(page)).length === 0);

            // Copy › Row usable now
            at = await cell(page, 'company', 2);
            await finger.hold(at.x, at.y);
            await tapEntry('row.copy');
            check(`${theme}: rows selected: Copy › Row usable`, !(await entryDisabled(page, 'row.copy.row')));
            await closeMenus(page);

            // This row on a row number: out
            await finger.hold(r5.x, r5.y);
            await tapEntry('row.select');
            check(
                `${theme}: This row: a ✓ on a selected row`,
                (await menus(page))[1].includes('✓row.select.row'),
                (await menus(page))[1]
            );
            await tapEntry('row.select.row');
            check(
                `${theme}: This row: the row out`,
                same(await selectedRows(page), range15.slice(0, -1)),
                await selectedRows(page)
            );

            // All rows, then Clear selection
            await finger.hold(r5.x, r5.y);
            await tapEntry('row.select');
            await tapEntry('row.select.allRows');
            const count = await api(page, 'gi.getDatasource().getRows().length');
            check(`${theme}: All rows`, (await selectedRows(page)).length === count, [(await selectedRows(page)).length, count]);
            await finger.hold(r5.x, r5.y);
            await tapEntry('row.select');
            await tapEntry('row.select.clear');
            check(`${theme}: Clear selection: no row selected`, (await selectedRows(page)).length === 0);

            // a range of cells: a tap on a cell (the active cell), a long press on another
            const a = await cell(page, 'company', 1);
            const b = await cell(page, 'country', 4);
            await finger.tap(a);
            await finger.hold(b.x, b.y);
            await tapEntry('row.select');
            check(
                `${theme}: on a cell: Range from the active cell to here usable`,
                !(await entryDisabled(page, 'row.select.rangeTo'))
            );
            await shot(page, `${theme}-phone-cell-select`);
            await tapEntry('row.select.rangeTo');
            check(
                `${theme}: Range from the active cell to here`,
                same(await ranges(page), [{ fromRow: a.row, fromField: 'company', toRow: b.row, toField: 'country' }]),
                await ranges(page)
            );
            const inRange = await page.evaluate((g) => document.querySelectorAll(`${g} .simple-html-cell-in-range`).length, grid);
            check(`${theme}: the cells of the range shown`, inRange >= (b.row - a.row + 1) * 2, inRange);
            await shot(page, `${theme}-phone-range`);

            // Add this cell, then Copy › Range usable
            const c = await cell(page, 'company', 6);
            await finger.hold(c.x, c.y);
            await tapEntry('row.select');
            await tapEntry('row.select.addCell');
            const two = await ranges(page);
            check(
                `${theme}: Add this cell to the ranges`,
                two.length === 2 && same(two[1], { fromRow: c.row, fromField: 'company', toRow: c.row, toField: 'company' }),
                two
            );
            await finger.hold(c.x, c.y);
            await tapEntry('row.copy');
            check(`${theme}: ranges: Copy › Range usable`, !(await entryDisabled(page, 'row.copy.range')));
            await closeMenus(page);
            await finger.hold(c.x, c.y);
            await tapEntry('row.select');
            check(`${theme}: Add this cell greyed out on a cell in a range`, await entryDisabled(page, 'row.select.addCell'));
            await tapEntry('row.select.clear');
            check(`${theme}: Clear selection: no range`, (await ranges(page)).length === 0, await ranges(page));

            // the column numbers
            await finger.tap(await columnNumber(page, 1));
            await finger.tap(await columnNumber(page, 2));
            check(
                `${theme}: taps on two column numbers: both selected`,
                same(await selectedColumns(page), [1, 2]),
                await selectedColumns(page)
            );
            await finger.tap(await columnNumber(page, 1));
            check(
                `${theme}: a tap on a selected column number: out again`,
                same(await selectedColumns(page), [2]),
                await selectedColumns(page)
            );
            const two2 = await columnNumber(page, 2);
            await finger.hold(two2.x, two2.y);
            let open2 = await menus(page);
            check(
                `${theme}: long press on a column number: the column menu, Select › first`,
                open2.length === 1 && open2[0][0] === 'column.select',
                open2
            );
            await tapEntry('column.select');
            open2 = await menus(page);
            check(
                `${theme}: the column Select ›`,
                same(open2[1], ['✓column.select.column', 'column.select.columnsTo', 'column.select.all', 'column.select.clear']),
                open2[1]
            );
            check(
                `${theme}: Columns from N to here: N the column tapped last`,
                (await entryText(page, 'column.select.columnsTo')) === 'Columns from 1 to here',
                await entryText(page, 'column.select.columnsTo')
            );
            await shot(page, `${theme}-phone-column-select`);
            await tapEntry('column.select.columnsTo');
            check(`${theme}: Columns from N to here`, same(await selectedColumns(page), [1, 2]), await selectedColumns(page));
            await finger.hold(two2.x, two2.y);
            check(
                `${theme}: columns selected: Copy selected columns usable`,
                !(await entryDisabled(page, 'column.copy.selectedColumns'))
            );
            await tapEntry('column.select');
            await tapEntry('column.select.clear');
            check(`${theme}: Clear column selection`, same(await selectedColumns(page), []), await selectedColumns(page));

            await context.close();
        }

        // ------------------------------------------------------------ the mouse, as it was
        {
            const { page, context } = await open({ phone: false, dark: false });
            const r1 = await rowNumber(page, 1);
            const r3 = await rowNumber(page, 3);
            await page.mouse.click(r1.x, r1.y);
            await page.mouse.click(r3.x, r3.y);
            check(
                'mouse: a click on a row number replaces the selection',
                same(await selectedRows(page), [r3.row]),
                await selectedRows(page)
            );
            await page.keyboard.down('Control');
            await page.mouse.click(r1.x, r1.y);
            await page.keyboard.up('Control');
            check('mouse: Ctrl+click adds', same(await selectedRows(page), [r1.row, r3.row]), await selectedRows(page));
            await page.mouse.click(await columnNumber(page, 1).then((p) => p.x), await columnNumber(page, 1).then((p) => p.y));
            const c2 = await columnNumber(page, 2);
            await page.mouse.click(c2.x, c2.y);
            check(
                'mouse: a click on a column number replaces',
                same(await selectedColumns(page), [2]),
                await selectedColumns(page)
            );

            // a right click on a row number: the row menu without a cell
            await page.mouse.click(r3.x, r3.y, { button: 'right' });
            await page.waitForTimeout(150);
            const open3 = await menus(page);
            check(
                'mouse: a right click on a row number: the row menu',
                open3.length === 1 && open3[0].includes('row.select'),
                open3
            );
            const copy = await entryAt(page, 'row.copy');
            await page.mouse.move(copy.x, copy.y);
            await page.waitForTimeout(300);
            const copyIds = (await menus(page))[1] ?? [];
            check(
                // left out on a row number, see Select › above
                'mouse: on a row number Copy › has no Cell Value and Column, Row usable',
                !copyIds.some((id) => /row\.copy\.(cell|column)$/.test(id.replace(/^[!✓]+/, ''))) &&
                    copyIds.includes('row.copy.row'),
                copyIds
            );
            await shot(page, 'mouse-row-number-menu');
            await closeMenus(page);

            // a right click on a cell: the active cell is the one with the focus before it
            const a = await cell(page, 'company', 1);
            const b = await cell(page, 'age', 3);
            await page.mouse.click(a.x, a.y);
            await page.mouse.click(b.x, b.y, { button: 'right' });
            await page.waitForTimeout(150);
            const select = await entryAt(page, 'row.select');
            await page.mouse.move(select.x, select.y);
            await page.waitForTimeout(300);
            check(
                'mouse: a right click on another cell: Range from the active cell to here usable',
                !(await entryDisabled(page, 'row.select.rangeTo'))
            );
            await shot(page, 'mouse-cell-select');
            const rangeTo = await entryAt(page, 'row.select.rangeTo');
            await page.mouse.click(rangeTo.x, rangeTo.y);
            await page.waitForTimeout(150);
            check(
                'mouse: Range from the active cell to here: from the cell clicked before',
                same(await ranges(page), [{ fromRow: a.row, fromField: 'company', toRow: b.row, toField: 'age' }]),
                await ranges(page)
            );
            // Shift+click still works as it did
            const d = await cell(page, 'age', 5);
            await page.keyboard.down('Shift');
            await page.mouse.click(d.x, d.y);
            await page.keyboard.up('Shift');
            check(
                'mouse: Shift+click after it moves the end of the range',
                same(await ranges(page), [{ fromRow: a.row, fromField: 'company', toRow: d.row, toField: 'age' }]),
                await ranges(page)
            );
            await context.close();
        }
    })().catch((e) => errors.push(`the check stopped: ${e.stack}`));
    await browser.close();
    for (const line of results) {
        console.log(line);
    }
    for (const error of errors) {
        console.log(`ERROR  ${error}`);
    }
    const failed = results.filter((line) => line.startsWith('FAIL')).length;
    console.log(`\n${results.length - failed}/${results.length} passed${errors.length ? `, ${errors.length} page errors` : ''}`);
    process.exit(failed || errors.length ? 1 : 0);
})();
