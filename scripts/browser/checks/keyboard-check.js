// Real browser check of the keyboard of a spreadsheet (jumpKeys.ts, tabExit.ts, undoRedoKey.ts, keyText.ts):
// - Home / End move the caret in the cell's input (the real default action), the focus stays
// - Ctrl+End to the last cell of row 500 and Ctrl+Home back, scrolled to and on screen, pinned sections too
// - PageDown / PageUp a page of rows, the same column, the rows scroll as far; Alt+Home / Alt+End; Ctrl+ArrowDown
// - Shift+PageDown, Ctrl+Shift+End extend a range, the focus stays
// - from a header filter: PageDown, Alt+End, Ctrl+End
// - Ctrl+Z after an edit off screen: the focus goes there; Ctrl+Y
// - the group rows' buttons and the footer's buttons on the way of Tab, out of the grid after them
// - the hints of the row menu: Ctrl+Z / Ctrl+Y here, ⌘Z / ⇧⌘Z with the platform of a Mac
// Usage: node keyboard-check.js <site url> [screenshot dir]
const [, , base, shots] = process.argv;
const { chromium } = require('playwright');

const results = [];
const check = (name, ok, detail = '') =>
    results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${JSON.stringify(detail)})` : ''}`);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const grid = '.stage simple-html-grid';

