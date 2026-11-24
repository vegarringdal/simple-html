// Real browser check of the quick dates of a date column's filter menu (filter.dates, datePresetBlock.ts):
// Today, Yesterday, This week ... one click each, relative to today. The "Full grid" sample
// (#sample/full-grid: Orderdate a date, Duedate a date shown as weekIso with every quick date - Overdue
// too - Updated a datetime), the page's clock fixed to Sunday 2026-11-22 10:00 (page.clock), light and
// dark at 1300x1100, and a phone (390x844, touch, light):
// - the block under the range block: 13 buttons on Orderdate (no Overdue), 14 on Duedate, two columns,
//   24px high, square, in the window; the names; the tooltip of a button is its days
// - each quick date on Orderdate: the rows of its days (counted in the page from the data), the menu
//   closed, the cell shows its name, the indicator a..b, the footer's chip `Orderdate = <name>`, the state
//   keeps `datePreset`; reopened: the one in use filled, the range block shows its days
// - Updated (datetime): Last 7 days from 00:00:00 to 23:59:59; Duedate (weekIso): This month is the month,
//   not weeks; Overdue: before today, no blanks
// - typing a date over it replaces it; the name typed is the quick date
// - the keyboard: Shift+F10, Tab to the quick dates (one stop), the arrows, Enter filters
// - relative: the state through JSON set on 2026-12-02 filters on December; the window getting the focus
//   back on 2026-11-23 filters Today on the 23rd
// - the phone (the Filtering sample, its date column): a tap on a button filters, the block fits the window
// - screenshots of the menu and the header/footer, light and dark, and the phone; no page errors
// Usage: node date-presets-check.js <site url> <shots dir>
const fs = require('node:fs');
const [, , base, shots] = process.argv;
if (!base || !shots) {
    console.log('usage: node date-presets-check.js <site url> <shots dir>');
    process.exit(2);
}
const { chromium } = require('playwright');
fs.mkdirSync(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = '') =>
    results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? `  (${JSON.stringify(detail)})` : ''}`);

const grid = '.stage simple-html-grid';
const blockSel = '.simple-html-grid-menu [data-menu-id="filter.dates"]';

// the days of each quick date on Sunday 2026-11-22, the week from Monday
const DAYS = {
    today: ['Today', '2026-11-22', '2026-11-22'],
    yesterday: ['Yesterday', '2026-11-21', '2026-11-21'],
    thisWeek: ['This week', '2026-11-16', '2026-11-22'],
    lastWeek: ['Last week', '2026-11-09', '2026-11-15'],
    thisMonth: ['This month', '2026-11-01', '2026-11-30'],
    lastMonth: ['Last month', '2026-10-01', '2026-10-31'],
    thisQuarter: ['This quarter', '2026-10-01', '2026-12-31'],
    lastQuarter: ['Last quarter', '2026-07-01', '2026-09-30'],
    thisYear: ['This year', '2026-01-01', '2026-12-31'],
    lastYear: ['Last year', '2025-01-01', '2025-12-31'],
    last7Days: ['Last 7 days', '2026-11-16', '2026-11-22'],
    last30Days: ['Last 30 days', '2026-10-24', '2026-11-22'],
    next7Days: ['Next 7 days', '2026-11-22', '2026-11-28'],
    overdue: ['Overdue', null, '2026-11-21']
};

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];
    const looks = [
        { name: 'light', dark: false, phone: false },
        { name: 'dark', dark: true, phone: false },
        { name: 'phone', dark: false, phone: true }
    ];
    for (const look of looks) {
        const theme = look.name;
        const page = await browser.newPage(
            look.phone
                ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
                : { viewport: { width: 1300, height: 1100 }, deviceScaleFactor: 1 }
        );
        page.on('pageerror', (e) => errors.push(`${theme}: ${e}`));
        page.on('console', (m) => m.type() === 'error' && errors.push(`${theme} console: ${m.text()}`));
        await page.clock.setFixedTime(new Date(2026, 10, 22, 10, 0, 0));
        await page.addInitScript((d) => localStorage.setItem('simple-html-demo-theme', d ? 'dark' : 'light'), look.dark);
        // the phone: the Filtering sample - the full grid's pinned columns leave no room for a middle column
        await page.goto(`${base}#sample/${look.phone ? 'filtering' : 'full-grid'}`);
        await page.waitForSelector(`${grid} .simple-html-grid-col-cell`);
        await page.waitForTimeout(400);

        // runs fn(gridInterface, arg) in the page, on the stage's grid
        const gi = (fn, arg) =>
            page.evaluate(
                ({ source, arg }) => {
                    const gridInterface = document.querySelector('.stage simple-html-grid').grid.gridInterface;
                    return new Function('gridInterface', 'arg', `return (${source})(gridInterface, arg)`)(gridInterface, arg);
                },
                { source: fn.toString(), arg }
            );
        await gi((g) => g.setState({ filter: null, headerFilters: {} }));
        // the date columns in view: the middle section scrolled to Orderdate (the docs site's sidebar takes
        // room). On the phone the date column of the Filtering sample
        await page.evaluate(
            ([g, left]) => {
                document.querySelector(`${g} .simple-html-grid-middle-scroller`).scrollLeft = left;
            },
            [grid, look.phone ? 400 : 500]
        );
        await page.waitForTimeout(300);
        const headerInput = (label) => page.locator(`${grid} input[aria-label="Filter ${label}"]:visible`).first();
        const presetButton = (preset) => page.locator(`${blockSel} [data-preset="${preset}"]`);
        const menus = () => page.evaluate(() => document.querySelectorAll('.simple-html-grid-menu').length);
        const chips = () =>
            page.evaluate(
                (g) => document.querySelector(`${g} .footer-filter-chips`)?.textContent.replace(/\s+/g, ' ').trim() ?? '',
                grid
            );
        const shown = () => gi((g) => g.getDatasource().getDataRows().length);
        /** the rows whose field is in the days from..to (from null: open), counted from the data */
        const expected = (field, from, to) =>
            gi(
                (g, [field, from, to]) => {
                    const day = (text, plus = 0) => {
                        const [y, m, d] = text.split('-').map(Number);
                        return new Date(y, m - 1, d + plus).getTime();
                    };
                    const start = from ? day(from) : Number.NEGATIVE_INFINITY;
                    const end = day(to, 1);
                    return g
                        .getDatasource()
                        .getAllData()
                        .filter(
                            (row) => row[field] instanceof Date && row[field].getTime() >= start && row[field].getTime() < end
                        ).length;
                },
                [field, from, to]
            );
        const openMenu = async (label) => {
            await page.keyboard.press('Escape');
            await headerInput(label).click({ button: 'right' });
            await page.waitForTimeout(150);
        };
        const shot = async (name) => {
            const box = await page.locator('.simple-html-grid-menu').first().boundingBox();
            const width = look.phone ? 390 : 1300;
            const x = Math.max(0, box.x - 120);
            const y = Math.max(0, box.y - 60);
            await page.screenshot({
                path: `${shots}/${theme}-${name}.png`,
                clip: { x, y, width: Math.min(look.phone ? 390 : 560, width - x), height: box.height + 100 }
            });
        };

        if (look.phone) {
            await openMenu('date');
            const fit = await page.evaluate((sel) => {
                const block = document.querySelector(sel);
                const rect = block.getBoundingClientRect();
                const heights = [...block.querySelectorAll('button')].map((b) => Math.round(b.getBoundingClientRect().height));
                const menu = block.closest('.simple-html-grid-popover').getBoundingClientRect();
                return {
                    left: rect.left,
                    right: rect.right,
                    heights: [...new Set(heights)],
                    menuTop: menu.top,
                    menuBottom: menu.bottom
                };
            }, blockSel);
            check(
                'phone: the block in the window',
                fit.left >= 0 && fit.right <= 390 && fit.menuTop >= 0 && fit.menuBottom <= 844,
                fit
            );
            check('phone: the buttons 24px, compact', fit.heights.length === 1 && fit.heights[0] === 24, fit.heights);
            await shot('menu');
            await presetButton('thisWeek').tap();
            await page.waitForTimeout(200);
            const [, from, to] = DAYS.thisWeek;
            check(
                'phone: a tap on This week filters its rows, the menu closes',
                (await shown()) === (await expected('date1', from, to)) && (await menus()) === 0,
                await shown()
            );
            check('phone: the cell shows This week', (await headerInput('date').inputValue()) === 'This week');
            await page.screenshot({ path: `${shots}/${theme}-grid.png` });
            await page.close();
            continue;
        }

        // ---- the block
        await openMenu('Orderdate');
        const ids = await page.evaluate(() =>
            [...document.querySelectorAll('.simple-html-grid-menu[role="menu"] > [data-menu-id]')].map((e) => e.dataset.menuId)
        );
        check(
            `${theme}: Orderdate's menu is Filter ›, the range block, the quick dates`,
            ids.join() === 'filter.filter,filter.range,filter.dates',
            ids.join()
        );
        const block = await page.evaluate((sel) => {
            const element = document.querySelector(sel);
            const buttons = [...element.querySelectorAll('button')];
            const rects = buttons.map((b) => b.getBoundingClientRect());
            const radius = [...element.querySelectorAll('*'), element]
                .map((e) => getComputedStyle(e).borderRadius)
                .filter((r) => r !== '0px');
            const range = document.querySelector('.simple-html-grid-menu [data-menu-id="filter.range"]').getBoundingClientRect();
            const box = element.getBoundingClientRect();
            return {
                names: buttons.map((b) => b.textContent.trim()),
                presets: buttons.map((b) => b.dataset.preset),
                twoColumns:
                    rects[0].left < rects[1].left &&
                    Math.round(rects[0].top) === Math.round(rects[1].top) &&
                    rects[2].top > rects[0].top &&
                    Math.round(rects[2].left) === Math.round(rects[0].left),
                heights: [...new Set(rects.map((r) => Math.round(r.height)))],
                radius,
                underRange: box.top >= range.bottom - 1 && Math.round(box.width) === Math.round(range.width),
                inWindow: box.right <= window.innerWidth && box.bottom <= window.innerHeight,
                group: [element.getAttribute('role'), element.getAttribute('aria-label')],
                tabStops: buttons.filter((b) => b.tabIndex === 0).map((b) => b.dataset.preset)
            };
        }, blockSel);
        check(
            `${theme}: 13 quick dates, no Overdue, named`,
            block.names.join('|') ===
                Object.values(DAYS)
                    .slice(0, 13)
                    .map((d) => d[0])
                    .join('|'),
            block.names.join('|')
        );
        check(
            `${theme}: two columns, 24px, square`,
            block.twoColumns && block.heights.join() === '24' && block.radius.length === 0,
            block
        );
        check(`${theme}: under the range block, as wide, in the window`, block.underRange && block.inWindow, block);
        check(
            `${theme}: a group named Quick dates, one stop of Tab`,
            block.group.join() === 'group,Quick dates' && block.tabStops.join() === 'today',
            block
        );

        // the tooltip of a button: its days
        await presetButton('thisMonth').hover();
        await page.waitForTimeout(700);
        const tooltip = await page.evaluate(() => document.querySelector('.simple-html-grid-tooltip')?.textContent.trim() ?? '');
        check(`${theme}: the tooltip of This month is its days`, tooltip === '2026-11-01 – 2026-11-30', tooltip);
        await shot('menu');

        // ---- each quick date on Orderdate
        for (const [preset, [name, from, to]] of Object.entries(DAYS)) {
            if (preset === 'overdue') {
                continue;
            }
            await openMenu('Orderdate');
            await presetButton(preset).click();
            await page.waitForTimeout(150);
            const rows = await shown();
            const want = await expected('orderDate', from, to);
            const state = await gi((g) => g.getState().headerFilters.orderDate);
            check(
                `${theme}: ${name} - ${want} rows of ${from}..${to}, menu closed, cell, chip, state`,
                rows === want &&
                    (await menus()) === 0 &&
                    (await headerInput('Orderdate').inputValue()) === name &&
                    (await chips()) === `Orderdate = ${name}` &&
                    state.datePreset === preset &&
                    state.operator === 'BETWEEN',
                { rows, want, chips: await chips(), state: state.datePreset }
            );
        }
        const indicator = await page.evaluate(
            (g) =>
                [...document.querySelectorAll(`${g} input[aria-label="Filter Orderdate"]`)]
                    .find((i) => i.offsetParent !== null)
                    .parentElement.querySelector('.simple-html-grid-filter-operator')
                    ?.textContent.trim(),
            grid
        );
        check(`${theme}: the indicator shows Between`, indicator === 'a..b', indicator);
        // reopened: the one in use filled, the range block has its days
        await openMenu('Orderdate');
        const reopened = await page.evaluate((sel) => {
            const current = [...document.querySelectorAll(`${sel} button[aria-current="true"]`)].map((b) => b.dataset.preset);
            const fill = getComputedStyle(document.querySelector(`${sel} button[aria-current="true"]`)).backgroundColor;
            const other = getComputedStyle(document.querySelector(`${sel} button:not([aria-current])`)).backgroundColor;
            const ends = [...document.querySelectorAll('.simple-html-grid-range-input')].map((i) => i.value);
            return { current, filled: fill !== other, ends };
        }, blockSel);
        check(
            `${theme}: reopened, Next 7 days filled, the range block 2026-11-22..2026-11-28`,
            reopened.current.join() === 'next7Days' && reopened.filled && reopened.ends.join() === '2026-11-22,2026-11-28',
            reopened
        );
        await shot('menu-in-use');
        await page.keyboard.press('Escape');
        await page.screenshot({ path: `${shots}/${theme}-grid.png`, clip: { x: 0, y: 0, width: 1300, height: 1100 } });

        // ---- Updated, a datetime: Last 7 days, whole days - Orderdate's filter cleared first
        await gi((g) => g.setState({ filter: null, headerFilters: {} }));
        await openMenu('Updated');
        await presetButton('last7Days').click();
        await page.waitForTimeout(150);
        {
            const want = await expected('updated', '2026-11-16', '2026-11-22');
            const filter = await gi((g) => JSON.stringify(g.getDatasource().getFilter()));
            check(
                `${theme}: Updated Last 7 days - the datetimes of the 16th to the 22nd, To 23:59:59`,
                (await shown()) === want && filter.includes('"updated"') && (await chips()).includes('Updated = Last 7 days'),
                { shown: await shown(), want }
            );
            const to = await gi((g) => {
                const value = g.getState().headerFilters.updated.value[1];
                return [value.getHours(), value.getMinutes(), value.getSeconds()].join(':');
            });
            check(`${theme}: Updated's To at 23:59:59`, to === '23:59:59', to);
        }
        await gi((g) => g.setState({ filter: null, headerFilters: {} }));

        // ---- Duedate, shown as weeks, every quick date: This month is the month, Overdue before today
        await openMenu('Duedate');
        const dueNames = await page.evaluate(
            (sel) => [...document.querySelectorAll(`${sel} button`)].map((b) => b.textContent.trim()),
            blockSel
        );
        check(
            `${theme}: Duedate has all 14, Overdue last`,
            dueNames.length === 14 && dueNames[13] === 'Overdue',
            dueNames.join('|')
        );
        await presetButton('thisMonth').click();
        await page.waitForTimeout(150);
        check(
            `${theme}: Duedate (weekIso) This month - the month, not its weeks`,
            (await shown()) === (await expected('dueDate', '2026-11-01', '2026-11-30')),
            { shown: await shown(), weeks: await expected('dueDate', '2026-10-26', '2026-12-06') }
        );
        await openMenu('Duedate');
        await presetButton('overdue').click();
        await page.waitForTimeout(150);
        {
            const want = await expected('dueDate', null, '2026-11-21');
            const blanks = await gi(
                (g) =>
                    g
                        .getDatasource()
                        .getDataRows()
                        .filter((r) => !(r.dueDate instanceof Date)).length
            );
            check(`${theme}: Overdue - the rows before today, no blank`, (await shown()) === want && blanks === 0, {
                shown: await shown(),
                want
            });
            check(
                `${theme}: Overdue's cell and chip`,
                (await headerInput('Duedate').inputValue()) === 'Overdue' && (await chips()) === 'Duedate = Overdue'
            );
        }

        // ---- typed over it: a week replaces it; the name typed is the quick date
        await headerInput('Duedate').fill('2026-W47');
        await headerInput('Duedate').press('Enter');
        await page.waitForTimeout(150);
        {
            const state = await gi((g) => g.getState().headerFilters.dueDate);
            check(
                `${theme}: 2026-W47 typed replaces it: the week, no quick date`,
                !state.datePreset && (await shown()) === (await expected('dueDate', '2026-11-16', '2026-11-22')),
                state
            );
        }
        await headerInput('Duedate').fill('last month');
        await headerInput('Duedate').press('Enter');
        await page.waitForTimeout(150);
        check(
            `${theme}: "last month" typed is Last month`,
            (await gi((g) => g.getState().headerFilters.dueDate.datePreset)) === 'lastMonth' &&
                (await headerInput('Duedate').inputValue()) === 'Last month' &&
                (await shown()) === (await expected('dueDate', '2026-10-01', '2026-10-31'))
        );
        await gi((g) => g.setState({ filter: null, headerFilters: {} }));

        // ---- the keyboard
        await headerInput('Orderdate').focus();
        await page.keyboard.press('Shift+F10');
        await page.waitForTimeout(150);
        let inBlock = false;
        for (let i = 0; i < 12 && !inBlock; i++) {
            await page.keyboard.press('Tab');
            inBlock = await page.evaluate(() => !!document.activeElement?.closest('[data-menu-id="filter.dates"]'));
        }
        const first = await page.evaluate(() => document.activeElement?.dataset.preset);
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowRight');
        const moved = await page.evaluate(() => document.activeElement?.dataset.preset);
        const focusLook = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
        await shot('keyboard');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
        check(
            `${theme}: keyboard - Tab to the quick dates (Today), ArrowDown, ArrowRight: Last week, focus outline, Enter filters`,
            inBlock &&
                first === 'today' &&
                moved === 'lastWeek' &&
                focusLook === 'solid' &&
                (await menus()) === 0 &&
                (await shown()) === (await expected('orderDate', '2026-11-09', '2026-11-15')),
            { inBlock, first, moved, focusLook }
        );

        // ---- relative: the state through JSON on another day, the window's focus on the next day
        await openMenu('Orderdate');
        await presetButton('thisMonth').click();
        await page.waitForTimeout(150);
        const saved = await gi((g) => JSON.stringify(g.getState()));
        await page.clock.setFixedTime(new Date(2026, 11, 2, 9, 0, 0));
        await gi((g, json) => g.setState(JSON.parse(json)), saved);
        await page.waitForTimeout(150);
        {
            const value = await gi((g) =>
                g
                    .getState()
                    .headerFilters.orderDate.value.map((d) => d.toDateString())
                    .join(' - ')
            );
            check(
                `${theme}: the state set on 2 December: This month is December`,
                value === 'Tue Dec 01 2026 - Thu Dec 31 2026' &&
                    (await shown()) === (await expected('orderDate', '2026-12-01', '2026-12-31')) &&
                    (await headerInput('Orderdate').inputValue()) === 'This month',
                value
            );
        }
        await page.clock.setFixedTime(new Date(2026, 10, 22, 10, 0, 0));
        await openMenu('Orderdate');
        await presetButton('today').click();
        await page.waitForTimeout(150);
        const todayRows = await shown();
        await page.clock.setFixedTime(new Date(2026, 10, 23, 8, 0, 0));
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await page.waitForTimeout(150);
        {
            const value = await gi((g) => g.getState().headerFilters.orderDate.value[0].toDateString());
            check(
                `${theme}: the window's focus on the 23rd: Today is the 23rd`,
                value === 'Mon Nov 23 2026' && (await shown()) === (await expected('orderDate', '2026-11-23', '2026-11-23')),
                { value, before: todayRows, after: await shown() }
            );
        }
        await page.close();
    }

    check('no page errors', errors.length === 0, errors.join(' | '));
    await browser.close();
    console.log(results.join('\n'));
    const failed = results.filter((line) => line.startsWith('FAIL')).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})();
