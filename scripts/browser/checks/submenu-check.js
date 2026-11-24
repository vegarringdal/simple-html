// The submenus of the grid's menus in a real browser: hover and click open them on the right,
// flipped left near the right edge, kept in the window near the bottom, the keyboard through the
// levels, an item in a submenu runs its action and closes all, the heights of the menus, the
// accessibility tree, light and dark screenshots.
// Usage: node submenu-check.js <site url> <shots dir>
//   Chromium: CHROMIUM_PATH, else playwright's own
const path = require('node:path');
const fs = require('node:fs');
const [, , base, shots] = process.argv;
if (!base || !shots) {
    console.log('usage: node submenu-check.js <site url> <shots dir>');
    process.exit(2);
}
const { chromium } = require('playwright');
const executablePath = process.env.CHROMIUM_PATH || undefined;
fs.mkdirSync(shots, { recursive: true });

// the menus before the submenus (26d0db3), editing sample, 1400 x 900: px high, rows
const BEFORE = { row: { h: 762, rows: 38 }, header: { h: 485, rows: 24 }, filter: { h: 537, rows: 11 } };

const results = [];
const check = (name, pass, detail = '') => results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);

(async () => {
    const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));

    await page.goto(`${base}/#sample/editing`);
    await page.waitForSelector('.stage input[data-attribute="age"]', { timeout: 15000 });
    await page.evaluate(() => document.body.classList.remove('dark'));

    /** the open menu and its submenus: their rects, and how many rows each shows */
    const levels = () =>
        page.evaluate(() =>
            Array.from(document.querySelectorAll('.simple-html-grid-menu[role="menu"]')).map((menu) => {
                const r = menu.parentElement.getBoundingClientRect();
                const rows = Array.from(menu.children).filter((c) => c.getBoundingClientRect().height > 2).length;
                return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, h: Math.round(r.height), rows };
            })
        );
    const rectOf = (id) =>
        page.evaluate((id) => {
            const r = document.querySelector(`[data-menu-id="${id}"]`)?.getBoundingClientRect();
            return r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null;
        }, id);
    const activeId = () =>
        page.evaluate(() => document.activeElement?.getAttribute('data-menu-id') ?? document.activeElement?.tagName);
    const entry = (id) => page.locator(`[data-menu-id="${id}"]`);
    const closeAll = async () => {
        await page.keyboard.press('Escape');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(50);
    };

    const age = page.locator('.stage input[data-attribute="age"]').first();
    const ageLabel = page.locator('.stage [data-attribute-header="age"]').first();
    const companyFilter = page.locator('.stage input[aria-label="Filter Company"]').first();

    // 1. the heights, of the same menus as before
    await age.click({ button: 'right' });
    await page.waitForTimeout(150);
    const row = (await levels())[0];
    check(`row menu: ${row.h}px, ${row.rows} rows (before ${BEFORE.row.h}px, ${BEFORE.row.rows} rows)`, row.h < BEFORE.row.h / 2);
    await page.screenshot({ path: `${shots}/light-row-menu.png` });
    await closeAll();

    await ageLabel.click({ button: 'right' });
    await page.waitForTimeout(150);
    const header = (await levels())[0];
    check(
        `header menu: ${header.h}px, ${header.rows} rows (before ${BEFORE.header.h}px, ${BEFORE.header.rows} rows)`,
        header.h < BEFORE.header.h / 2
    );

    // 2. hover: Aggregate opens on the right of the menu, its first item level with the item
    const aggregateItem = await rectOf('header.aggregate');
    await page.mouse.move(aggregateItem.left + 20, aggregateItem.top + 10);
    await page.waitForTimeout(80);
    check('hover: not open before the delay', (await levels()).length === 1);
    await page.waitForTimeout(200);
    let open = await levels();
    check('hover: the submenu opens after the delay', open.length === 2);
    check(
        'hover: on the right of the menu, first item level with its item',
        open.length === 2 && Math.abs(open[1].left - open[0].right) <= 1 && Math.abs(open[1].top - (aggregateItem.top - 1)) <= 1,
        JSON.stringify({ menuRight: open[0].right, subLeft: open[1]?.left, itemTop: aggregateItem.top, subTop: open[1]?.top })
    );
    check('hover: aria-expanded true on its item', (await entry('header.aggregate').getAttribute('aria-expanded')) === 'true');
    await page.screenshot({ path: `${shots}/light-header-aggregate.png` });

    // the pointer moves diagonally into the submenu across Grouping: Aggregate stays open
    const groupingItem = await rectOf('header.grouping');
    const sumItem = await rectOf('header.aggregate.sum');
    await page.mouse.move(groupingItem.right - 5, groupingItem.top + 5);
    await page.mouse.move(sumItem.left + 10, sumItem.top + 10, { steps: 3 });
    await page.waitForTimeout(250);
    check('diagonal move into the submenu across another item keeps it', (await entry('header.aggregate.sum').count()) === 1);

    // resting on another item closes it, opens the other
    await page.mouse.move(groupingItem.left + 20, groupingItem.top + 10);
    await page.waitForTimeout(250);
    check(
        'resting on another item swaps the submenu',
        (await entry('header.aggregate.sum').count()) === 0 && (await entry('header.grouping.expandAll').count()) === 1
    );

    // 3. an item in a submenu: Pin left, the whole menu closes and the column is pinned
    await entry('header.column.pin').click();
    await page.waitForTimeout(100);
    check('click: the pin submenu opens', (await entry('header.column.pinLeft').count()) === 1);
    await entry('header.column.pinLeft').click();
    await page.waitForTimeout(200);
    check('an item in a submenu closes the whole menu', (await page.locator('.simple-html-grid-menu').count()) === 0);
    const pinnedLeft = () =>
        page.evaluate(
            () =>
                !!document.querySelector(
                    '.stage .simple-html-grid-header-row-container-pinned-left [data-attribute-header="age"]'
                )
        );
    check('Pin left ran: age is pinned left', await pinnedLeft());
    // unpin again from the keyboard: Shift+F10 on the label
    // the column header that takes the focus is the cell around the label
    await page.evaluate(() => document.querySelector('.stage [data-attribute-header="age"]').closest('[tabindex]').focus());
    await page.keyboard.press('Shift+F10');
    await page.waitForTimeout(150);
    check('Shift+F10 on a label: the focus on the first item', (await activeId()) === 'header.column.pin');
    await page.keyboard.press('ArrowRight');
    check('ArrowRight: the pin submenu, the focus on its first item', (await activeId()) === 'header.column.pinRight');
    await page.keyboard.press('End');
    check('End: Unpin', (await activeId()) === 'header.column.unpin');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    check(
        'Enter on Unpin: unpinned, the menu closed',
        !(await pinnedLeft()) && (await page.locator('.simple-html-grid-menu').count()) === 0
    );

    // 4. the filter menu: its height, Filter › Operator › with a ✓
    await companyFilter.click({ button: 'right' });
    await page.waitForTimeout(150);
    const filter = (await levels())[0];
    check(
        `filter menu: ${filter.h}px, ${filter.rows} rows with the value list (before ${BEFORE.filter.h}px, ${BEFORE.filter.rows})`,
        filter.h < BEFORE.filter.h
    );
    await entry('filter.filter').click();
    await page.waitForTimeout(100);
    await entry('filter.operator').click();
    await page.waitForTimeout(100);
    check('filter menu: Filter › Operator ›, two levels open', (await levels()).length === 3);
    const checked = await page.evaluate(() =>
        Array.from(
            document.querySelectorAll('[data-menu-id^="filter.operator."]'),
            (el) => `${el.getAttribute('data-menu-id')}:${el.getAttribute('aria-checked')}`
        )
    );
    check('operator submenu: one checked', checked.filter((c) => c.endsWith(':true')).length === 1, checked.join(' '));
    const tick = await page.evaluate(() => {
        const el = document.querySelector('.simple-html-grid-menu-item-selected');
        return el ? getComputedStyle(el, '::before').content : null;
    });
    check('the checked item shows a ✓', !!tick && tick.includes('✓'), tick);
    await page.screenshot({ path: `${shots}/light-filter-operator.png` });
    await closeAll();

    // 5. the keyboard through the row menu: Shift+F10, a letter, ArrowRight / ArrowLeft, Esc, focus back
    await age.click();
    await page.keyboard.press('Shift+F10');
    await page.waitForTimeout(150);
    check('Shift+F10 in a cell: the focus on the first item, the Undo / Redo submenu', (await activeId()) === 'row.edit');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
    check('ArrowRight into it: Undo last change, disabled but focusable', (await activeId()) === 'row.edit.undo');
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(100);
    await page.keyboard.press('c');
    check('a letter: the next item starting with it', (await activeId()) === 'row.copy');
    await page.keyboard.press('ArrowRight');
    check(
        'ArrowRight: Copy opens, the focus on Cell Value',
        (await activeId()) === 'row.copy.cell' && (await levels()).length === 2
    );
    await page.keyboard.press('ArrowLeft');
    check('ArrowLeft: closed, the focus back on Copy', (await activeId()) === 'row.copy' && (await levels()).length === 1);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    check('Esc in a submenu: only it closes', (await activeId()) === 'row.copy' && (await levels()).length === 1);
    const ring = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
    check('the item the keyboard is on has the focus outline', ring === 'solid', ring);
    await page.screenshot({ path: `${shots}/light-row-keyboard.png` });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(50);
    const backInCell = await page.evaluate(() => document.activeElement?.getAttribute('data-attribute'));
    check('Esc in the menu: closed, the focus back in the cell', backInCell === 'age' && (await levels()).length === 0);

    // Copy › Cell Value from the keyboard runs, closes all
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(base).origin });
    await page.keyboard.press('Shift+F10');
    await page.keyboard.press('c');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    const clip = await page.evaluate(() => navigator.clipboard.readText().catch((e) => `error ${e.message}`));
    const cellValue = await age.inputValue();
    check(
        'Copy › Cell Value with Enter: copied, all closed',
        clip === cellValue && (await levels()).length === 0,
        `${clip} / ${cellValue}`
    );

    // a menu opened with the mouse: the focus stays in the cell, ArrowDown gets in
    await age.click({ button: 'right' });
    await page.waitForTimeout(100);
    check(
        'mouse opened: the focus stays in the cell',
        (await page.evaluate(() => document.activeElement?.getAttribute('data-attribute'))) === 'age'
    );
    await page.keyboard.press('ArrowDown');
    check('ArrowDown gets into it', (await activeId()) === 'row.edit');
    await closeAll();

    // 6. the accessibility tree of a menu with a submenu open
    await ageLabel.click({ button: 'right' });
    await page.waitForTimeout(100);
    await entry('header.aggregate').click();
    await page.waitForTimeout(100);
    const snapshot = await page.accessibility.snapshot({ interestingOnly: true });
    const roles = [];
    const walk = (node) => {
        if (['menu', 'menuitem', 'menuitemcheckbox'].includes(node.role)) {
            const checkedState = node.checked !== undefined ? `:checked=${node.checked}` : '';
            const expandedState = node.expanded !== undefined ? `:expanded=${node.expanded}` : '';
            roles.push(`${node.role}:${node.name}${checkedState}${expandedState}${node.disabled ? ':disabled' : ''}`);
        }
        for (const child of node.children ?? []) walk(child);
    };
    walk(snapshot);
    const menus = roles.filter((r) => r.startsWith('menu:'));
    check(
        'a11y: two menus, the submenu named by its item',
        menus.length === 2 && menus[1] === 'menu:Aggregate',
        menus.join(' | ')
    );
    check(
        'a11y: Aggregate expanded',
        roles.some((r) => r.startsWith('menuitem:Aggregate') && r.includes('expanded=true'))
    );
    check(
        'a11y: the toggles are checkbox items',
        roles.some((r) => r.startsWith('menuitemcheckbox:Totals row'))
    );
    console.log(`a11y: ${roles.join(' | ')}`);
    await closeAll();

    // 7. near the right edge: the submenu flips to the left of the menu
    await page.setViewportSize({ width: 1250, height: 900 });
    await page.waitForTimeout(200);
    // the cell furthest right that is shown whole: focusing one cut off would scroll the grid, and a
    // scroll closes the menus in this sample (autoRemoveContextMenuOnScrollEvent)
    const rightmost = await page.evaluate(() => {
        const points = Array.from(document.querySelectorAll('.stage input[data-attribute]'))
            .map((input) => {
                const r = input.getBoundingClientRect();
                return { input, left: r.left + 2, x: r.right - 5, y: r.top + 5 };
            })
            .filter(
                ({ input, left, x, y }) =>
                    x < innerWidth && document.elementFromPoint(x, y) === input && document.elementFromPoint(left, y) === input
            );
        const best = points.sort((a, b) => b.x - a.x)[0];
        return { x: best.x, y: best.y };
    });
    await page.mouse.click(rightmost.x, rightmost.y, { button: 'right' });
    await page.waitForTimeout(150);
    await entry('row.size').click();
    await page.waitForTimeout(100);
    open = await levels();
    check(
        'near the right edge: flipped to the left of the menu, in the window',
        open.length === 2 && Math.abs(open[1].right - open[0].left) <= 1 && open[1].left >= 4 && open[0].right <= 1250 - 3,
        JSON.stringify(open.map((l) => [Math.round(l.left), Math.round(l.right)]))
    );
    await page.screenshot({ path: `${shots}/light-right-edge.png` });
    await closeAll();

    // 8. near the bottom of the window: the filter menu of the active column opens under its header
    // filter, its bottom near the bottom of the window. The Filter submenu, at its item, would go
    // under the window: it is moved up into it. The blank submenu in it too. 850 high: the Filter
    // submenu is short. The window is made 80px taller than the filter's bottom - where the filter is
    // depends on the page above the grid (the source panel starts folded), so it is measured first.
    // The boolean column (it was Age): a number column's menu has the range block under Filter › now
    // (filter.range), taller than its submenu - it does not fit under the filter, it opens above it
    await page.evaluate(() => window.scrollTo(0, 0));
    const ageFilter = page.locator('.stage input[aria-label="Filter active"]').first();
    const measured = await ageFilter.boundingBox();
    const HEIGHT = Math.ceil(measured.y + measured.height) + 80;
    await page.setViewportSize({ width: 1400, height: HEIGHT });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const filterBox = await ageFilter.boundingBox();
    await ageFilter.click({ button: 'right' });
    await page.waitForTimeout(150);
    const filterRect = await rectOf('filter.filter');
    await entry('filter.filter').click();
    await page.waitForTimeout(100);
    open = await levels();
    check(
        'near the bottom: the submenu moved up into the window',
        open.length === 2 &&
            open[0].top >= filterBox.y + filterBox.height &&
            open[0].bottom <= HEIGHT - 3 &&
            Math.abs(open[1].bottom - (HEIGHT - 4)) <= 1 &&
            open[1].top < filterRect.top - 1,
        JSON.stringify({
            height: HEIGHT,
            filterBottom: filterBox.y + filterBox.height,
            itemTop: filterRect?.top,
            menu: [Math.round(open[0].top), Math.round(open[0].bottom)],
            sub: open[1] && [Math.round(open[1].top), Math.round(open[1].bottom)]
        })
    );
    await entry('filter.filter.blank').click();
    await page.waitForTimeout(100);
    open = await levels();
    check(
        'near the bottom: the submenu in the submenu in the window too',
        open.length === 3 && open.every((level) => level.top >= 4 && level.bottom <= HEIGHT - 3),
        JSON.stringify(open.map((level) => [Math.round(level.top), Math.round(level.bottom)]))
    );
    await page.screenshot({ path: `${shots}/light-bottom.png` });
    await closeAll();
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.waitForTimeout(200);

    // 9. a click outside closes the menu and its submenus
    await age.click({ button: 'right' });
    await entry('row.view').click();
    await page.waitForTimeout(100);
    await page.mouse.click(5, 890);
    await page.waitForTimeout(100);
    check('a click outside closes all', (await page.locator('.simple-html-grid-popover').count()) === 0);

    // 10. dark
    await page.evaluate(() => document.body.classList.add('dark'));
    await age.click({ button: 'right' });
    await page.waitForTimeout(100);
    await entry('row.view').hover();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${shots}/dark-row-view.png` });
    const colours = await page.evaluate(() => {
        const sub = document.querySelectorAll('.simple-html-grid-menu[role="menu"]')[1];
        const item = sub?.querySelector('[role^="menuitem"]');
        return sub && item ? { bg: getComputedStyle(sub).backgroundColor, color: getComputedStyle(item).color } : null;
    });
    check('dark: the submenu is dark', !!colours && colours.bg === 'rgb(55, 65, 81)', JSON.stringify(colours));
    await closeAll();
    // the sum of age on: a ✓ in the aggregate submenu, and in the light theme too
    await ageLabel.click({ button: 'right' });
    await entry('header.aggregate').click();
    await entry('header.aggregate.sum').click();
    await page.waitForTimeout(200);
    await ageLabel.click({ button: 'right' });
    await entry('header.aggregate').click();
    await page.waitForTimeout(100);
    const sumChecked = await entry('header.aggregate.sum').getAttribute('aria-checked');
    check('Aggregate › Sum turned on: checked the next time', sumChecked === 'true', sumChecked);
    await page.screenshot({ path: `${shots}/dark-header-aggregate.png` });
    await page.evaluate(() => document.body.classList.remove('dark'));
    await page.waitForTimeout(100);
    await page.screenshot({ path: `${shots}/light-header-aggregate-checked.png` });
    await closeAll();

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
