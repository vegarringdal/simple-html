// Real browser check of the date pickers of a date column's filter - the user: "our date picker needs to
// come when we select" (the range block of the filter menu) and "if its in between when we select
// datepicker, we need to be able to select range... so there is 2 date pickers side by side".
// The "Filtering" sample (#sample/filtering), its date column (date1, "date"), in a wide window and on a
// phone (390x844, touch), light and dark, the default theme and TreDeSpace:
// - the header filter with BETWEEN: a click opens the range picker - two months (one on the phone) - on
//   its from..to; two days picked and Use filter the rows to them, the cell shows from..to
// - the range block's From / To with Between: the range picker, the filter menu stays open, Use fills
//   both inputs (nothing filtered), Apply filters
// - the value input with ≥: the single date picker, Use fills it; Esc closes the picker only, a second
//   Esc the menu
// - the pickers in the window, no rounded corners; screenshots of each
// Usage: node date-range-check.js <site url> <shots dir>
const fs = require('node:fs');
const [, , base, shots] = process.argv;
if (!base || !shots) {
    console.log('usage: node date-range-check.js <site url> <shots dir>');
    process.exit(2);
}
const { chromium } = require('playwright');
fs.mkdirSync(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? `  (${detail})` : ''}`);

// the docs site is not made for a phone (its sidebar takes half of it): the grid is given the page, as
// touch-check.js does
const PHONE_LAYOUT = `
    html, body { overflow: auto !important; height: auto !important; }
    .sidebar, .code-panel, .main-header, .demo-toolbar, .demo-log { display: none !important; }
    .app, .main { display: block !important; height: auto !important; width: auto !important; }
    .stage { display: block !important; margin: 0 8px !important; }
    .stage simple-html-grid { height: 560px !important; }
