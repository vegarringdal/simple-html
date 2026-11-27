// Real browser check of the grid with a finger (touchScroll.ts, longPress.ts, dragEvent.ts, the coarse
// pointer css), Chromium's touch emulation - the touches are sent with CDP Input.dispatchTouchEvent, so
// the page gets real touch, pointer, mouse-compatibility and click events:
// - a swipe scrolls the rows (the page not), locked to its axis, the focus leaves the cell once a swipe
// - momentum after the finger lifts; a tap stops it and does not click the cell under it
// - sideways scrolls the middle columns; at the grid's edge the swipe goes to the page; two fingers are
//   the browser's
// - a long press opens the row / header / filter / column number menu at the finger, no click after it, no menu when the
//   finger moves; the browser's own contextmenu (Android) before or after ours makes one menu
// - a long press on the header label: the menu, no drag ghost left, no sort
// - a tap outside closes the menu, a tap opens a submenu, a tap on its item runs it
// - a long press on a row number opens the row menu (no tap after it, nothing selected); a tap selects
//   (touch-select-check.js has the taps that toggle and Select ›)
// - coarse pointer: menu items, the column chooser, the value list 28px (--simple-html-grid-touch-row-height); the chooser list scrolls with
//   a finger, a held field drags, its ghost over the chooser, dropped on the header
// - the filter editor moved and resized with a finger; the date picker on a tap; a double tap opens the
//   editor of a multiline cell (no zoom)
// - the mouse: items 20px, a held mouse opens no menu, a right click opens one, a column dragged
// Usage: node touch-check.js <site url> [screenshot dir]
const fs = require('node:fs');
const [, , base, shots] = process.argv;
if (!base) {
    console.log('usage: node touch-check.js <site url> [screenshot dir]');
    process.exit(2);
}
const { chromium } = require('playwright');
if (shots) {
    fs.mkdirSync(shots, { recursive: true });
}

const results = [];
const check = (name, ok, detail = '') =>
    results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? `  (${JSON.stringify(detail)})` : ''}`);

const grid = '.stage simple-html-grid';

// the docs site is not made for a phone (its sidebar takes half of it): the grid is given the page, with
// room above and under it so the page itself can scroll
const PHONE_LAYOUT = `
    html, body { overflow: auto !important; height: auto !important; }
    .sidebar, .code-panel, .main-header, .demo-toolbar, .demo-log { display: none !important; }
    .app, .main { display: block !important; height: auto !important; width: auto !important; }
    .stage { display: block !important; margin: 0 8px !important; }
    .stage simple-html-grid { height: 560px !important; }
    body::before, body::after { content: ''; display: block; height: 600px; }
