// Real browser check of Find in the grid (#sample/find, plan item 42): Ctrl+F in the grid opens the
// find bar with the focus in it, typing marks the cells that show the text (as the datasource has it),
// Enter / Shift+Enter / F3 / Shift+F3 move the current match and scroll to it (also sideways), Esc closes
// it and puts the focus in the match's cell, Ctrl+F outside the grid is left to the browser, the wheel
// leaves the focus in the bar, the bar is over the panel only, square, a search region for a screen
// reader; the text keeps 4.5:1 over the tints and the line of the current match 3:1 - read from the
// pixels. Screenshots light and dark.
// "Filter rows" (the funnel toggle of the bar): by the mouse and the keyboard, the rows shown are the rows
// with a cell that shows the text as the cells show it (a formatted date, a number), every row on screen
// has a marked cell, the footer's chip and count, the footer's Clear, Esc brings every row back, the look
// of the pressed toggle (3:1 read from the pixels), a narrow grid keeps the five buttons.
// "Match case" (Aa) comes before "Filter rows": Tab goes to it first, the narrow grid has five buttons -
// this copy (in the worktree of the find's Match case and SQL) only changes those three checks.
// Usage: node find-check.js <site url> [screenshot dir]
// The copy before "Filter rows": find-check.js.before-filter-rows
const [, , base, shots] = process.argv;
const { chromium } = require('playwright');

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);

