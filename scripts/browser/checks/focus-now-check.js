// Real browser check of the focus moving at once (focusCellNow, cellRowKeyNavigationCellRowHandler.ts): Tab,
// Enter and Alt+arrows render the rows and focus the next cell in the keydown, no 100ms wait.
// - right after Alt+ArrowDown / Enter / Tab / Shift+Tab the focus is in the next cell
// - keys pressed with no wait (a held key): every one goes a cell further, the rows scroll, the cell on screen
// - a character typed right after Alt+ArrowDown lands in the new cell, not the one left
// - from a header filter Alt+ArrowDown goes into the first row at once
// Usage: node focus-now-check.js <site url> [screenshot dir]
const [, , base, shots] = process.argv;
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
    await page.goto(`${base}#sample/editing`);
    await page.waitForSelector(`${grid} .simple-html-grid-col-cell`);
    await page.waitForTimeout(300);

    const active = () =>
        page.evaluate((g) => {
            const el = document.activeElement;
            const cell = el?.closest('.simple-html-grid-col-cell');
            const body = document.querySelector(`${g} .simple-html-grid-body`).getBoundingClientRect();
            const rect = el?.getBoundingClientRect();
            const ds = document.querySelector(g).grid.gridInterface.getDatasource();
            return {
                row: cell?.$row,
                field: cell?.$attribute ?? null,
                filter: cell?.getAttribute('type') === 'filter',
                onScreen: !!rect && rect.height > 0 && rect.top >= body.top - 1 && rect.bottom <= body.bottom + 1,
                current: ds.getRows().indexOf(ds.currentEntity),
                value: el instanceof HTMLInputElement ? el.value : null
            };
        }, grid);
    const fields = () =>
        page.evaluate(
            (g) =>
                document
                    .querySelector(g)
                    .grid.gridInterface.getLayoutFields()
                    .map((f) => f.attribute ?? f),
            grid
        );
    const clickCell = async (row, field) => {
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

    const order = await fields();
    const field = order[1];
    await clickCell(2, field);
    let a = await active();
    check('a click focuses the cell', a.row === 2 && a.field === field, a);

    // no wait after each key
    await page.keyboard.press('Alt+ArrowDown');
    a = await active();
    check(
        'Alt+ArrowDown: the focus in the next row at once, it is the current row',
        a.row === 3 && a.field === field && a.current === 3,
        a
    );
    await page.keyboard.press('Alt+ArrowUp');
    a = await active();
    check('Alt+ArrowUp: back at once', a.row === 2 && a.field === field, a);
    await page.keyboard.press('Tab');
    a = await active();
    check('Tab: the next cell at once', a.row === 2 && a.field === order[2], a);
    await page.keyboard.press('Shift+Tab');
    a = await active();
    check('Shift+Tab: back at once', a.row === 2 && a.field === field, a);
    await page.keyboard.press('Enter');
    a = await active();
    check('Enter: the cell under it at once', a.row === 3 && a.field === field, a);

    // a held key: 40 keydowns with no wait - the rows have to scroll
    for (let i = 0; i < 40; i++) {
        await page.keyboard.press('Alt+ArrowDown');
    }
    a = await active();
    const top = await page.evaluate((g) => document.querySelector(`${g} .simple-html-grid-body-scroller`).scrollTop, grid);
    check(
        '40 Alt+ArrowDown with no wait: 40 rows down, scrolled, the cell on screen',
        a.row === 43 && a.field === field && a.onScreen && top > 0,
        { ...a, top }
    );
    if (shots) {
        await page.locator(grid).screenshot({ path: `${shots}/focus-now-held.png` });
    }
    for (let i = 0; i < 40; i++) {
        await page.keyboard.press('Alt+ArrowUp');
    }
    a = await active();
    check('40 Alt+ArrowUp with no wait: back to row 3, on screen', a.row === 3 && a.field === field && a.onScreen, a);

    // typing right after a move
    await page.keyboard.press('Alt+ArrowDown');
    const before = (await active()).value;
    await page.keyboard.type('Z');
    a = await active();
    check('a character right after Alt+ArrowDown lands in the new cell', a.row === 4 && a.value === `${before}Z`, { a, before });
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(100);

    // from a header filter
    await page.locator(`${grid} input.filter-cellpos-middle-pinned-0-1-0, ${grid} [type="filter"] input`).first().focus();
    await page.keyboard.press('Alt+ArrowDown');
    a = await active();
    check(
        'Alt+ArrowDown from a header filter: the first row at once, it is the current row',
        a.row === 0 && !a.filter && a.current === 0,
        a
    );

    check('no page errors', errors.length === 0, errors);
    console.log(results.join('\n'));
    await browser.close();
    process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
})();