`;

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];

    /** a page of a sample in a new context: `touch` a touch screen, `phone` the phone's size and layout */
    const open = async (sample, { touch = true, phone = false } = {}) => {
        const context = await browser.newContext(
            phone
                ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
                : { viewport: { width: 1300, height: 1400 }, hasTouch: touch, deviceScaleFactor: 1 }
        );
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push(`${sample}: ${e}`));
        // counts the popovers shown: one menu per long press
        await page.addInitScript(() => {
            window.__shown = 0;
            const show = HTMLElement.prototype.showPopover;
            HTMLElement.prototype.showPopover = function (...args) {
                window.__shown++;
                return show.apply(this, args);
            };
        });
        await page.goto(`${base}#sample/${sample}`);
        await page.waitForSelector(`${grid} .simple-html-grid-col-cell`);
        if (phone) {
            await page.addStyleTag({ content: PHONE_LAYOUT });
            await page.evaluate(() => window.dispatchEvent(new Event('resize')));
        }
        await page.waitForTimeout(400);
        const cdp = await context.newCDPSession(page);
        const send = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
        const finger = {
            down: (x, y) => send('touchStart', [{ x, y }]),
            move: (x, y) => send('touchMove', [{ x, y }]),
            up: () => send('touchEnd', []),
            /** a swipe from (x0, y0) to (x1, y1) in `steps` moves `stepMs` apart, lifted at the end */
            async swipe(x0, y0, x1, y1, { steps = 12, stepMs = 16, lift = true } = {}) {
                await this.down(x0, y0);
                for (let i = 1; i <= steps; i++) {
                    await page.waitForTimeout(stepMs);
                    await this.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
                }
                if (lift) {
                    await this.up();
                }
            },
            /** held still at (x, y) for `ms`, then lifted */
            async hold(x, y, ms) {
                await this.down(x, y);
                await page.waitForTimeout(ms);
                await this.up();
            }
        };
        return { page, context, finger, send };
    };

    const api = (page, code) =>
        page.evaluate(
            ([g, c]) => new Function('gi', `return (${c})`)(document.querySelector(g).grid.gridInterface),
            [grid, code]
        );
    const scroll = (page) =>
        page.evaluate((g) => {
            const body = document.querySelector(`${g} .simple-html-grid-body-scroller`);
            const middle = document.querySelector(`${g} .simple-html-grid-middle-scroller`);
            return { top: body.scrollTop, left: middle.scrollLeft, page: window.scrollY };
        }, grid);
    const setScroll = async (page, top, left = 0) => {
        await page.evaluate(
            ([g, t, l]) => {
                document.querySelector(`${g} .simple-html-grid-body-scroller`).scrollTop = t;
                document.querySelector(`${g} .simple-html-grid-middle-scroller`).scrollLeft = l;
            },
            [grid, top, left]
        );
        await page.waitForTimeout(250);
    };
    /** the middle of an element on screen: the `nth` of those that match and are on screen */
    const centerOf = (page, selector, nth = 0) =>
        page.evaluate(
            ([s, n]) => {
                const visible = [...document.querySelectorAll(s)].filter((e) => {
                    const r = e.getBoundingClientRect();
                    return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight;
                });
                const el = visible[n];
                if (!el) {
                    return null;
                }
                const r = el.getBoundingClientRect();
                return {
                    x: r.left + r.width / 2,
                    y: r.top + r.height / 2,
                    top: r.top,
                    bottom: r.bottom,
                    left: r.left,
                    right: r.right
                };
            },
            [selector, nth]
        );
    /** the middle of the menu entry `id`, scrolled into view in its menu first (a long menu scrolls) */
    const entryAt = async (page, id) => {
        await page.evaluate((i) => document.querySelector(`[data-menu-id="${i}"]`)?.scrollIntoView({ block: 'nearest' }), id);
        await page.waitForTimeout(50);
        return centerOf(page, `[data-menu-id="${id}"]`);
    };
    const cell = (page, field, nth = 3) => centerOf(page, `${grid} .simple-html-grid-body input[data-attribute="${field}"]`, nth);
    const menus = (page) =>
        page.evaluate(() =>
            [...document.querySelectorAll('.simple-html-grid-menu[role="menu"]')].map((m) => {
                const r = m.getBoundingClientRect();
                return { left: r.left, top: r.top, ids: [...m.querySelectorAll('[data-menu-id]')].map((e) => e.dataset.menuId) };
            })
        );
    /** Esc closes the menu (addMenuListeners) */
    const closeMenus = async (page) => {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
    };
    const shown = (page) => page.evaluate(() => window.__shown);
    const activeInGrid = (page) =>
        page.evaluate((g) => {
            const a = document.activeElement;
            return { inGrid: document.querySelector(g).contains(a) && a?.tagName === 'INPUT', readOnly: a?.readOnly ?? null };
        }, grid);
    const shot = async (page, name) => {
        if (shots) {
            await page.screenshot({ path: `${shots}/${name}.png` });
        }
    };

    await (async () => {
        // ---------------------------------------------------------------- the phone: swipes
        {
            const { page, context, finger } = await open('editing', { phone: true });
            const size = await page.evaluate((g) => document.querySelector(g).getBoundingClientRect().height, grid);
            check('phone: the grid is laid out big enough to swipe', size >= 500, size);
            await page.evaluate(() => window.scrollTo(0, 600));
            await page.waitForTimeout(200);
            await shot(page, 'phone-start');

            // a cell has the focus first: a swipe takes it once
            const company = await cell(page, 'company', 2);
            await page.touchscreen.tap(company.x, company.y);
            await page.waitForTimeout(150);
            check('phone: a tap on an editable cell gives it the focus', (await activeInGrid(page)).inGrid);
            await page.evaluate((g) => {
                window.__focus = { in: 0, out: 0 };
                const el = document.querySelector(g);
                el.addEventListener('focusin', () => window.__focus.in++);
                el.addEventListener('focusout', () => window.__focus.out++);
            }, grid);

            // up 300px, a fifth of it sideways, slowly: no momentum to speak of
            const before = await scroll(page);
            const age = await cell(page, 'age', 6);
            await finger.swipe(age.x, age.y + 100, age.x - 60, age.y - 200, { steps: 30, stepMs: 20, lift: false });
            await page.waitForTimeout(150);
            const held = await scroll(page);
            await finger.up();
            check(
                'swipe up: the rows scroll down with the finger',
                held.top - before.top >= 200 && held.top - before.top <= 300,
                [before.top, held.top]
            );
            check('swipe up: locked to its axis, the columns do not drift sideways', held.left === before.left, [
                before.left,
                held.left
            ]);
            check('swipe up: the page does not scroll along', held.page === before.page, [before.page, held.page]);
            const focus = await page.evaluate(() => window.__focus);
            check('swipe: the focus left the cell once, no focus moved into the grid', focus.out === 1 && focus.in === 0, focus);
            check('swipe: no cell has the focus after it', !(await activeInGrid(page)).inGrid);

            // momentum: a fast flick, then it coasts and stops
            await setScroll(page, 0);
            await finger.swipe(age.x, age.y + 120, age.x, age.y - 120, { steps: 8, stepMs: 16 });
            const lifted = await scroll(page);
            await page.waitForTimeout(150);
            const coasting = await scroll(page);
            await page.waitForTimeout(2500);
            const stopped = await scroll(page);
            await page.waitForTimeout(500);
            const still = await scroll(page);
            check('momentum: the rows coast on after the finger lifts', coasting.top > lifted.top + 20, [
                lifted.top,
                coasting.top
            ]);
            check('momentum: slows down and stops', stopped.top > coasting.top && still.top === stopped.top, [
                coasting.top,
                stopped.top,
                still.top
            ]);
            check('momentum: the page does not move', still.page === lifted.page, [lifted.page, still.page]);

            // a tap while it coasts stops it and is no tap: the cell under it gets no focus
            await setScroll(page, 0);
            await finger.swipe(age.x, age.y + 120, age.x, age.y - 120, { steps: 8, stepMs: 16 });
            await page.waitForTimeout(80);
            const target = await cell(page, 'company', 4);
            await finger.hold(target.x, target.y, 40);
            const tapped = await scroll(page);
            await page.waitForTimeout(400);
            const after = await scroll(page);
            check('momentum: a tap stops it', after.top === tapped.top, [tapped.top, after.top]);
            check('momentum: the tap that stopped it does not click the cell', !(await activeInGrid(page)).inGrid);

            // sideways
            await setScroll(page, 0);
            const middle = await page.evaluate((g) => {
                const r = document.querySelector(g).getBoundingClientRect();
                return r.left + r.width / 2;
            }, grid);
            await finger.swipe(middle + 100, age.y, middle - 100, age.y + 20, { steps: 20, stepMs: 25 });
            await page.waitForTimeout(800);
            const side = await scroll(page);
            check('swipe left: the middle columns scroll, the rows not', side.left >= 100 && side.top === 0, side);

            // at the top of the rows a swipe down is the page's
            await setScroll(page, 0, 0);
            const edge0 = await scroll(page);
            await finger.swipe(age.x, age.y - 100, age.x, age.y + 150, { steps: 20, stepMs: 20 });
            await page.waitForTimeout(800);
            const edge1 = await scroll(page);
            check(
                'edge: at the first row a swipe down scrolls the page, not the grid',
                edge1.top === 0 && edge1.page < edge0.page,
                [edge0, edge1]
            );
            await page.evaluate(() => window.scrollTo(0, 600));
            await page.waitForTimeout(200);

            await setScroll(page, 0);

            // ------------------------------------------------------------ the phone: long press
            const pressAt = await cell(page, 'country', 3);
            let count = await shown(page);
            await finger.down(pressAt.x, pressAt.y);
            await page.waitForTimeout(400);
            check('long press: no menu before 500ms', (await menus(page)).length === 0);
            await page.waitForTimeout(300);
            let shownMenus = await menus(page);
            check(
                'long press: the row menu opens while the finger is down',
                shownMenus.length === 1 && shownMenus[0].ids.includes('row.copy'),
                shownMenus.length
            );
            await shot(page, 'phone-long-press-row-menu');
            await finger.up();
            await page.waitForTimeout(300);
            shownMenus = await menus(page);
            check('long press: the menu stays open when the finger lifts (no click closed it)', shownMenus.length === 1);
            check('long press: one menu shown', (await shown(page)) - count === 1, (await shown(page)) - count);
            check('long press: the cell got no focus (no keyboard)', !(await activeInGrid(page)).inGrid);
            check(
                'long press: the menu under the cell, at the finger',
                shownMenus[0] && shownMenus[0].top >= pressAt.bottom - 2 && Math.abs(shownMenus[0].left + 65 - pressAt.x) < 140,
                [shownMenus[0]?.left, shownMenus[0]?.top, pressAt]
            );

            // a tap on a submenu's item opens it, a tap on an item in it runs it
            const view = await entryAt(page, 'row.view');
            await page.touchscreen.tap(view.x, view.y);
            await page.waitForTimeout(250);
            shownMenus = await menus(page);
            check(
                'tap: an item with a submenu opens it',
                shownMenus.length === 2 && shownMenus[1].ids.includes('row.view.dimRepeatedValues'),
                shownMenus.length
            );
            await shot(page, 'phone-submenu');
            const dimBefore = await api(page, 'gi.__getGridConfig().dimRepeatedValues');
            const dim = await entryAt(page, 'row.view.dimRepeatedValues');
            await page.touchscreen.tap(dim.x, dim.y);
            await page.waitForTimeout(250);
            check(
                'tap: an item of the submenu runs and closes the menus',
                (await menus(page)).length === 0 && (await api(page, 'gi.__getGridConfig().dimRepeatedValues')) !== dimBefore
            );
            await api(page, `gi.updateConfig({ dimRepeatedValues: ${!!dimBefore} })`);
            await page.waitForTimeout(200);

            // a tap outside closes the menu
            await finger.hold(pressAt.x, pressAt.y, 700);
            await page.waitForTimeout(200);
            check('long press: the menu again', (await menus(page)).length === 1);
            // under the grid: the page
            const below = await page.evaluate((g) => document.querySelector(g).getBoundingClientRect().bottom + 60, grid);
            await page.touchscreen.tap(195, below);
            await page.waitForTimeout(250);
            check('tap outside the grid closes the menu', (await menus(page)).length === 0);

            // a finger that moves is no long press
            await finger.down(pressAt.x, pressAt.y);
            for (let i = 1; i <= 5; i++) {
                await page.waitForTimeout(40);
                await finger.move(pressAt.x, pressAt.y - i * 8);
            }
            await page.waitForTimeout(600);
            await finger.up();
            await page.waitForTimeout(200);
            check('a finger that moves 40px: no menu', (await menus(page)).length === 0);
            await setScroll(page, 0);

            // the browser's own contextmenu first (Android): one menu, ours does not open another. Sent from
            // the page: a trusted one would come with a mouse pointerdown, which no long press has
            count = await shown(page);
            await finger.down(pressAt.x, pressAt.y);
            await page.waitForTimeout(250);
            await page.evaluate(
                ([x, y]) => {
                    document
                        .elementFromPoint(x, y)
                        .dispatchEvent(
                            new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 2 })
                        );
                },
                [pressAt.x, pressAt.y]
            );
            await page.waitForTimeout(500);
            await finger.up();
            await page.waitForTimeout(250);
            check(
                "the browser's contextmenu first: one menu, open after the finger lifts",
                (await shown(page)) - count === 1 && (await menus(page)).length === 1,
                (await shown(page)) - count
            );
            check("the browser's contextmenu first: the cell got no focus", !(await activeInGrid(page)).inGrid);
            await closeMenus(page);

            // the browser's own after ours, while the finger is down: canceled, no second menu
            count = await shown(page);
            await finger.down(pressAt.x, pressAt.y);
            await page.waitForTimeout(650);
            const late = await page.evaluate(
                ([g, x, y]) => {
                    // the cell under the finger (the menu is over the page now)
                    const input = [...document.querySelectorAll(`${g} input[data-attribute="country"]`)].find((i) => {
                        const r = i.getBoundingClientRect();
                        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
                    });
                    const event = new MouseEvent('contextmenu', {
                        bubbles: true,
                        cancelable: true,
                        clientX: x,
                        clientY: y,
                        button: 2
                    });
                    input.dispatchEvent(event);
                    return event.defaultPrevented;
                },
                [grid, pressAt.x, pressAt.y]
            );
            await finger.up();
            await page.waitForTimeout(250);
            check(
                "the browser's contextmenu after ours: canceled, one menu",
                late && (await shown(page)) - count === 1 && (await menus(page)).length === 1,
                [late, (await shown(page)) - count]
            );
            await closeMenus(page);

            // the header label: the menu, the drag the hold started ends - no ghost, no sort, no column moved
            // the label's left part: on the phone it runs past the header's end, its middle under the gutter
            // over the rows' scrollbar
            const label = await page.evaluate((g) => {
                const r = document.querySelector(`${g} [data-attribute-header="age"]`).getBoundingClientRect();
                return { x: r.left + 15, y: r.top + r.height / 2 };
            }, grid);
            const layout0 = await api(page, 'JSON.stringify(gi.__getGridConfig().layout)');
            const sort0 = await api(page, 'JSON.stringify(gi.getDatasource().getLastSorting())');
            await finger.down(label.x, label.y);
            await page.waitForTimeout(300);
            const ghostWhileHeld = await page.evaluate(() => !!document.querySelector('.simple-html-draggable-element'));
            await page.waitForTimeout(400);
            await finger.up();
            await page.waitForTimeout(250);
            shownMenus = await menus(page);
            check('long press on a label: the hold made a drag first (200ms)', ghostWhileHeld);
            check(
                'long press on a label: the header menu',
                shownMenus.length === 1 && shownMenus[0].ids.includes('header.column.chooser'),
                shownMenus.length
            );
            check(
                'long press on a label: no ghost left',
                !(await page.evaluate(() => !!document.querySelector('.simple-html-draggable-element')))
            );
            check(
                'long press on a label: no sort, no column moved',
                (await api(page, 'JSON.stringify(gi.__getGridConfig().layout)')) === layout0 &&
                    (await api(page, 'JSON.stringify(gi.getDatasource().getLastSorting())')) === sort0
            );
            await shot(page, 'phone-header-menu');
            await closeMenus(page);

            // the filter row
            const filter = await centerOf(page, `${grid} .simple-html-grid-cell-filter-input`);
            await finger.hold(filter.x, filter.y, 700);
            await page.waitForTimeout(250);
            shownMenus = await menus(page);
            check(
                'long press on a header filter: the filter menu',
                shownMenus.length === 1 && shownMenus[0].ids.some((id) => id.startsWith('filter.')),
                shownMenus.length
            );
            await closeMenus(page);

            // the column numbers (the row under the filter row)
            const number = await centerOf(page, `${grid} .simple-html-grid-header [type="selector"]`, 1);
            await finger.hold(number.x, number.y, 700);
            await page.waitForTimeout(250);
            shownMenus = await menus(page);
            check(
                'long press on a column number: the column menu',
                shownMenus.length === 1 && shownMenus[0].ids.some((id) => id.startsWith('column.')),
                shownMenus.length
            );
            check('the long presses sorted nothing', (await api(page, 'gi.getDatasource().getLastSorting().length')) === 0);
            await shot(page, 'phone-column-menu');
            await closeMenus(page);

            // a long press on the row number: the row menu (it has one now), no tap after it - nothing selected
            const selector = await centerOf(page, `${grid} .simple-html-grid-body-row-container-selector [aria-colindex="1"]`, 2);
            const selected0 = await api(page, 'JSON.stringify(gi.getDatasource().getSelectedRows())');
            await finger.hold(selector.x, selector.y, 700);
            await page.waitForTimeout(250);
            const selected1 = await api(page, 'JSON.stringify(gi.getDatasource().getSelectedRows())');
            const rowNumberMenus = await menus(page);
            check(
                'long press on a row number: the row menu, the lift selects nothing',
                rowNumberMenus.length === 1 && rowNumberMenus[0].ids.includes('row.select') && selected1 === selected0,
                [rowNumberMenus.length, selected0, selected1]
            );
            await closeMenus(page);

            // a tap on a row number selects
            const selector2 = await centerOf(
                page,
                `${grid} .simple-html-grid-body-row-container-selector [aria-colindex="1"]`,
                5
            );
            await page.touchscreen.tap(selector2.x, selector2.y);
            await page.waitForTimeout(200);
            const selected2 = await api(page, 'JSON.stringify(gi.getDatasource().getSelectedRows())');
            check('tap on a row number selects the row', selected2 !== selected1, [selected1, selected2]);

            // two fingers: the browser's (last: the page is zoomed after it)
            await setScroll(page, 100);
            const pinch0 = await scroll(page);
            await context.newCDPSession(page).then(async (cdp) => {
                const t = (type, a, b) =>
                    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [a, b] });
                await t('touchStart', { x: 150, y: 400, id: 1 }, { x: 250, y: 400, id: 2 });
                for (let i = 1; i <= 10; i++) {
                    await page.waitForTimeout(16);
                    await t('touchMove', { x: 150 - i * 5, y: 400 - i * 10, id: 1 }, { x: 250 + i * 5, y: 400 - i * 10, id: 2 });
                }
                await t('touchEnd');
            });
            await page.waitForTimeout(500);
            const pinch1 = await scroll(page);
            const scale = await page.evaluate(() => window.visualViewport.scale);
            check('two fingers: the grid does not scroll, the browser zooms the page', pinch1.top === pinch0.top && scale > 1, [
                pinch0.top,
                pinch1.top,
                scale
            ]);

            await context.close();
        }

        // ---------------------------------------------------------------- a touch screen: menus, chooser, dialog
        {
            const { page, context, finger } = await open('editing');
            check('touch screen: (pointer: coarse) matches', await page.evaluate(() => matchMedia('(pointer: coarse)').matches));
            const pressAt = await cell(page, 'country', 3);
            await finger.hold(pressAt.x, pressAt.y, 700);
            await page.waitForTimeout(250);
            const itemHeight = await page.evaluate(
                () => document.querySelector('.simple-html-grid-menu [role^="menuitem"]')?.getBoundingClientRect().height
            );
            check('coarse: a menu item is 28px high', itemHeight === 28, itemHeight);
            const copy = await entryAt(page, 'row.copy');
            await page.touchscreen.tap(copy.x, copy.y);
            await page.waitForTimeout(250);
            const subHeight = await page.evaluate(
                () => document.querySelector('[data-menu-id="row.copy.cell"]')?.getBoundingClientRect().height
            );
            check('coarse: a tap opens the submenu, its items 28px', subHeight === 28, subHeight);
            await shot(page, 'touch-row-menu');
            await closeMenus(page);

            // the column chooser from the header menu
            const label = await centerOf(page, `${grid} [data-attribute-header="age"]`);
            await finger.hold(label.x, label.y, 700);
            await page.waitForTimeout(250);
            const chooserEntry = await entryAt(page, 'header.column.chooser');
            await page.touchscreen.tap(chooserEntry.x, chooserEntry.y);
            await page.waitForTimeout(300);
            const chooser = await page.evaluate(() => {
                const list = document.querySelector('.simple-html-grid-menu-sub.simple-html-dialog-scroller');
                const item = list?.querySelector('.simple-html-grid-menu-item');
                return list
                    ? {
                          items: list.children.length,
                          height: item.getBoundingClientRect().height,
                          touchAction: item.style.touchAction,
                          scrollable: list.scrollHeight > list.clientHeight
                      }
                    : null;
            });
            check('chooser: opened from the header menu by taps', !!chooser, chooser);
            check('chooser: its fields 28px, pan-y', chooser?.height === 28 && chooser?.touchAction === 'pan-y', chooser);
            // fewer fields than it has room for: a lower list, so it scrolls
            if (chooser && !chooser.scrollable) {
                await page.evaluate(() => {
                    document.querySelector('.simple-html-grid-menu-sub.simple-html-dialog-scroller').style.maxHeight = '100px';
                });
            }
            const listItem = await centerOf(page, '.simple-html-grid-menu-sub .simple-html-grid-menu-item', 1);
            await finger.swipe(listItem.x, listItem.y + 30, listItem.x, listItem.y - 30, { steps: 10, stepMs: 20 });
            await page.waitForTimeout(400);
            const listTop = await page.evaluate(
                () => document.querySelector('.simple-html-grid-menu-sub.simple-html-dialog-scroller').scrollTop
            );
            check('chooser: a swipe scrolls its list', listTop > 0, listTop);
            check(
                'chooser: a swipe drags nothing',
                !(await page.evaluate(() => !!document.querySelector('.simple-html-draggable-element')))
            );
            await shot(page, 'touch-chooser');

            // held still it drags; the ghost over the chooser; dropped on a label's center: the fields swap.
            // The list back at its top: its first field in view
            await page.evaluate(() => {
                document.querySelector('.simple-html-grid-menu-sub.simple-html-dialog-scroller').scrollTop = 0;
            });
            await page.waitForTimeout(100);
            const item = await centerOf(page, '.simple-html-grid-menu-sub .simple-html-grid-menu-item', 0);
            const field = await page.evaluate(
                ([x, y]) => document.elementFromPoint(x, y)?.closest('.simple-html-grid-menu-item')?.$attribute,
                [item.x, item.y]
            );
            const target = await centerOf(page, `${grid} [data-attribute-header="phone"]`);
            await finger.down(item.x, item.y);
            await page.waitForTimeout(300);
            for (let i = 1; i <= 6; i++) {
                await page.waitForTimeout(20);
                await finger.move(item.x + i * 4, item.y + i * 3);
            }
            const ghost = await page.evaluate(() => {
                const g = document.querySelector('.simple-html-draggable-element');
                if (!g) {
                    return null;
                }
                const r = g.getBoundingClientRect();
                // what is painted at the ghost's middle: with pointer-events on, the hit test finds the top
                g.style.pointerEvents = 'auto';
                const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
                g.style.pointerEvents = 'none';
                return { open: g.matches(':popover-open'), onTop: g.contains(top), text: g.textContent.trim() };
            });
            check(
                'chooser: a held field drags, its ghost a popover painted over the chooser',
                ghost?.open && ghost?.onTop,
                ghost
            );
            const listTopDrag = await page.evaluate(
                () => document.querySelector('.simple-html-grid-menu-sub.simple-html-dialog-scroller').scrollTop
            );
            await shot(page, 'touch-chooser-drag');
            for (let i = 1; i <= 10; i++) {
                await page.waitForTimeout(20);
                await finger.move(item.x + ((target.x - item.x) * i) / 10, item.y + ((target.y - item.y) * i) / 10);
            }
            const listTopAfter = await page.evaluate(
                () => document.querySelector('.simple-html-grid-menu-sub.simple-html-dialog-scroller').scrollTop
            );
            check('chooser: the list does not pan under a drag', listTopAfter === listTopDrag, [listTopDrag, listTopAfter]);
            await finger.up();
            await page.waitForTimeout(300);
            const center = await api(page, 'gi.__getGridConfig().layout.center.map((c) => c.fields.join("+"))');
            check(
                'chooser: dropped on a label, the field is in the header',
                center.some((c) => c.split('+').includes(field)),
                [field, center]
            );
            check(
                'chooser: no ghost left',
                !(await page.evaluate(() => !!document.querySelector('.simple-html-draggable-element')))
            );
            await page.evaluate(() => document.querySelector('.simple-html-label-button-menu-bottom')?.click());
            await page.waitForTimeout(200);

            // the filter editor with a finger: moved by its titlebar, resized by its corner
            const filter = await centerOf(page, `${grid} .simple-html-grid-cell-filter-input`);
            await finger.hold(filter.x, filter.y, 700);
            await page.waitForTimeout(250);
            if (!(await entryAt(page, 'filter.filter.advanced'))) {
                const opener = await entryAt(page, 'filter.filter');
                await page.touchscreen.tap(opener.x, opener.y);
                await page.waitForTimeout(250);
            }
            const advanced = await entryAt(page, 'filter.filter.advanced');
            await page.touchscreen.tap(advanced.x, advanced.y);
            await page.waitForTimeout(400);
            const dialogRect = () =>
                page.evaluate(() => {
                    const r = document.querySelector('dialog.filter-editor-content[open]')?.getBoundingClientRect();
                    return r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
                });
            const d0 = await dialogRect();
            check('filter editor: opened by taps', !!d0, d0);
            const title = await centerOf(page, 'dialog[open] .filter-editor-titlebar');
            await finger.swipe(title.x - 100, title.y, title.x - 200, title.y + 60, { steps: 10, stepMs: 20 });
            await page.waitForTimeout(200);
            const d1 = await dialogRect();
            check(
                'filter editor: a finger on the titlebar moves it',
                d1 && Math.round(d1.left - d0.left) === -100 && Math.round(d1.top - d0.top) === 60,
                [d0, d1]
            );
            const corner = await page.evaluate(() => {
                const r = document.querySelector('dialog[open] .handle-se').getBoundingClientRect();
                return { x: r.left + r.width / 2, y: r.top + r.height / 2, size: r.width };
            });
            check("coarse: the filter editor's corner is 20px", corner.size === 20, corner.size);
            await finger.swipe(corner.x, corner.y, corner.x + 60, corner.y + 40, { steps: 10, stepMs: 20 });
            await page.waitForTimeout(200);
            const d2 = await dialogRect();
            check(
                'filter editor: a finger on the corner resizes it',
                d2 && Math.round(d2.width - d1.width) === 60 && Math.round(d2.height - d1.height) === 40,
                [d1, d2]
            );
            await shot(page, 'touch-filter-editor');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(200);

            // the date picker opens on a tap on a date cell
            const date = await cell(page, 'date1', 2);
            await page.touchscreen.tap(date.x, date.y);
            await page.waitForTimeout(300);
            check(
                'tap on a date cell: the date picker opens',
                await page.evaluate(() => !!document.querySelector('.simple-html-grid-popover simple-html-date'))
            );
            await shot(page, 'touch-date-picker');
            await context.close();
        }

        // ---------------------------------------------------------------- a double tap: the cell's, not a zoom
        {
            const { page, context } = await open('multiline', { phone: true });
            const touchAction = await page.evaluate((g) => getComputedStyle(document.querySelector(g)).touchAction, grid);
            const note = await centerOf(page, `${grid} .simple-html-grid-body input.simple-html-grid-cell-multiline`, 0);
            await page.touchscreen.tap(note.x, note.y);
            await page.waitForTimeout(80);
            await page.touchscreen.tap(note.x, note.y);
            await page.waitForTimeout(400);
            const editor = await page.evaluate(() => !!document.querySelector('.simple-html-grid-text-editor-input'));
            check(
                'double tap on a multiline cell: its editor opens, no zoom (touch-action: manipulation)',
                touchAction === 'manipulation' && editor && (await page.evaluate(() => window.visualViewport.scale)) === 1,
                [touchAction, editor]
            );
            await shot(page, 'phone-multiline-editor');
            await context.close();
        }

        // ---------------------------------------------------------------- readonly: a tap gives no keyboard
        {
            const { page, context } = await open('editing');
            await api(page, 'gi.updateConfig({ readonly: true })');
            await page.waitForTimeout(300);
            const any = await centerOf(page, `${grid} .simple-html-grid-body input.simple-html-grid-cell-input`, 3);
            await page.touchscreen.tap(any.x, any.y);
            await page.waitForTimeout(200);
            const active = await activeInGrid(page);
            check(
                'readonly grid: a tap focuses the cell, its input readonly (no keyboard)',
                active.inGrid && active.readOnly === true,
                active
            );
            await context.close();
        }

        // ---------------------------------------------------------------- the mouse, as it was
        {
            const { page, context } = await open('editing', { touch: false });
            check(
                'mouse: (pointer: coarse) does not match',
                !(await page.evaluate(() => matchMedia('(pointer: coarse)').matches))
            );
            const at = await cell(page, 'country', 3);
            await page.mouse.move(at.x, at.y);
            await page.mouse.down();
            await page.waitForTimeout(800);
            await page.mouse.up();
            await page.waitForTimeout(200);
            check('mouse: a held button opens no menu', (await menus(page)).length === 0);
            const count = await shown(page);
            await page.mouse.click(at.x, at.y, { button: 'right' });
            await page.waitForTimeout(200);
            const itemHeight = await page.evaluate(
                () => document.querySelector('.simple-html-grid-menu [role^="menuitem"]')?.getBoundingClientRect().height
            );
            check('mouse: a right click opens one menu, items 20px', (await shown(page)) - count === 1 && itemHeight === 20, [
                itemHeight
            ]);
            await closeMenus(page);

            // a column dragged with the mouse: its ghost (a popover now) follows, dropped left of another label
            const from = await centerOf(page, `${grid} [data-attribute-header="phone"]`);
            const to = await page.evaluate((g) => {
                const r = document
                    .querySelector(`${g} [data-attribute-header="age"]`)
                    .closest('.simple-html-grid-col-cell')
                    .getBoundingClientRect();
                return { x: r.left + 4, y: r.top + r.height / 2 };
            }, grid);
            await page.mouse.move(from.x, from.y);
            await page.mouse.down();
            for (let i = 1; i <= 10; i++) {
                await page.mouse.move(from.x + ((to.x - from.x) * i) / 10, from.y + ((to.y - from.y) * i) / 10);
            }
            const mouseGhost = await page.evaluate(() => {
                const g = document.querySelector('.simple-html-draggable-element');
                const r = g?.getBoundingClientRect();
                return g ? { open: g.matches(':popover-open'), left: Math.round(r.left), top: Math.round(r.top) } : null;
            });
            await shot(page, 'mouse-drag');
            await page.mouse.up();
            await page.waitForTimeout(300);
            const fields = await api(page, 'gi.__getGridConfig().layout.center.map((c) => c.fields.join("+"))');
            check(
                'mouse: a dragged label has its ghost (a popover) at the pointer',
                mouseGhost?.open && Math.abs(mouseGhost.left - to.x) < 3 && Math.abs(mouseGhost.top - to.y) < 3,
                [mouseGhost, to]
            );
            check(
                'mouse: dropped left of a label, the column moved there',
                fields.indexOf('phone') === fields.indexOf('age') - 1,
                fields
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