// WCAG relative luminance and contrast
const lin = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];
    for (const dark of [false, true]) {
        const theme = dark ? 'dark' : 'light';
        const page = await browser.newPage({ viewport: { width: 1300, height: 1400 }, deviceScaleFactor: 1 });
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.addInitScript((d) => localStorage.setItem('simple-html-demo-theme', d ? 'dark' : 'light'), dark);
        await page.goto(`${base}#sample/find`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
        await page.waitForTimeout(300);

        const grid = '.stage simple-html-grid';
        const state = () => page.evaluate((g) => document.querySelector(g).grid.gridInterface.getFind(), grid);
        const active = () =>
            page.evaluate((g) => {
                const el = document.activeElement;
                const cell = el?.closest('.simple-html-grid-col-cell');
                return {
                    inGrid: !!el && document.querySelector(g).contains(el),
                    findInput: !!el?.classList.contains('simple-html-grid-find-input'),
                    className: typeof el?.className === 'string' ? el.className : '',
                    row: cell?.$row,
                    field: el?.getAttribute('data-attribute')
                };
            }, grid);
        // the input of a cell on screen, its center
        const cellBox = (row, field) =>
            page.evaluate(
                ([g, r, f]) => {
                    const input = [...document.querySelectorAll(`${g} input[data-attribute="${f}"]`)].find(
                        (i) => i.closest('.simple-html-grid-col-cell')?.$row === r && i.offsetParent !== null
                    );
                    const rect = input.getBoundingClientRect();
                    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
                },
                [grid, row, field]
            );
        // the cells marked on screen: inside the views of the rows, and what they show
        const marked = (className) =>
            page.evaluate(
                ([g, c]) => {
                    const body = document.querySelector(`${g} .simple-html-grid-body`).getBoundingClientRect();
                    return [...document.querySelectorAll(`${g} .${c}`)]
                        .filter((cell) => {
                            const rect = cell.getBoundingClientRect();
                            return (
                                rect.height > 0 && rect.bottom > body.top && rect.top < body.bottom && cell.offsetParent !== null
                            );
                        })
                        .map((cell) => ({
                            row: cell.$row,
                            field: cell.$attribute,
                            text: cell.querySelector('input')?.value ?? ''
                        }));
                },
                [grid, className]
            );
        // is the cell of the current match inside the views: vertically in the body, sideways in its section
        const currentInView = () =>
            page.evaluate((g) => {
                const cell = [...document.querySelectorAll(`${g} .simple-html-cell-find-current`)].find(
                    (c) => c.offsetParent !== null
                );
                if (!cell) {
                    return { found: false };
                }
                const rect = cell.getBoundingClientRect();
                const body = document.querySelector(`${g} .simple-html-grid-body`).getBoundingClientRect();
                const view = cell.closest('[class*="simple-html-grid-body-view-pinned"]').getBoundingClientRect();
                return {
                    found: true,
                    view: [Math.round(view.left), Math.round(view.right)],
                    vertical: rect.top >= body.top - 0.5 && rect.bottom <= body.bottom + 0.5,
                    sideways: rect.left >= view.left - 0.5 && rect.right <= view.right + 0.5,
                    rect: [Math.round(rect.left), Math.round(rect.top), Math.round(rect.right), Math.round(rect.bottom)]
                };
            }, grid);
        // what the datasource says: the cells whose text holds it, by the formatter of each field
        const expectedCount = (text) =>
            page.evaluate(
                ([g, t]) => {
                    const gi = document.querySelector(g).grid.gridInterface;
                    const ds = gi.getDatasource();
                    let count = 0;
                    for (const row of ds.getRows()) {
                        for (const field of gi.getLayoutFields()) {
                            if (ds.getField(field).type === 'boolean') continue;
                            if (String(ds.getFormatter(field).format(row[field])).toLowerCase().includes(t.toLowerCase()))
                                count++;
                        }
                    }
                    return count;
                },
                [grid, text]
            );
        // a pixel of the page, as painted
        const pixel = async (x, y) => {
            const png = await page.screenshot({ clip: { x, y, width: 1, height: 1 } });
            return page.evaluate(async (b64) => {
                const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
                const bitmap = await createImageBitmap(blob);
                const canvas = new OffscreenCanvas(1, 1);
                const c2d = canvas.getContext('2d');
                c2d.drawImage(bitmap, 0, 0);
                return [...c2d.getImageData(0, 0, 1, 1).data.slice(0, 3)];
            }, png.toString('base64'));
        };

        // 1. Ctrl+F in a cell: the bar, the focus in its input
        const start = await cellBox(2, 'company');
        await page.mouse.click(start.x, start.y);
        await page.keyboard.press('Control+f');
        await page.waitForTimeout(50);
        let a = await active();
        let s = await state();
        check(
            `${theme}: Ctrl+F in a cell opens the bar, the focus in its input`,
            s.open && a.findInput,
            JSON.stringify({ s, a })
        );

        // 2. typing: the count and the marks, as the datasource has them
        await page.keyboard.type('norway', { delay: 30 });
        await page.waitForTimeout(400);
        s = await state();
        const want = await expectedCount('norway');
        const count = await page.locator(`${grid} .simple-html-grid-find-count`).textContent();
        check(
            `${theme}: typing "norway" finds the cells the datasource has`,
            s.count === want && s.count > 0 && count.trim() === `${s.position} of ${s.count}`,
            `${count} vs ${want}`
        );
        const matches = await marked('simple-html-cell-find-match');
        const norwayOnScreen = await page.evaluate((g) => {
            const body = document.querySelector(`${g} .simple-html-grid-body`).getBoundingClientRect();
            return [...document.querySelectorAll(`${g} input[data-attribute="country"]`)].filter((i) => {
                const r = i.getBoundingClientRect();
                return i.offsetParent !== null && r.bottom > body.top && r.top < body.bottom && i.value === 'Norway';
            }).length;
        }, grid);
        check(
            `${theme}: every cell marked on screen shows the text, and every Norway on screen is marked`,
            matches.length > 0 &&
                matches.every((m) => m.text.toLowerCase().includes('norway')) &&
                matches.length === norwayOnScreen,
            `${matches.length} marked, ${norwayOnScreen} on screen`
        );
        // the first match at or after the cell Ctrl+F came from (row 2)
        check(
            `${theme}: the current match is at or after the cell with the focus`,
            s.current && s.current.row >= 2,
            JSON.stringify(s.current)
        );
        let view = await currentInView();
        check(
            `${theme}: the current match is marked and in view`,
            view.found && view.vertical && view.sideways,
            JSON.stringify(view)
        );

        if (shots) {
            const box = await page.locator(grid).boundingBox();
            await page.screenshot({
                path: `${shots}/find-top-${theme}.png`,
                clip: { x: box.x, y: box.y, width: box.width, height: 300 }
            });
        }

        // 3. the look: the text over the tints, the line of the current match - read from the pixels
        const looks = await page.evaluate((g) => {
            const shown = (c) => c.offsetParent !== null;
            const current = [...document.querySelectorAll(`${g} .simple-html-cell-find-current`)].find(shown);
            const match = [
                ...document.querySelectorAll(`${g} .simple-html-cell-find-match:not(.simple-html-cell-find-current)`)
            ].find(shown);
            const rectOf = (c) => {
                const r = c.getBoundingClientRect();
                return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
            };
            const color = getComputedStyle(current.querySelector('input')).color.match(/\d+/g).slice(0, 3).map(Number);
            return { current: rectOf(current), match: match && rectOf(match), text: color };
        }, grid);
        // a point of the cell right of its text (the inputs are left aligned), away from the line
        const tintOf = (r) => pixel(Math.floor(r.right - 8), Math.floor((r.top + r.bottom) / 2));
        const currentTint = await tintOf(looks.current);
        const line = await pixel(Math.floor(looks.current.right - 1), Math.floor((looks.current.top + looks.current.bottom) / 2));
        // the cell left of the current match (the company column), outside the line
        const outside = await pixel(
            Math.floor(looks.current.left) - 8,
            Math.floor((looks.current.top + looks.current.bottom) / 2)
        );
        const matchTint = looks.match ? await tintOf(looks.match) : null;
        check(
            `${theme}: the text over the current match at least 4.5:1`,
            contrast(looks.text, currentTint) >= 4.5,
            `${contrast(looks.text, currentTint).toFixed(2)} text ${looks.text} on ${currentTint}`
        );
        if (matchTint) {
            check(
                `${theme}: the text over a match at least 4.5:1`,
                contrast(looks.text, matchTint) >= 4.5,
                `${contrast(looks.text, matchTint).toFixed(2)} on ${matchTint}`
            );
        }
        check(
            `${theme}: the line of the current match at least 3:1 to its tint and to the cell beside it`,
            contrast(line, currentTint) >= 3 && contrast(line, outside) >= 3,
            `line ${line}: to the tint ${contrast(line, currentTint).toFixed(2)}, to the cell beside ${contrast(line, outside).toFixed(2)} ${outside}`
        );

        // 4. the bar: over the panel only, square, a search region
        const bar = await page.evaluate((g) => {
            const el = document.querySelector(`${g} .simple-html-grid-find`);
            const r = el.getBoundingClientRect();
            const header = document.querySelector(`${g} .simple-html-grid-header`).getBoundingClientRect();
            const gridRect = document.querySelector(g).getBoundingClientRect();
            const radii = [el, ...el.querySelectorAll('input, button')].map((e) => getComputedStyle(e).borderRadius);
            return { bottom: r.bottom, top: r.top, right: r.right, headerTop: header.top, gridRight: gridRect.right, radii };
        }, grid);
        check(
            `${theme}: the bar is in the top right corner, over the panel and not the header`,
            bar.bottom <= bar.headerTop + 0.5 && Math.abs(bar.right - bar.gridRight) <= 1.5,
            JSON.stringify(bar)
        );
        check(
            `${theme}: no rounded corners on the bar, its input and buttons`,
            bar.radii.every((r) => r === '0px'),
            bar.radii.join(' ')
        );
        const aria = await page.locator(`${grid} .simple-html-grid-find`).ariaSnapshot();
        check(
            `${theme}: a search region with a named input, a status, the toggle and three named buttons`,
            /search "Find in the grid"/.test(aria) &&
                /textbox "Find"/.test(aria) &&
                /status: \d+ of \d+/.test(aria) &&
                /button "Filter rows"/.test(aria) &&
                !/button "Filter rows" \[pressed\]/.test(aria) &&
                /button "Previous match"/.test(aria) &&
                /button "Next match"/.test(aria) &&
                /button "Close"/.test(aria),
            aria.replace(/\n/g, ' | ')
        );
        if (shots) {
            const r = await page.locator(`${grid} .simple-html-grid-find`).boundingBox();
            await page.screenshot({
                path: `${shots}/find-bar-${theme}.png`,
                clip: { x: r.x - 60, y: r.y - 4, width: r.width + 62, height: 90 }
            });
        }

        // 5. Enter, Shift+Enter, F3, Shift+F3
        const p0 = (await state()).position;
        await page.keyboard.press('Enter');
        const p1 = (await state()).position;
        await page.keyboard.press('F3');
        const p2 = (await state()).position;
        await page.keyboard.press('Shift+Enter');
        const p3 = (await state()).position;
        await page.keyboard.press('Shift+F3');
        const p4 = (await state()).position;
        a = await active();
        check(
            `${theme}: Enter and F3 next, Shift+Enter and Shift+F3 previous, the focus stays in the input`,
            p1 === p0 + 1 && p2 === p0 + 2 && p3 === p0 + 1 && p4 === p0 && a.findInput,
            [p0, p1, p2, p3, p4].join(' ')
        );

        // wrapping: previous from the first is the last, and the grid scrolls down to it
        let guard = 0;
        while ((await state()).position !== 1 && guard++ < 500) {
            await page.keyboard.press('Shift+Enter');
        }
        await page.keyboard.press('Shift+Enter');
        s = await state();
        await page.waitForTimeout(100);
        view = await currentInView();
        const scrollTop = await page.evaluate(
            (g) => document.querySelector(`${g} .simple-html-grid-body-scroller`).scrollTop,
            grid
        );
        check(
            `${theme}: before the first match the last, scrolled to and in view`,
            s.position === s.count && scrollTop > 0 && view.found && view.vertical,
            JSON.stringify({ position: s.position, count: s.count, scrollTop, view })
        );
        if (shots) {
            const box = await page.locator(grid).boundingBox();
            await page.screenshot({
                path: `${shots}/find-last-${theme}.png`,
                clip: { x: box.x, y: box.y, width: box.width, height: box.height }
            });
        }

        // 6. the wheel over the grid: it scrolls, the focus stays in the bar
        const mid = await page.locator(`${grid} .simple-html-grid-body`).boundingBox();
        await page.mouse.move(mid.x + 200, mid.y + 200);
        await page.mouse.wheel(0, -300);
        await page.waitForTimeout(200);
        a = await active();
        check(`${theme}: the wheel leaves the focus in the find bar`, a.findInput, JSON.stringify(a));
        await page.keyboard.press('Enter');
        await page.waitForTimeout(100);
        s = await state();
        view = await currentInView();
        check(
            `${theme}: Enter after the wheel goes on, back at the first match, in view`,
            s.position === 1 && view.found && view.vertical,
            JSON.stringify({ s, view })
        );

        // 7. Esc: closed, the focus in the cell of the current match, its row the current row
        await page.keyboard.press('Enter');
        const before = await state();
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
        a = await active();
        s = await state();
        const currentRow = await page.evaluate(
            ([g, r]) => {
                const ds = document.querySelector(g).grid.gridInterface.getDatasource();
                return ds.currentEntity === ds.getRow(r);
            },
            [grid, before.current.row]
        );
        const left = await marked('simple-html-cell-find-match');
        const barHidden = await page.evaluate(
            (g) => document.querySelector(`${g} .simple-html-grid-find`).getBoundingClientRect().height === 0,
            grid
        );
        check(
            `${theme}: Esc closes it, the focus in the cell of the current match, its row current, no marks`,
            !s.open &&
                barHidden &&
                a.row === before.current.row &&
                a.field === before.current.field &&
                currentRow &&
                left.length === 0,
            JSON.stringify({ a, current: before.current, currentRow, left: left.length, barHidden })
        );

        // 12. "Filter rows": the toggle by the mouse and the keyboard; the rows shown are the rows with a cell
        // that shows the text as the cells show it; the footer's chip and Clear; Esc brings every row back
        const gi = (fn, arg) =>
            page.evaluate(
                ([g, f, x]) => new Function('gi', 'x', `return (${f})(gi, x)`)(document.querySelector(g).grid.gridInterface, x),
                [grid, fn.toString(), arg]
            );
        const total = await gi((g) => g.getDatasource().getAllData().length);
        // the rows (indexes in getAllData()) with a cell of the layout that shows the text, by the formatters
        const rowsWith = (text) =>
            gi((g, t) => {
                const ds = g.getDatasource();
                const fields = g.getLayoutFields().filter((f) => ds.getField(f).type !== 'boolean');
                const has = (row) =>
                    fields.some((f) => String(ds.getFormatter(f).format(row[f])).toLowerCase().includes(t.toLowerCase()));
                return ds
                    .getAllData()
                    .map((row, i) => (has(row) ? i : -1))
                    .filter((i) => i !== -1);
            }, text);
        // the rows shown, as indexes in getAllData()
        const shownRows = () =>
            gi((g) => {
                const ds = g.getDatasource();
                const all = ds.getAllData();
                return ds
                    .getDataRows()
                    .map((row) => all.indexOf(row))
                    .sort((a, b) => a - b);
            });
        const toggle = `${grid} .simple-html-grid-find-filter`;
        const pressed = () => page.locator(toggle).getAttribute('aria-pressed');
        const footer = () =>
            page.evaluate(
                (g) => ({
                    count: document.querySelector(`${g} .footer-count`)?.textContent.trim(),
                    chip: document.querySelector(`${g} .footer-filter-find`)?.textContent.trim() ?? null
                }),
                grid
            );
        // the rows on screen, and those of them with a marked cell
        const rowsOnScreen = () =>
            page.evaluate((g) => {
                const body = document.querySelector(`${g} .simple-html-grid-body`).getBoundingClientRect();
                const visible = (el) => {
                    const r = el.getBoundingClientRect();
                    return el.offsetParent !== null && r.height > 0 && r.bottom > body.top + 1 && r.top < body.bottom - 1;
                };
                const cells = [...document.querySelectorAll(`${g} .simple-html-grid-col-cell`)].filter(
                    (c) => c.$row !== undefined && c.$attribute && visible(c)
                );
                const rows = [...new Set(cells.map((c) => c.$row))].sort((a, b) => a - b);
                const marked = [
                    ...new Set(cells.filter((c) => c.classList.contains('simple-html-cell-find-match')).map((c) => c.$row))
                ].sort((a, b) => a - b);
                return { rows, marked };
            }, grid);
        const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

        // a date as its formatter shows it, of the fourth row, and the date as it is stored
        const dateText = await gi((g) => g.getDatasource().getFormatter('date1').format(g.getDatasource().getAllData()[3].date1));
        const rawDate = await gi((g) => String(g.getDatasource().getAllData()[3].date1).slice(4, 15));
        await page.evaluate((g) => {
            document.querySelector(`${g} .simple-html-grid-body-scroller`).scrollTop = 0;
        }, grid);
        await page.waitForTimeout(300);
        const top = await cellBox(0, 'company');
        await page.mouse.click(top.x, top.y);
        await page.keyboard.press('Control+f');
        await page.keyboard.type(dateText, { delay: 20 });
        await page.waitForTimeout(400);

        // by the mouse: the focus stays in the input
        await page.locator(toggle).click();
        await page.waitForTimeout(200);
        a = await active();
        s = await state();
        let shown = await shownRows();
        let wanted = await rowsWith(dateText);
        check(
            `${theme}: Filter rows by the mouse: pressed, the focus stays in the input`,
            (await pressed()) === 'true' && s.filterRows && a.findInput,
            JSON.stringify({ pressed: await pressed(), filterRows: s.filterRows, a })
        );
        check(
            `${theme}: the rows shown are the rows with a cell that shows the formatted date "${dateText}"`,
            same(shown, wanted) && shown.length > 0 && shown.length < total,
            `${shown.length} shown, ${wanted.length} with it, of ${total}`
        );
        let screen = await rowsOnScreen();
        check(
            `${theme}: every row on screen has a marked cell`,
            screen.rows.length > 0 && screen.rows.length <= shown.length && same(screen.rows, screen.marked),
            JSON.stringify(screen)
        );
        let foot = await footer();
        check(
            `${theme}: the footer: the count of the rows shown, the chip "Find: ${dateText}"`,
            foot.count === `${shown.length}/${total}` && foot.chip === `Find: ${dateText}`,
            JSON.stringify(foot)
        );
        const ariaOn = await page.locator(`${grid} .simple-html-grid-find`).ariaSnapshot();
        check(
            `${theme}: the toggle is a pressed button for a screen reader`,
            /button "Filter rows" \[pressed\]/.test(ariaOn),
            ariaOn.replace(/\n/g, ' | ')
        );

        // the look of the pressed toggle, from the pixels: the funnel to its fill, the fill to the bar
        const looksOn = await page.evaluate((t) => {
            const button = document.querySelector(t).getBoundingClientRect();
            const icon = document.querySelector(`${t} svg`).getBoundingClientRect();
            return {
                button: { x: button.x, y: button.y, w: button.width, h: button.height },
                icon: { x: icon.x, y: icon.y, w: icon.width }
            };
        }, toggle);
        const fill = await pixel(Math.floor(looksOn.button.x + 2), Math.floor(looksOn.button.y + 2));
        // the top band of the funnel, y 2 to 6.6 of 12
        const funnel = await pixel(Math.floor(looksOn.icon.x + looksOn.icon.w / 2), Math.floor(looksOn.icon.y + 3.5));
        // the gap of 2px before the button: the bar's background
        const barBg = await pixel(Math.floor(looksOn.button.x) - 1, Math.floor(looksOn.button.y + looksOn.button.h / 2));
        check(
            `${theme}: the pressed toggle: the funnel at least 3:1 to its fill, the fill at least 3:1 to the bar`,
            contrast(funnel, fill) >= 3 && contrast(fill, barBg) >= 3,
            `funnel ${funnel} on ${fill}: ${contrast(funnel, fill).toFixed(2)}, fill to the bar ${barBg}: ${contrast(fill, barBg).toFixed(2)}`
        );
        const radius = await page.evaluate((t) => getComputedStyle(document.querySelector(t)).borderRadius, toggle);
        check(`${theme}: the toggle is square`, radius === '0px', radius);
        if (shots) {
            const box = await page.locator(grid).boundingBox();
            await page.screenshot({
                path: `${shots}/find-filter-on-${theme}.png`,
                clip: { x: box.x, y: box.y, width: box.width, height: box.height }
            });
            const r = await page.locator(`${grid} .simple-html-grid-find`).boundingBox();
            await page.screenshot({
                path: `${shots}/find-filter-bar-${theme}.png`,
                clip: { x: r.x - 60, y: r.y - 4, width: r.width + 62, height: 90 }
            });
            const f = await page.locator(`${grid} .simple-html-grid-footer`).boundingBox();
            await page.screenshot({
                path: `${shots}/find-filter-footer-${theme}.png`,
                clip: { x: f.x, y: f.y - 30, width: Math.min(f.width, 700), height: f.height + 30 }
            });
        }

        // the date as it is stored is not what a cell shows: no row; a number as the cell shows it
        const rawCount = await gi((g, t) => g.find(t), rawDate);
        shown = await shownRows();
        check(
            `${theme}: the date as stored ("${rawDate}") finds no cell, and no row is shown`,
            rawCount === 0 && shown.length === 0,
            `${rawCount}, ${shown.length} rows`
        );
        const numberText = await gi((g) =>
            String(g.getDatasource().getFormatter('balance').format(g.getDatasource().getAllData()[7].balance))
        );
        await gi((g, t) => g.find(t), numberText);
        shown = await shownRows();
        wanted = await rowsWith(numberText);
        check(
            `${theme}: a number as the cell shows it ("${numberText}"): the rows with it`,
            same(shown, wanted) && shown.length > 0,
            `${shown.length} vs ${wanted.length}`
        );

        // typing: the rows follow when the typing stops
        await page.locator(`${grid} .simple-html-grid-find-input`).focus();
        await page.keyboard.press('Control+a');
        await page.keyboard.type(dateText, { delay: 10 });
        const whileTyping = await shownRows();
        await page.waitForTimeout(400);
        shown = await shownRows();
        wanted = await rowsWith(dateText);
        check(
            `${theme}: typing: the rows follow once the typing stops`,
            same(whileTyping, await rowsWith(numberText)) && same(shown, wanted),
            `${whileTyping.length} while typing, then ${shown.length}`
        );

        // the keyboard: Tab from the input to Match case, Tab to the toggle, Space and Enter, Shift+Tab back
        await page.keyboard.press('Tab');
        a = await active();
        const onCase = a.className.includes('simple-html-grid-find-case');
        await page.keyboard.press('Tab');
        a = await active();
        const onToggle = onCase && a.className.includes('simple-html-grid-find-filter');
        await page.keyboard.press('Space');
        await page.waitForTimeout(100);
        const offRows = (await shownRows()).length;
        const offPressed = await pressed();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(100);
        const onRows = await shownRows();
        const onPressed = await pressed();
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Shift+Tab');
        a = await active();
        check(
            `${theme}: the keyboard: Tab Tab from the input (Match case, then the toggle), Space off (every row), Enter on, Shift+Tab back to the input`,
            onToggle &&
                offRows === total &&
                offPressed === 'false' &&
                same(onRows, wanted) &&
                onPressed === 'true' &&
                a.findInput,
            JSON.stringify({ onToggle, offRows, offPressed, onRows: onRows.length, onPressed, back: a.findInput })
        );

        // the footer's Clear: every row, the bar stays open with the toggle off
        await page.locator(`${grid} .footer-filter-clear`).click();
        await page.waitForTimeout(200);
        s = await state();
        foot = await footer();
        check(
            `${theme}: the footer's Clear turns it off: every row, the bar open, the toggle not pressed, no chip`,
            (await shownRows()).length === total &&
                s.open &&
                !s.filterRows &&
                (await pressed()) === 'false' &&
                foot.chip === null,
            JSON.stringify({ s, foot })
        );

        // Esc: every row back, the focus in the cell of the current match among them
        await page.locator(toggle).click();
        await page.waitForTimeout(200);
        await page.locator(`${grid} .simple-html-grid-find-input`).focus();
        await page.keyboard.press('Enter');
        await gi((g) => {
            window.__findMatch = g.getDatasource().getRow(g.getFind().current.row);
        });
        const filteredBefore = (await shownRows()).length;
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
        a = await active();
        s = await state();
        const atMatch = await gi((g, row) => g.getDatasource().getRow(row) === window.__findMatch, a.row ?? -1);
        foot = await footer();
        check(
            `${theme}: Esc: every row back, the bar closed and off, the focus in the cell of the current match`,
            filteredBefore < total &&
                (await shownRows()).length === total &&
                !s.open &&
                !s.filterRows &&
                atMatch &&
                foot.chip === null &&
                foot.count === `${total}/${total}`,
            JSON.stringify({ filteredBefore, s, a, atMatch, foot })
        );
        if (shots) {
            const box = await page.locator(grid).boundingBox();
            await page.screenshot({
                path: `${shots}/find-filter-after-esc-${theme}.png`,
                clip: { x: box.x, y: box.y, width: box.width, height: 300 }
            });
        }

        if (!dark) {
            // a narrow grid, 160px: the four buttons stay whole, the count gives way. The bar needs about
            // 148px (the input's 40, four buttons of 21, the gaps, the count's padding): in a grid of 144px
            // the ✕ is cut by a few px
            // the grid itself 160px wide: since the docs site hides its sidebar in a narrow window, a narrow
            // window no longer makes a narrow grid
            await page.evaluate((g) => {
                document.querySelector(g).parentElement.style.width = '160px';
            }, grid);
            await page.waitForTimeout(500);
            await gi((g) => g.find('norway', { filterRows: true }));
            await page.waitForTimeout(200);
            const narrow = await page.evaluate((g) => {
                const bar = document.querySelector(`${g} .simple-html-grid-find`).getBoundingClientRect();
                const gridRect = document.querySelector(g).getBoundingClientRect();
                const buttons = [...document.querySelectorAll(`${g} .simple-html-grid-find button`)].map((b) =>
                    b.getBoundingClientRect()
                );
                const count = document.querySelector(`${g} .simple-html-grid-find-count`);
                const input = document.querySelector(`${g} .simple-html-grid-find-input`).getBoundingClientRect();
                return {
                    grid: Math.round(gridRect.width),
                    bar: [Math.round(bar.left), Math.round(bar.right)],
                    buttons: buttons.map((b) => [Math.round(b.left), Math.round(b.width)]),
                    inside: buttons.every((b) => b.left >= bar.left - 0.5 && b.right <= bar.right + 0.5),
                    count: [count.clientWidth, count.scrollWidth],
                    input: Math.round(input.width)
                };
            }, grid);
            check(
                'a narrow grid (160px): Aa, the toggle, ↑, ↓ and ✕ whole and inside the bar, the input at least 24px, the count cut',
                narrow.grid <= 160 &&
                    narrow.buttons.length === 5 &&
                    narrow.buttons.every(([, w]) => w === 21) &&
                    narrow.inside &&
                    narrow.input >= 24 &&
                    narrow.count[1] > narrow.count[0],
                JSON.stringify(narrow)
            );
            if (shots) {
                // the demo puts its menu above the grid in a narrow window: the grid is further down
                await page.locator(`${grid} .simple-html-grid-find`).scrollIntoViewIfNeeded();
                const box = await page.locator(grid).boundingBox();
                await page.screenshot({
                    path: `${shots}/find-filter-narrow-light.png`,
                    clip: { x: box.x, y: Math.max(0, box.y), width: box.width, height: 300 }
                });
                await page.evaluate(() => window.scrollTo(0, 0));
            }
            await gi((g) => g.closeFind());
            await page.evaluate((g) => {
                document.querySelector(g).parentElement.style.width = '';
            }, grid);
            await page.setViewportSize({ width: 1300, height: 1400 });
            await page.waitForTimeout(500);
        }
        // the text the later steps expect, the bar closed
        await gi((g) => {
            g.find('norway');
            g.closeFind();
        });

        if (!dark) {
            // 8. Ctrl+F outside the grid: not the grid's
            await page.evaluate(() => {
                window.__ctrlF = null;
                window.addEventListener('keydown', (e) => {
                    if (e.key === 'f' && e.ctrlKey) window.__ctrlF = e.defaultPrevented;
                });
            });
            await page.locator('.main-header h1').click();
            await page.keyboard.press('Control+f');
            await page.waitForTimeout(50);
            s = await state();
            const ctrlF = await page.evaluate(() => window.__ctrlF);
            check(
                'Ctrl+F outside the grid is not taken: the bar stays closed, the key not canceled',
                !s.open && ctrlF === false,
                JSON.stringify({ open: s.open, ctrlF })
            );

            // 9. Ctrl+F again in a cell: the last text, selected; Shift+Tab from the input leaves the grid
            await page.evaluate((g) => {
                document.querySelector(`${g} .simple-html-grid-body-scroller`).scrollTop = 0;
            }, grid);
            await page.waitForTimeout(300);
            const cell = await cellBox(1, 'country');
            await page.mouse.click(cell.x, cell.y);
            await page.keyboard.press('Control+f');
            await page.waitForTimeout(50);
            const selected = await page.evaluate(() => {
                const i = document.activeElement;
                return [i.value, i.selectionStart, i.selectionEnd];
            });
            check(
                'Ctrl+F again: the last text, selected',
                selected[0] === 'norway' && selected[1] === 0 && selected[2] === 6,
                JSON.stringify(selected)
            );
            await page.keyboard.press('Shift+Tab');
            a = await active();
            check('Shift+Tab from the find input leaves the grid', !a.inGrid, JSON.stringify(a));
            // Tab through the buttons, and on from the close button
            await page.locator(`${grid} .simple-html-grid-find-input`).focus();
            const stops = [];
            for (let i = 0; i < 6; i++) {
                await page.keyboard.press('Tab');
                const now = await active();
                stops.push(now.inGrid ? now.className || now.field || '?' : 'outside');
            }
            check(
                'Tab: Match case, Filter rows, previous, next, close, then on into the grid',
                stops[0].includes('simple-html-grid-find-case') &&
                    stops[1].includes('simple-html-grid-find-filter') &&
                    stops.slice(2, 5).every((stop) => stop === 'simple-html-grid-find-button') &&
                    stops[5] !== 'outside',
                stops.join(' > ')
            );

            // 10. a match in a middle column out of view: the columns scroll sideways
            await page.setViewportSize({ width: 900, height: 1400 });
            await page.waitForTimeout(500);
            const fruitCount = await page.evaluate((g) => document.querySelector(g).grid.gridInterface.find('mango'), grid);
            await page.waitForTimeout(150);
            view = await currentInView();
            const scrollLeft = await page.evaluate(
                (g) => document.querySelector(`${g} .simple-html-grid-middle-scroller`).scrollLeft,
                grid
            );
            s = await state();
            check(
                'a narrow grid: a match in a middle column out of view scrolls the columns to it',
                fruitCount > 0 &&
                    s.current.field === 'favoriteFruit' &&
                    scrollLeft > 0 &&
                    view.found &&
                    view.sideways &&
                    view.vertical,
                JSON.stringify({ scrollLeft, view, current: s.current })
            );
            if (shots) {
                const box = await page.locator(grid).boundingBox();
                await page.screenshot({
                    path: `${shots}/find-narrow-light.png`,
                    clip: { x: box.x, y: box.y, width: box.width, height: 300 }
                });
            }
            await page.setViewportSize({ width: 1300, height: 1400 });
            await page.waitForTimeout(500);

            // 11. it follows the data: a filter, then a sort that keeps the current match
            await page.evaluate((g) => document.querySelector(g).grid.gridInterface.find('norway'), grid);
            await page.evaluate((g) => {
                const ds = document.querySelector(g).grid.gridInterface.getDatasource();
                ds.filter({ field: 'age', operator: 'LESS_THAN', value: 30 });
            }, grid);
            await page.waitForTimeout(400);
            s = await state();
            const filtered = await expectedCount('norway');
            check(
                'a filter: the matches are found again',
                s.open && s.count === filtered && s.count > 0,
                `${s.count} vs ${filtered}`
            );
            await page.evaluate((g) => document.querySelector(g).grid.gridInterface.findNext(), grid);
            const entityBefore = await page.evaluate((g) => {
                const gi = document.querySelector(g).grid.gridInterface;
                window.__findEntity = gi.getDatasource().getRow(gi.getFind().current.row);
                return gi.getFind().current;
            }, grid);
            await page.evaluate(
                (g) =>
                    document
                        .querySelector(g)
                        .grid.gridInterface.getDatasource()
                        .sort([{ attribute: 'age', ascending: false }]),
                grid
            );
            await page.waitForTimeout(400);
            const kept = await page.evaluate((g) => {
                const gi = document.querySelector(g).grid.gridInterface;
                const f = gi.getFind();
                return { same: gi.getDatasource().getRow(f.current.row) === window.__findEntity, current: f.current };
            }, grid);
            check(
                'a sort keeps the current match, at its new row',
                kept.same,
                JSON.stringify({ before: entityBefore, after: kept.current })
            );
            // an edit: the cell typed into gets marked when it shows the text
            await page.evaluate((g) => {
                document.querySelector(`${g} .simple-html-grid-body-scroller`).scrollTop = 0;
            }, grid);
            await page.waitForTimeout(300);
            await page.evaluate((g) => {
                const gi = document.querySelector(g).grid.gridInterface;
                gi.getDatasource().getRow(0).company = 'Norway Fish AS';
            }, grid);
            await page.waitForTimeout(400);
            const edited = await page.evaluate((g) => {
                const cell = [...document.querySelectorAll(`${g} .simple-html-cell-find-match`)].find(
                    (c) => c.$row === 0 && c.$attribute === 'company' && c.offsetParent !== null
                );
                return !!cell;
            }, grid);
            check('an edit: the cell is marked once it shows the text', edited);
            if (shots) {
                const box = await page.locator(grid).boundingBox();
                await page.screenshot({
                    path: `${shots}/find-filtered-light.png`,
                    clip: { x: box.x, y: box.y, width: box.width, height: 300 }
                });
            }
        }
        await page.close();
    }
    check('no page errors', errors.length === 0, errors.join(' | '));
    await browser.close();
    console.log(results.join('\n'));
    console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
})();