`;

const RUNS = [
    { name: 'wide-light', phone: false, dark: false, theme: 'default' },
    { name: 'wide-dark', phone: false, dark: true, theme: 'default' },
    { name: 'wide-tds-light', phone: false, dark: false, theme: 'tredespace' },
    { name: 'wide-tds-dark', phone: false, dark: true, theme: 'tredespace' },
    { name: 'phone-light', phone: true, dark: false, theme: 'default' },
    { name: 'phone-tds-dark', phone: true, dark: true, theme: 'tredespace' }
];

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];

    for (const run of RUNS) {
        const { name, phone } = run;
        const width = phone ? 390 : 1300;
        const height = phone ? 844 : 1000;
        const page = await browser.newPage(
            phone
                ? { viewport: { width, height }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
                : { viewport: { width, height }, deviceScaleFactor: 1 }
        );
        page.on('pageerror', (e) => errors.push(`${name}: ${String(e)}`));
        page.on('console', (m) => m.type() === 'error' && errors.push(`${name} console: ${m.text()}`));
        await page.addInitScript(
            ([dark, theme]) => {
                localStorage.setItem('simple-html-demo-theme', dark ? 'dark' : 'light');
                localStorage.setItem('simple-html-demo-grid-theme', theme);
            },
            [run.dark, run.theme]
        );
        await page.goto(`${base}#sample/filtering`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell input');
        if (phone) {
            await page.addStyleTag({ content: PHONE_LAYOUT });
            await page.evaluate(() => window.dispatchEvent(new Event('resize')));
        }
        await page.waitForTimeout(300);
        if (phone) {
            // the date column is off the phone's screen, and not rendered there: the grid scrolled until its
            // header filter is shown on the left of the screen
            for (let step = 0; step < 20; step++) {
                const left = await page.evaluate(() => {
                    const input = document.querySelector('.stage input[aria-label="Filter date"]');
                    const rect = input?.getBoundingClientRect();
                    return rect && rect.width > 0 && input.checkVisibility() ? rect.left : null;
                });
                if (left !== null && left > 0 && left < 200) {
                    break;
                }
                await page.evaluate(() => {
                    document.querySelector('.stage simple-html-grid .simple-html-grid-middle-scroller').scrollLeft += 100;
                });
                await page.waitForTimeout(150);
            }
        }

        // runs fn(gridInterface, arg) in the page, on the stage's grid
        const grid = (fn, arg) =>
            page.evaluate(
                ({ source, arg }) => {
                    const gridInterface = document.querySelector('.stage simple-html-grid').grid.gridInterface;
                    return new Function('gridInterface', 'arg', `return (${source})(gridInterface, arg)`)(gridInterface, arg);
                },
                { source: fn.toString(), arg }
            );
        const headerInput = () => page.locator('.stage input[aria-label="Filter date"]').first();
        const blockSel = '.simple-html-grid-menu [data-menu-id="filter.range"]';
        const rangeInput = (n) => page.locator(`${blockSel} .simple-html-grid-range-input`).nth(n);
        const operator = (symbol) =>
            page.locator(`${blockSel} .simple-html-grid-range-operator`).filter({ hasText: new RegExp(`^\\s*${symbol}\\s*$`) });
        const inputValues = () =>
            page.evaluate(
                (sel) => [...document.querySelectorAll(`${sel} .simple-html-grid-range-input`)].map((i) => i.value),
                blockSel
            );
        const menuOpen = () => page.evaluate(() => document.querySelectorAll('.simple-html-grid-menu').length > 0);
        const pickers = () => page.locator('simple-html-date').count();
        const dates = () =>
            grid((gi) =>
                gi
                    .getDatasource()
                    .getDataRows()
                    .map((r) => (r.date1 ? r.date1.getTime() : null))
            );
        const day = (y, m, d) => new Date(y, m, d).getTime();
        const allIn = (list, from, to) => list.length > 0 && list.every((t) => t !== null && t >= from && t <= to);

        // the picker open: its months, the days marked in the first month, its box, rounded corners, the
        // From / To line
        const pickerLook = () =>
            page.evaluate(() => {
                const date = document.querySelector('simple-html-date');
                if (!date) {
                    return null;
                }
                const first = date.querySelector('.simple-html-date-month');
                const marked = (cls) =>
                    [...first.querySelectorAll(`.simple-html-date-day.${cls}:not(.simple-html-date-day-dimmed)`)].map((e) =>
                        Number(e.textContent.trim())
                    );
                const box = date.parentElement.getBoundingClientRect();
                const radius = [date, ...date.querySelectorAll('*')]
                    .map((e) => getComputedStyle(e).borderRadius)
                    .filter((r) => r !== '0px');
                const inRange = date.querySelector('.simple-html-date-day-in-range');
                const selected = date.querySelector('.simple-html-date-day-selected');
                return {
                    months: date.querySelectorAll('.simple-html-date-month').length,
                    titles: [...date.querySelectorAll('.simple-html-date-month-title')].map((t) =>
                        t.textContent.replace(/\s+/g, ' ').trim()
                    ),
                    range: !!date.querySelector('.simple-html-date-range'),
                    time: !!date.querySelector('.simple-html-date-time'),
                    selected: marked('simple-html-date-day-selected'),
                    inRange: marked('simple-html-date-day-in-range'),
                    ends: [...date.querySelectorAll('.simple-html-date-range-day')].map((e) => e.textContent.trim()),
                    box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
                    radius,
                    inRangeBg: inRange ? getComputedStyle(inRange).backgroundColor : null,
                    selectedBg: selected ? getComputedStyle(selected).backgroundColor : null,
                    pageBg: getComputedStyle(date).backgroundColor,
                    inMenu: !!document.querySelector('[data-menu-id="filter.range"]')?.closest('[popover]')?.contains(date)
                };
            });
        const inWindow = (look) =>
            look && look.box.left >= 0 && look.box.top >= 0 && look.box.right <= width && look.box.bottom <= height;
        // a click with the mouse, a tap of a finger on the phone
        const press = (locator) => (phone ? locator.tap() : locator.click());
        const clickDay = async (n, monthIndex = 0) => {
            await press(
                page
                    .locator('simple-html-date .simple-html-date-month')
                    .nth(monthIndex)
                    .locator('.simple-html-date-day:not(.simple-html-date-day-dimmed)')
                    .nth(n - 1)
            );
        };
        const pickerButton = (text) => page.locator('simple-html-date button.simple-html-date-button', { hasText: text });
        const shot = async (file) => {
            const box = await page.evaluate(() => {
                const els = [...document.querySelectorAll('simple-html-date, .simple-html-grid-menu')].map((e) =>
                    (e.closest('[popover]') ?? e).getBoundingClientRect()
                );
                const r = els.reduce(
                    (a, b) => ({
                        left: Math.min(a.left, b.left),
                        top: Math.min(a.top, b.top),
                        right: Math.max(a.right, b.right),
                        bottom: Math.max(a.bottom, b.bottom)
                    }),
                    { left: 1e9, top: 1e9, right: 0, bottom: 0 }
                );
                return r;
            });
            const x = Math.max(0, box.left - 30);
            const y = Math.max(0, box.top - 60);
            await page.screenshot({
                path: `${shots}/${name}-${file}.png`,
                clip: {
                    x,
                    y,
                    width: Math.min(width - x, box.right - box.left + 60),
                    height: Math.min(height - y, box.bottom - box.top + 90)
                }
            });
        };
        const openFilterMenu = async () => {
            await headerInput().click({ button: 'right' });
            await page.waitForTimeout(200);
        };

        // a run that throws (a locator that times out) is a FAIL, the next run goes on
        try {
            // ---- the header filter with BETWEEN: the range picker
            await grid((gi) => gi.setState({ headerFilters: { date1: { value: null, operator: 'BETWEEN' } } }));
            await page.waitForTimeout(100);
            await headerInput().fill('2026-07-05..2026-07-12');
            await headerInput().press('Enter');
            await page.waitForTimeout(100);
            check(`${name}: typed 2026-07-05..2026-07-12 filters`, allIn(await dates(), day(2026, 6, 5), day(2026, 6, 12)));
            await press(headerInput());
            await page.waitForTimeout(250);
            let look = await pickerLook();
            check(
                `${name}: the BETWEEN cell opens the range picker`,
                look && look.range && !look.time,
                JSON.stringify(look && { range: look.range, time: look.time })
            );
            check(
                `${name}: ${phone ? 'one month on the phone' : 'two months side by side'}`,
                look && look.months === (phone ? 1 : 2),
                look && look.titles.join(', ')
            );
            check(
                `${name}: on the cell's from..to: 5 and 12 selected, 6-11 between`,
                look && look.selected.join() === '5,12' && look.inRange.join() === '6,7,8,9,10,11',
                look && `${look.selected} / ${look.inRange}`
            );
            check(`${name}: the range picker in the window`, inWindow(look), look && JSON.stringify(look.box));
            check(`${name}: no rounded corners in the picker`, look && look.radius.length === 0, look && look.radius.join());
            // the default theme: a fill of their own, TreDeSpace: the selected day's (the library's span)
            const ownFill =
                run.theme === 'tredespace'
                    ? look && look.inRangeBg === look.selectedBg
                    : look && look.inRangeBg !== look.selectedBg;
            check(
                `${name}: the days between have a fill (in range / selected / background)`,
                look && look.inRangeBg !== look.pageBg && ownFill,
                look && `${look.inRangeBg} / ${look.selectedBg} / ${look.pageBg}`
            );
            await shot('header-range-open');
            await clickDay(10);
            await clickDay(20);
            await page.waitForTimeout(100);
            look = await pickerLook();
            check(
                `${name}: 10 then 20: From and To`,
                look && look.selected.join() === '10,20' && look.ends.join(' | ') === '10 July 2026 | 20 July 2026',
                look && `${look.selected} / ${look.ends.join(' | ')}`
            );
            await shot('header-range-picked');
            await press(pickerButton('Use'));
            await page.waitForTimeout(150);
            check(`${name}: Use closes the picker`, (await pickers()) === 0);
            check(
                `${name}: Use filters the rows to 2026-07-10..2026-07-20`,
                allIn(await dates(), day(2026, 6, 10), day(2026, 6, 20)),
                `${(await dates()).length} rows`
            );
            check(
                `${name}: the cell shows the range`,
                (await headerInput().inputValue()) === '2026-07-10..2026-07-20',
                await headerInput().inputValue()
            );

            // ---- the range block: From / To of Between open the range picker, the menu stays open
            await openFilterMenu();
            check(
                `${name}: the range block has Between and the range`,
                (await inputValues()).join() === '2026-07-10,2026-07-20',
                (await inputValues()).join()
            );
            await press(rangeInput(0));
            await page.waitForTimeout(150);
            look = await pickerLook();
            check(
                `${name}: From opens the range picker in the menu's popover, the menu stays open`,
                look && look.range && look.inMenu && (await menuOpen()),
                JSON.stringify(look && { range: look.range, inMenu: look.inMenu })
            );
            check(`${name}: the block's range picker in the window`, inWindow(look), look && JSON.stringify(look.box));
            check(`${name}: on From and To: 10 and 20`, look && look.selected.join() === '10,20', look && look.selected.join());
            await clickDay(3);
            await clickDay(8);
            await shot('block-range-picked');
            await press(pickerButton('Use'));
            await page.waitForTimeout(150);
            check(
                `${name}: Use fills From and To, the picker closes, the menu stays`,
                (await inputValues()).join() === '2026-07-03,2026-07-08' && (await pickers()) === 0 && (await menuOpen()),
                (await inputValues()).join()
            );
            check(`${name}: nothing filtered before Apply`, allIn(await dates(), day(2026, 6, 10), day(2026, 6, 20)));
            await shot('block-range-filled');
            await press(page.locator(`${blockSel} .simple-html-grid-button-primary`));
            await page.waitForTimeout(150);
            check(
                `${name}: Apply filters 2026-07-03..2026-07-08`,
                allIn(await dates(), day(2026, 6, 3), day(2026, 6, 8)) && !(await menuOpen()),
                `${(await dates()).length} rows`
            );
            check(
                `${name}: the cell shows it`,
                (await headerInput().inputValue()) === '2026-07-03..2026-07-08',
                await headerInput().inputValue()
            );

            // ---- the value input with ≥: the single date picker
            await openFilterMenu();
            await press(operator('≥'));
            await page.waitForTimeout(100);
            await press(rangeInput(0));
            await page.waitForTimeout(150);
            look = await pickerLook();
            check(
                `${name}: ≥: the value input opens the date picker (time, no range), the menu stays`,
                look && !look.range && look.time && look.months === 1 && look.inMenu && (await menuOpen()),
                JSON.stringify(look && { range: look.range, time: look.time, months: look.months })
            );
            check(
                `${name}: on the date the input holds (From: 3 July)`,
                look && look.titles[0] === 'July 2026' && look.selected.join() === '3',
                look && `${look.titles} ${look.selected}`
            );
            check(`${name}: the block's date picker in the window`, inWindow(look), look && JSON.stringify(look.box));
            await shot('block-single');
            // Esc: the picker only, then the menu
            await page.keyboard.press('Escape');
            await page.waitForTimeout(100);
            check(`${name}: Esc closes the picker only`, (await pickers()) === 0 && (await menuOpen()));
            await press(rangeInput(0));
            await page.waitForTimeout(150);
            await clickDay(15);
            await press(pickerButton('Use'));
            await page.waitForTimeout(100);
            check(
                `${name}: a day and Use fill the value`,
                (await inputValues()).join() === '2026-07-15' && (await menuOpen()),
                (await inputValues()).join()
            );
            // the focus stayed in the input: Enter applies
            await page.keyboard.press('Enter');
            await page.waitForTimeout(150);
            check(
                `${name}: Enter applies ≥ 2026-07-15`,
                allIn(await dates(), day(2026, 6, 15), day(2027, 0, 1)) && !(await menuOpen()),
                `${(await dates()).length} rows`
            );
            await openFilterMenu();
            await press(rangeInput(0));
            await page.waitForTimeout(150);
            await page.keyboard.press('Escape');
            await page.waitForTimeout(100);
            await page.keyboard.press('Escape');
            await page.waitForTimeout(100);
            check(`${name}: Esc, Esc: the picker, then the menu`, (await pickers()) === 0 && !(await menuOpen()));
            check(`${name}: Esc left the filter as it was`, (await headerInput().inputValue()) === '2026-07-15');

            // ---- the header filter with ≥: the single picker still
            await press(headerInput());
            await page.waitForTimeout(250);
            look = await pickerLook();
            check(
                `${name}: the ≥ cell opens the date picker`,
                look && !look.range && look.time,
                JSON.stringify(look && { range: look.range, time: look.time })
            );
            await page.keyboard.press('Escape');
        } catch (e) {
            check(`${name}: ran to the end`, false, String(e).split('\n')[0]);
            await page.screenshot({ path: `${shots}/${name}-error.png` });
        }

        await page.close();
    }

    await browser.close();
    for (const line of results) {
        console.log(line);
    }
    console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');
    const failed = results.filter((line) => line.startsWith('FAIL')).length;
    console.log(`${results.length - failed}/${results.length} passed`);
    process.exit(failed || errors.length ? 1 : 0);
})();