(async () => {
    const browser = await chromium.launch({
        executablePath: process.env.CHROMIUM_PATH || undefined,
        args: ['--no-sandbox'],
        ignoreDefaultArgs: ['--hide-scrollbars']
    });
    // the scrollbars shown, as in a browser on a screen: headless hides them, and the middle scroller is then
    // 10px taller than the rows (its horizontal scrollbar takes no room)
    const errors = [];

    /** a page of a sample, `mac`: the platform of a Mac (navigator.platform and userAgentData) */
    const open = async (sample, mac = false) => {
        const page = await browser.newPage({ viewport: { width: 1300, height: 1400 }, deviceScaleFactor: 1 });
        page.on('pageerror', (e) => errors.push(`${sample}: ${e}`));
        if (mac) {
            await page.addInitScript(() => {
                Object.defineProperty(Navigator.prototype, 'platform', { configurable: true, get: () => 'MacIntel' });
                Object.defineProperty(Navigator.prototype, 'userAgentData', {
                    configurable: true,
                    get: () => ({ platform: 'macOS' })
                });
            });
        }
        await page.goto(`${base}#sample/${sample}`);
        await page.waitForSelector(`${grid} .simple-html-grid-col-cell`);
        await page.waitForTimeout(300);
        return page;
    };

    /** where the focus is: the cell (row, field), on screen inside the rows' view, and the caret */
    const active = (page) =>
        page.evaluate((g) => {
            const el = document.activeElement;
            const cell = el?.closest('.simple-html-grid-col-cell');
            const body = document.querySelector(`${g} .simple-html-grid-body`).getBoundingClientRect();
            const rect = el?.getBoundingClientRect();
            return {
                inGrid: !!el && document.querySelector(g).contains(el),
                row: cell?.$row,
                field: cell?.$attribute ?? null,
                filter: cell?.getAttribute('type') === 'filter',
                onScreen: !!rect && rect.height > 0 && rect.top >= body.top - 1 && rect.bottom <= body.bottom + 1,
                caret: el instanceof HTMLInputElement && el.type === 'text' ? el.selectionStart : null,
                length: el instanceof HTMLInputElement ? el.value.length : null,
                label: el?.getAttribute('aria-label'),
                className: typeof el?.className === 'string' ? el.className : ''
            };
        }, grid);
    const scroll = (page) =>
        page.evaluate((g) => {
            const body = document.querySelector(`${g} .simple-html-grid-body-scroller`);
            const middle = document.querySelector(`${g} .simple-html-grid-middle-scroller`);
            return {
                top: body.scrollTop,
                max: body.scrollHeight - body.clientHeight,
                left: middle.scrollLeft,
                maxLeft: middle.scrollWidth - middle.clientWidth
            };
        }, grid);
    const api = (page, code) =>
        page.evaluate(
            ([g, c]) => new Function('gi', `return (${c})`)(document.querySelector(g).grid.gridInterface),
            [grid, code]
        );
    /** clicks the input of a cell on screen */
    const clickCell = async (page, row, field) => {
        const box = await page.evaluate(
            ([g, r, f]) => {
                const input = [...document.querySelectorAll(`${g} [data-attribute="${f}"]`)].find(
                    (i) => i.closest('.simple-html-grid-col-cell')?.$row === r && i.offsetParent !== null
                );
                const rect = input.getBoundingClientRect();
                return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
            },
            [grid, row, field]
        );
        await page.mouse.click(box.x, box.y);
        await page.waitForTimeout(150);
    };
    const press = async (page, key, wait = 120) => {
        await page.keyboard.press(key);
        await page.waitForTimeout(wait);
    };
    const shot = async (page, name) => {
        if (shots) {
            const box = await page.locator(grid).boundingBox();
            await page.screenshot({
                path: `${shots}/${name}.png`,
                clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 700) }
            });
        }
    };

    // ------------------------------------------------------------------ the editing sample: 500 rows
    {
        const page = await open('editing');
        const url = page.url();

        await clickCell(page, 2, 'company');
        let a = await active(page);
        check('a click focuses the cell', a.row === 2 && a.field === 'company', a);

        // Home / End: the caret, the focus stays
        await press(page, 'End');
        a = await active(page);
        check(
            'End moves the caret to the end of the text, the focus stays',
            a.row === 2 && a.field === 'company' && a.caret === a.length && a.length > 0,
            a
        );
        await press(page, 'Home');
        a = await active(page);
        check('Home moves the caret to the start, the focus stays', a.row === 2 && a.field === 'company' && a.caret === 0, a);
        await press(page, 'Shift+End');
        const selected = await page.evaluate(() => [
            document.activeElement.selectionStart,
            document.activeElement.selectionEnd,
            document.activeElement.value.length
        ]);
        check('Shift+End selects the text to the end', selected[0] === 0 && selected[1] === selected[2], selected);
        await press(page, 'ArrowRight');

        // Ctrl+End / Ctrl+Home
        await press(page, 'Control+End');
        a = await active(page);
        let s = await scroll(page);
        check('Ctrl+End: the last cell of row 500', a.row === 499 && a.field === 'phone', a);
        check('Ctrl+End: scrolled to the bottom, the cell on screen', a.onScreen && Math.abs(s.top - s.max) <= 1, { a, s });
        check(
            'Ctrl+End: the current row is row 500',
            (await api(page, 'gi.getDatasource().getRows().indexOf(gi.getDatasource().currentEntity)')) === 499
        );
        await shot(page, 'ctrl-end');
        await press(page, 'Control+Home');
        a = await active(page);
        s = await scroll(page);
        check(
            'Ctrl+Home: the first cell of row 1, scrolled to the top',
            a.row === 0 && a.field === 'company' && s.top === 0 && a.onScreen,
            { a, s }
        );
        check('Alt+Home / Ctrl+Home did not leave the page', page.url() === url, page.url());

        // PageDown / PageUp
        await clickCell(page, 3, 'age');
        const before = await page.evaluate((g) => {
            const el = document.activeElement.getBoundingClientRect();
            return el.top;
        }, grid);
        await press(page, 'PageDown');
        a = await active(page);
        s = await scroll(page);
        const after = await page.evaluate(() => document.activeElement.getBoundingClientRect().top);
        check('PageDown: a page of rows down, the same column, on screen', a.row > 10 && a.field === 'age' && a.onScreen, a);
        check('PageDown: the rows scrolled as far, the cell where it was on screen', s.top > 0 && Math.abs(after - before) < 23, {
            before,
            after,
            s
        });
        await shot(page, 'page-down');
        const down = a.row;
        await press(page, 'PageDown');
        a = await active(page);
        check('PageDown again: another page', a.row > down && a.field === 'age' && a.onScreen, a);
        await press(page, 'PageUp');
        await press(page, 'PageUp');
        a = await active(page);
        s = await scroll(page);
        check('PageUp twice: back to row 4', a.row === 3 && a.field === 'age' && s.top === 0, { a, s });

        // Alt+End / Alt+Home, Ctrl+ArrowDown
        await press(page, 'Alt+End');
        a = await active(page);
        check('Alt+End: the last cell of the row', a.row === 3 && a.field === 'phone' && a.onScreen, a);
        await press(page, 'Alt+Home');
        a = await active(page);
        check('Alt+Home: the first cell of the row', a.row === 3 && a.field === 'company', a);
        await press(page, 'Control+ArrowDown');
        a = await active(page);
        check(
            'Ctrl+ArrowDown: the edge of the data, the last row of a full column',
            a.row === 499 && a.field === 'company' && a.onScreen,
            a
        );
        await press(page, 'Control+ArrowUp');
        a = await active(page);
        check('Ctrl+ArrowUp: the first row', a.row === 0 && a.field === 'company', a);
        await press(page, 'Control+ArrowRight');
        a = await active(page);
        check(
            'Ctrl+ArrowRight: the input moves the caret a word, the focus stays',
            a.row === 0 && a.field === 'company' && a.caret > 0,
            a
        );

        // the ranges
        await clickCell(page, 2, 'country');
        await press(page, 'Shift+PageDown');
        let ranges = await api(page, 'gi.getRanges()');
        a = await active(page);
        check(
            'Shift+PageDown: a range a page down, the focus stays',
            ranges.length === 1 && ranges[0].fromRow === 2 && ranges[0].toRow > 10 && a.row === 2,
            { ranges, a }
        );
        await shot(page, 'shift-page-down');
        await press(page, 'Control+Shift+End');
        ranges = await api(page, 'gi.getRanges()');
        check(
            'Ctrl+Shift+End: the range to the last cell of the last row',
            same(ranges, [{ fromRow: 2, fromField: 'country', toRow: 499, toField: 'phone' }]),
            ranges
        );
        a = await active(page);
        check(
            'Ctrl+Shift+End: the active cell scrolled away, the focus at the end of the range, in the grid',
            a.row === 499 && a.field === 'phone' && a.onScreen,
            a
        );
        await shot(page, 'ctrl-shift-end');
        // the keys go on working from there
        await press(page, 'Shift+PageUp');
        ranges = await api(page, 'gi.getRanges()');
        check(
            'Shift+PageUp from there: the end a page up, the range stays',
            ranges.length === 1 && ranges[0].fromRow === 2 && ranges[0].toRow < 499 && ranges[0].toRow > 400,
            ranges
        );
        const summary = await page.evaluate(
            (g) => document.querySelector(`${g} .footer-summary`)?.textContent?.replace(/\s+/g, ' ').trim(),
            grid
        );
        check('the footer sums up the range', /Count/.test(summary ?? ''), summary);
        await press(page, 'Escape');

        // undo goes to what changed, off screen
        await press(page, 'Control+End');
        await page.keyboard.type('7');
        await page.waitForTimeout(100);
        const typed = await api(page, 'gi.getDatasource().getRows()[499].phone');
        await press(page, 'Control+Home');
        a = await active(page);
        check('typed in the last cell, Ctrl+Home back to the top', a.row === 0 && typed.endsWith('7'), { a, typed });
        await press(page, 'Control+z');
        a = await active(page);
        s = await scroll(page);
        const undone = await api(page, 'gi.getDatasource().getRows()[499].phone');
        check(
            'Ctrl+Z: undone, the focus on the cell it changed, scrolled to it',
            !undone.endsWith('7') && a.row === 499 && a.field === 'phone' && a.onScreen && s.top > 0,
            { a, undone, s }
        );
        await shot(page, 'undo-focus');
        await press(page, 'Control+Home');
        await press(page, 'Control+y');
        a = await active(page);
        const redone = await api(page, 'gi.getDatasource().getRows()[499].phone');
        check(
            'Ctrl+Y: redone, the focus there again',
            redone.endsWith('7') && a.row === 499 && a.field === 'phone' && a.onScreen,
            { a, redone }
        );

        // the row menu's Undo from row 1: the focus to row 500
        await press(page, 'Control+Home');
        await clickCell(page, 0, 'country');
        const box = await page.evaluate(() => document.activeElement.getBoundingClientRect().toJSON());
        await page.mouse.click(box.x + 10, box.y + 5, { button: 'right' });
        await page.waitForTimeout(150);
        await page.click('[data-menu-id="row.edit"]');
        await page.waitForTimeout(150);
        const hints = await page.evaluate(() =>
            ['row.edit.undo', 'row.edit.redo'].map((id) =>
                document.querySelector(`[data-menu-id="${id}"]`)?.textContent?.replace(/\s+/g, ' ').trim()
            )
        );
        check(
            'the row menu hints here (Linux): Ctrl+Z / Ctrl+Y',
            same(hints, ['Undo last change (Ctrl+Z)', 'Redo (Ctrl+Y)']),
            hints
        );
        await page.click('[data-menu-id="row.edit.undo"]');
        await page.waitForTimeout(150);
        a = await active(page);
        check("the row menu's Undo: the focus to the cell it changed", a.row === 499 && a.field === 'phone' && a.onScreen, a);
        const platform = await page.evaluate(() => [navigator.platform, navigator.userAgentData?.platform ?? null]);
        check('the real platform here is not a Mac', !/mac/i.test(platform.join(' ')), platform);

        // a header filter: PageDown into the rows, Alt+End, Ctrl+End
        await press(page, 'Control+Home');
        const filterBox = await page.evaluate((g) => {
            const input = [...document.querySelectorAll(`${g} .simple-html-grid-cell-filter-input`)].find(
                (i) => i.parentElement.$attribute === 'age'
            );
            return input.getBoundingClientRect().toJSON();
        }, grid);
        await page.mouse.click(filterBox.x + 10, filterBox.y + 5);
        await page.waitForTimeout(100);
        const lastOnScreen = await page.evaluate((g) => {
            const body = document.querySelector(`${g} .simple-html-grid-body-view-pinned-middle`).getBoundingClientRect();
            const rows = [...document.querySelectorAll(`${g} input[data-attribute="age"]`)]
                .filter((i) => i.offsetParent !== null)
                .map((i) => ({ row: i.closest('.simple-html-grid-col-cell').$row, rect: i.getBoundingClientRect() }))
                .filter(({ rect }) => rect.top >= body.top - 1 && rect.bottom <= body.bottom + 1);
            return Math.max(...rows.map(({ row }) => row));
        }, grid);
        await press(page, 'PageDown');
        a = await active(page);
        check(
            'PageDown in a header filter: the cell under it in the last row on screen',
            a.field === 'age' && !a.filter && a.row === lastOnScreen && a.onScreen,
            { a, lastOnScreen, s: await scroll(page) }
        );
        await page.mouse.click(filterBox.x + 10, filterBox.y + 5);
        await press(page, 'Alt+End');
        a = await active(page);
        check(
            'Alt+End in a header filter: the last filter',
            a.filter && a.className.includes('filter-cellpos-middle-pinned-0-7-0'),
            a
        );
        await press(page, 'Control+End');
        a = await active(page);
        check('Ctrl+End in a header filter: the last cell of the last row', a.row === 499 && a.field === 'phone', a);

        // the footer on the way of Tab: filter, Tab from the last cell
        await api(
            page,
            `(gi.getDatasource().filter({ field: 'age', operator: 'GREATER_THAN', value: 50 }), gi.getDatasource().length())`
        );
        await page.waitForTimeout(150);
        const filtered = await api(page, 'gi.getDatasource().length()');
        // filtering from code rebuilt the rows: the focus is not in them any more. The scrollbar to the top
        await page.evaluate((g) => {
            document.querySelector(`${g} .simple-html-grid-body-scroller`).scrollTop = 0;
        }, grid);
        await page.waitForTimeout(400);
        await clickCell(page, 0, 'company');
        await press(page, 'Control+End');
        a = await active(page);
        check('filtered: Ctrl+End the last cell of the last row', a.row === filtered - 1 && a.field === 'phone' && a.onScreen, {
            a,
            filtered
        });
        await press(page, 'Tab');
        a = await active(page);
        check('Tab from the last cell of the last row: the footer, Clear', a.className.includes('footer-filter-clear'), a);
        await shot(page, 'footer-clear');
        await press(page, 'Tab');
        a = await active(page);
        check('Tab: the filter chips', a.className.includes('footer-filter-chips'), a);
        await press(page, 'Tab');
        a = await active(page);
        // the settings button (GridConfig.settingsButton) is the footer's last stop
        check('Tab: the settings button', a.className.includes('footer-settings'), a);
        await press(page, 'Tab');
        a = await active(page);
        check('Tab: out of the grid', !a.inGrid, a);
        await page.focus(`${grid} .footer-filter-clear`);
        await press(page, 'Shift+Tab');
        a = await active(page);
        const rows = await api(page, 'gi.getDatasource().length()');
        check('Shift+Tab on Clear: the last cell of the last row', a.row === rows - 1 && a.field === 'phone' && a.onScreen, {
            a,
            rows
        });
        await page.close();
    }

    // ------------------------------------------------------------------ keys right after a move: the focus moves at once (focusCellNow)
    {
        const page = await open('editing');
        await clickCell(page, 1, 'country');
        const before = await api(page, 'gi.getDatasource().getRows()[1].country');
        // a held key: two Alt+ArrowDown and a character with no wait - each goes on from the cell the focus is in
        const target = await api(page, 'gi.getDatasource().getRows()[3].country');
        await page.keyboard.press('Alt+ArrowDown');
        await page.keyboard.press('Alt+ArrowDown');
        await page.keyboard.press('x');
        await page.waitForTimeout(300);
        let a = await active(page);
        const after = await api(page, 'gi.getDatasource().getRows()[1].country');
        const typed = await page.evaluate(() => document.activeElement.value);
        check(
            'keys with no wait: two rows down, the character in the cell the focus is in, not the one left',
            a.row === 3 && a.field === 'country' && after === before && typed === `${target}x`,
            { a, before, after, typed }
        );
        await page.keyboard.press('Control+z');
        await page.waitForTimeout(150);

        // Esc right after a move closes a menu opened with the mouse
        const box = await page.evaluate(() => document.activeElement.getBoundingClientRect().toJSON());
        await page.mouse.click(box.x + 10, box.y + 5, { button: 'right' });
        await page.waitForTimeout(150);
        await page.keyboard.press('Alt+ArrowDown');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        const menu = await page.evaluate(() => !!document.querySelector('.simple-html-grid-menu'));
        a = await active(page);
        check('Esc right after a move closes the menu', !menu && a.row === 4, { menu, a });
        await page.close();
    }

    // ------------------------------------------------------------------ pinned sections
    {
        const page = await open('column-layout');
        await clickCell(page, 1, 'country');
        await press(page, 'Control+End');
        let a = await active(page);
        check(
            'column layout: Ctrl+End to the pinned right column of the last row',
            a.row === 499 && a.field === 'balance' && a.onScreen,
            a
        );
        await press(page, 'Control+Home');
        a = await active(page);
        check(
            'column layout: Ctrl+Home to the pinned left column of the first row',
            a.row === 0 && a.field === 'company' && a.onScreen,
            a
        );
        await press(page, 'Alt+End');
        a = await active(page);
        check('column layout: Alt+End the pinned right column', a.row === 0 && a.field === 'balance', a);
        await clickCell(page, 1, 'phone');
        await press(page, 'PageDown');
        a = await active(page);
        check(
            'column layout: PageDown in a column of two fields keeps the field',
            a.field === 'phone' && a.row > 10 && a.onScreen,
            a
        );
        await shot(page, 'column-layout-page-down');
        await page.close();
    }

    // ------------------------------------------------------------------ group rows on the way of Tab
    {
        const page = await open('sorting-grouping');
        await api(
            page,
            `(gi.getDatasource().group([{ title: 'Country', attribute: 'country' }]), gi.getDatasource().expandGroup(), true)`
        );
        await page.waitForTimeout(200);
        // the row before the second group row
        const second = await api(page, `gi.getDatasource().getRows().findIndex((row, i) => i > 0 && '__group' in row)`);
        const fields = await api(page, 'gi.getLayoutFields()');
        const last = fields[fields.length - 1];
        // the rows scrolled to it with the scrollbar
        await page.evaluate(
            ([g, row]) => {
                const scroller = document.querySelector(`${g} .simple-html-grid-body-scroller`);
                scroller.scrollTop = document.querySelector(g).grid.gridInterface.__getScrollState().scrollTops[row] - 200;
            },
            [grid, second - 1]
        );
        await page.waitForTimeout(400);
        await clickCell(page, second - 1, fields[0]);
        await press(page, 'Alt+End');
        let a = await active(page);
        check('grouped: Alt+End the last cell of a row before a group row', a.row === second - 1 && a.field === last, a);
        await press(page, 'Tab');
        a = await active(page);
        check(
            'Tab: the button of the group row after it',
            a.className.includes('simple-html-grid-group-toggle') && /^Country: /.test(a.label ?? ''),
            a
        );
        await shot(page, 'group-button-focus');
        await press(page, 'Tab');
        a = await active(page);
        check('Tab on it: the first cell of the next row', a.row === second + 1 && a.field === fields[0], a);
        await press(page, 'Shift+Tab');
        a = await active(page);
        check('Shift+Tab: the button again', a.className.includes('simple-html-grid-group-toggle'), a);
        await press(page, 'Enter', 200);
        a = await active(page);
        check(
            'Enter on it collapses the group, the focus stays on its button',
            a.className.includes('simple-html-grid-group-toggle') &&
                (await page.evaluate(() => document.activeElement.getAttribute('aria-expanded'))) === 'false',
            a
        );
        await press(page, 'Shift+Tab');
        a = await active(page);
        check('Shift+Tab: the last cell of the row before', a.row === second - 1 && a.field === last, a);
        await press(page, 'Control+End');
        a = await active(page);
        const lastRow = await api(page, 'gi.getDatasource().length() - 1');
        check('grouped: Ctrl+End the last data row', a.row === lastRow && a.field === last && a.onScreen, { a, lastRow });
        await page.close();
    }

    // ------------------------------------------------------------------ a Mac
    {
        const page = await open('editing', true);
        await clickCell(page, 0, 'country');
        const box = await page.evaluate(() => document.activeElement.getBoundingClientRect().toJSON());
        await page.mouse.click(box.x + 10, box.y + 5, { button: 'right' });
        await page.waitForTimeout(150);
        await page.click('[data-menu-id="row.edit"]');
        await page.waitForTimeout(150);
        const hints = await page.evaluate(() =>
            ['row.edit.undo', 'row.edit.redo'].map((id) =>
                document.querySelector(`[data-menu-id="${id}"]`)?.textContent?.replace(/\s+/g, ' ').trim()
            )
        );
        check('on a Mac the row menu hints ⌘Z / ⇧⌘Z', same(hints, ['Undo last change (⌘Z)', 'Redo (⇧⌘Z)']), hints);
        if (shots) {
            const menu = await page.locator('.simple-html-grid-menu').last().boundingBox();
            await page.screenshot({
                path: `${shots}/mac-hints.png`,
                clip: {
                    x: box.x,
                    y: box.y - 10,
                    width: Math.max(400, menu.x + menu.width - box.x + 10),
                    height: menu.y + menu.height - box.y + 20
                }
            });
        }
        await press(page, 'Escape');
        await press(page, 'Escape');
        // Cmd+Shift+Z redoes, Cmd+Z undoes
        await clickCell(page, 0, 'country');
        await page.keyboard.type('x');
        await clickCell(page, 1, 'country');
        await press(page, 'Meta+z');
        const undone = await api(page, 'gi.getDatasource().getRows()[0].country');
        await press(page, 'Meta+Shift+z');
        const redone = await api(page, 'gi.getDatasource().getRows()[0].country');
        check('Cmd+Z undoes, Cmd+Shift+Z redoes', !undone.endsWith('x') && redone.endsWith('x'), { undone, redone });
        await page.close();
    }

    await browser.close();
    for (const line of results) {
        console.log(line);
    }
    if (errors.length) {
        console.log('page errors:', errors);
    }
    const failed = results.filter((line) => line.startsWith('FAIL')).length;
    console.log(`${results.length - failed}/${results.length} passed`);
    process.exit(failed || errors.length ? 1 : 0);
})().catch((error) => {
    for (const line of results) {
        console.log(line);
    }
    console.log(error);
    process.exit(1);
});
