// Real browser check of filter as shown (ColumnFormat.filterAsShown) and filter as you type
// (ColumnConfig.filterOnType, the toggle of the operator choice) on the "Full grid" sample
// (#sample/full-grid: Due Date shown as weekIso, Updated as norwegianTime, Credit as 1 234,56), light
// and dark:
// - Due Date: Equal from the operator choice, `2026-W47` typed: the rows of week 47 only, the filter a
//   BETWEEN of Monday and Sunday, the cell shows `2026-W47` after the header is rendered again; the
//   placeholder is today's week
// - the date picker from the cell writes the week of the day picked; Between `2026-W40..2026-W47`, the
//   range picker opens on it and writes weeks
// - Updated switched to Norwegian (Format ›): a day typed `05.11.2026` is that whole day
// - Credit: `5 000,5` typed is 5000.5, shown so again
// - Company: Filter as you type turned on in the operator choice (its ✓), Begins with: the rows change
//   while typing without Enter, after the pause; the focus and the caret stay - also with a letter put in
//   the middle; Enter after it does not filter again
// - the grid config dialog: Filter as shown under the format of Due Date, greyed out for Day of week;
//   Filter as you type next to the operator
// - no errors on the page
// Usage: node filter-as-shown-check.js <site url> <shots dir>
const fs = require('node:fs');
const [, , base, shots] = process.argv;
if (!base || !shots) {
    console.log('usage: node filter-as-shown-check.js <site url> <shots dir>');
    process.exit(2);
}
const { chromium } = require('playwright');
// a column's settings are in tabs: an element of a hidden one, its tab clicked first
require('../sections')();
fs.mkdirSync(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = '') =>
    results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? `  (${JSON.stringify(detail)})` : ''}`);

const grid = '.stage simple-html-grid';
const filterInput = (label) => `${grid} input[aria-label="Filter ${label}"]:visible`;

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];
    for (const dark of [false, true]) {
        const theme = dark ? 'dark' : 'light';
        const page = await browser.newPage({ viewport: { width: 1300, height: 1100 } });
        page.on('pageerror', (e) => errors.push(`${theme}: ${e}`));
        page.on('console', (m) => m.type() === 'error' && errors.push(`${theme} console: ${m.text()}`));
        await page.addInitScript((d) => localStorage.setItem('simple-html-demo-theme', d ? 'dark' : 'light'), dark);
        await page.goto(`${base}#sample/full-grid`);
        await page.waitForSelector(`${grid} .simple-html-grid-col-cell`);
        await page.waitForTimeout(400);

        /** the shown values of a column's cells, the first rows */
        const cells = (field, count = 12) =>
            page.evaluate(
                ([g, field, count]) =>
                    [...document.querySelectorAll(`${g} input[data-attribute="${field}"]`)]
                        .filter((input) => input.offsetParent !== null)
                        .map((input) => ({ row: input.closest('.simple-html-grid-col-cell').$row, value: input.value }))
                        .sort((a, b) => a.row - b.row)
                        .slice(0, count)
                        .map((cell) => cell.value),
                [grid, field, count]
            );
        const rowCount = () =>
            page.evaluate((g) => document.querySelector(g).grid.gridInterface.getDatasource().getRows().length, grid);
        /** the conditions of a field at the top of the filter, as JSON gives them (a Date is its ISO text) */
        const conditionsOf = (field) =>
            page.evaluate(
                ([g, field]) => {
                    const filter = document.querySelector(g).grid.gridInterface.getDatasource().getFilter();
                    const children = filter?.children ?? (filter ? [filter] : []);
                    return JSON.parse(JSON.stringify(children.filter((child) => child.field === field || child.children)));
                },
                [grid, field]
            );
        /** a local date as the ISO text JSON writes for it */
        const iso = (y, m, d, h = 0, mi = 0, s = 0) =>
            page.evaluate((p) => new Date(...p).toISOString(), [y, m - 1, d, h, mi, s]);
        const value = (label) => page.locator(filterInput(label)).inputValue();
        /** types into a header filter from the keyboard: its text replaced, then Enter */
        const typeFilter = async (label, text, enter = true) => {
            const input = page.locator(filterInput(label));
            // focus, not a click: a click in a date filter opens the date picker
            await input.focus();
            await page.keyboard.press('Control+A');
            await page.keyboard.press('Backspace');
            if (text) {
                await page.keyboard.type(text);
            }
            if (enter) {
                await page.keyboard.press('Enter');
            }
            await page.waitForTimeout(200);
        };
        /** opens the operator choice from the symbol in the cell */
        const openChoice = async (label) => {
            await page.locator(filterInput(label)).locator('xpath=..').locator('.simple-html-grid-filter-operator').click();
            await page.waitForTimeout(150);
        };
        const pickOperator = async (label, id) => {
            await openChoice(label);
            await page.locator(`[data-menu-id="${id}"]`).click();
            await page.waitForTimeout(200);
        };
        const scrollMiddle = async (left) => {
            await page.evaluate(
                ([g, px]) => {
                    document.querySelector(`${g} .simple-html-grid-middle-scroller`).scrollLeft = px;
                },
                [grid, left]
            );
            await page.waitForTimeout(300);
        };

        // Credit, Due Date and Updated in view: the middle section scrolled
        await scrollMiddle(300);
        await page.screenshot({ path: `${shots}/fas-start-${theme}.png` });

        // ------------------------------------------------------------- a week
        check(
            `${theme}: Duedate's placeholder is this week, an example`,
            /^\d{4}-W\d{2}$/.test(await page.locator(filterInput('Duedate')).getAttribute('placeholder')),
            await page.locator(filterInput('Duedate')).getAttribute('placeholder')
        );
        const total = await rowCount();
        await pickOperator('Duedate', 'filter.operator.equal');
        await typeFilter('Duedate', '2026-W47');
        const week = await cells('dueDate');
        check(
            `${theme}: = 2026-W47 shows the rows of week 47 only`,
            week.length > 0 && week.every((text) => text === '2026-W47'),
            week.slice(0, 4)
        );
        const monday = await iso(2026, 11, 16);
        const sunday = await iso(2026, 11, 22);
        const weekConditions = await conditionsOf('dueDate');
        check(
            `${theme}: the filter is a BETWEEN of Monday and Sunday`,
            JSON.stringify(weekConditions) ===
                JSON.stringify([{ field: 'dueDate', operator: 'BETWEEN', value: [monday, sunday] }]),
            weekConditions
        );
        const weekRows = await rowCount();
        check(`${theme}: fewer rows than all`, weekRows > 0 && weekRows < total, [weekRows, total]);
        await page.screenshot({ path: `${shots}/fas-week-${theme}.png` });
        // the header rendered again: scrolled away and back
        await scrollMiddle(3000);
        await scrollMiddle(300);
        await page.evaluate((g) => document.querySelector(g).grid.gridInterface.rebuild(), grid);
        await page.waitForTimeout(200);
        check(
            `${theme}: the cell shows 2026-W47 again after a render`,
            (await value('Duedate')) === '2026-W47',
            await value('Duedate')
        );

        // ------------------------------------------------------------- the date picker writes a week
        await typeFilter('Duedate', '');
        await page.locator(filterInput('Duedate')).click();
        await page.waitForSelector('simple-html-date');
        await page.waitForTimeout(200);
        const day18 = page
            .locator('simple-html-date .simple-html-date-month')
            .first()
            .locator('.simple-html-date-day:not(.simple-html-date-day-dimmed)', { hasText: /^\s*18\s*$/ })
            .first();
        await day18.click();
        await page.screenshot({ path: `${shots}/fas-picker-${theme}.png` });
        await page.locator('simple-html-date .simple-html-date-button-primary').click();
        await page.waitForTimeout(250);
        const picked = await value('Duedate');
        check(`${theme}: a day picked writes its week`, /^\d{4}-W\d{2}$/.test(picked), picked);
        const pickedRows = await cells('dueDate');
        check(
            `${theme}: and filters on that week`,
            pickedRows.length > 0 && pickedRows.every((text) => text === picked),
            pickedRows.slice(0, 3)
        );

        // ------------------------------------------------------------- Between weeks, the range picker
        await pickOperator('Duedate', 'filter.operator.between');
        await typeFilter('Duedate', '2026-W40..2026-W47');
        const between = await cells('dueDate');
        const inRange = (text) => /^2026-W(4[0-7])$/.test(text);
        check(
            `${theme}: Between 2026-W40..2026-W47 shows weeks 40 to 47`,
            between.length > 0 && between.every(inRange),
            between.slice(0, 5)
        );
        const betweenConditions = await conditionsOf('dueDate');
        check(
            `${theme}: from Monday of week 40 to Sunday of week 47`,
            JSON.stringify(betweenConditions) ===
                JSON.stringify([{ field: 'dueDate', operator: 'BETWEEN', value: [await iso(2026, 9, 28), sunday] }]),
            betweenConditions
        );
        await page.locator(filterInput('Duedate')).click();
        await page.waitForSelector('simple-html-date');
        await page.waitForTimeout(250);
        const selectedDays = await page.evaluate(() =>
            [...document.querySelectorAll('simple-html-date .simple-html-date-day-selected')].map((day) => day.textContent.trim())
        );
        check(`${theme}: the range picker opens on Monday 28 September`, selectedDays[0] === '28', selectedDays);
        await page.screenshot({ path: `${shots}/fas-range-picker-${theme}.png` });
        const firstMonth = page.locator('simple-html-date .simple-html-date-month').first();
        await firstMonth
            .locator('.simple-html-date-day:not(.simple-html-date-day-dimmed)', { hasText: /^\s*7\s*$/ })
            .first()
            .click();
        await firstMonth
            .locator('.simple-html-date-day:not(.simple-html-date-day-dimmed)', { hasText: /^\s*20\s*$/ })
            .first()
            .click();
        await page.locator('simple-html-date .simple-html-date-range button', { hasText: 'Use' }).click();
        await page.waitForTimeout(250);
        check(
            `${theme}: the range picked writes weeks: 2026-W37..2026-W38`,
            (await value('Duedate')) === '2026-W37..2026-W38',
            await value('Duedate')
        );
        await typeFilter('Duedate', '');

        // ------------------------------------------------------------- Norwegian dates
        // Updated is right of Due Date: in view
        await scrollMiddle(500);
        await page.locator(`${grid} [data-attribute-header="updated"]`).first().click({ button: 'right' });
        await page.locator('[data-menu-id="header.format"]').click();
        await page.locator('[data-menu-id="header.format.date.norwegian"]').click();
        await page.waitForTimeout(250);
        const day = (await cells('updated', 1))[0];
        check(`${theme}: Updated shown as Norwegian dates`, /^\d{2}\.\d{2}\.\d{4}$/.test(day), day);
        check(
            `${theme}: its placeholder a Norwegian date`,
            /^\d{2}\.\d{2}\.\d{4}$/.test(await page.locator(filterInput('Updated')).getAttribute('placeholder'))
        );
        await pickOperator('Updated', 'filter.operator.equal');
        await typeFilter('Updated', day);
        const days = await cells('updated');
        check(
            `${theme}: = ${day} shows that day, any time of it`,
            days.length > 0 && days.every((text) => text === day),
            days.slice(0, 4)
        );
        const [d, m, y] = day.split('.').map(Number);
        const dayConditions = await conditionsOf('updated');
        check(
            `${theme}: a BETWEEN of 00:00 and 23:59:59 of the day (a datetime)`,
            JSON.stringify(dayConditions) ===
                JSON.stringify([
                    { field: 'updated', operator: 'BETWEEN', value: [await iso(y, m, d), await iso(y, m, d, 23, 59, 59)] }
                ]),
            dayConditions
        );
        await typeFilter('Updated', '');
        await scrollMiddle(300);

        // ------------------------------------------------------------- a number with separators
        await typeFilter('Credit', '5 000,5');
        const credits = await cells('credit');
        const asNumber = (text) => Number(text.replace(/\s/g, '').replace(',', '.'));
        check(
            `${theme}: Credit ≥ 5 000,5 shows those only`,
            credits.length > 0 && credits.every((text) => asNumber(text) >= 5000.5),
            credits.slice(0, 4)
        );
        const creditConditions = await conditionsOf('credit');
        check(`${theme}: the filter is 5000.5`, creditConditions[0]?.value === 5000.5, creditConditions);
        await page.evaluate((g) => document.querySelector(g).grid.gridInterface.rebuild(), grid);
        await page.waitForTimeout(200);
        check(`${theme}: the cell shows 5 000,5 again`, (await value('Credit')) === '5 000,5', await value('Credit'));
        await page.screenshot({ path: `${shots}/fas-number-${theme}.png` });
        await typeFilter('Credit', '');

        // ------------------------------------------------------------- filter as you type
        await pickOperator('Company', 'filter.operator.beginWith');
        await openChoice('Company');
        const toggle = page.locator('[data-menu-id="filter.filterOnType"]');
        check(
            `${theme}: the choice ends with Filter as you type, off`,
            (await toggle.getAttribute('aria-checked')) === 'false' && (await toggle.textContent()).includes('Filter as you type')
        );
        await toggle.click();
        await page.waitForTimeout(150);
        await openChoice('Company');
        check(
            `${theme}: on now, its ✓`,
            (await page.locator('[data-menu-id="filter.filterOnType"]').getAttribute('aria-checked')) === 'true'
        );
        await page.screenshot({ path: `${shots}/fas-operator-choice-${theme}.png` });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);
        const state = await page.evaluate(
            (g) => document.querySelector(g).grid.gridInterface.getState().headerFilters.company,
            grid
        );
        check(
            `${theme}: state: headerFilters.company.filterOnType`,
            state?.filterOnType === true && state?.operator === 'BEGIN_WITH',
            state
        );

        const company = await page.evaluate(
            (g) => document.querySelector(g).grid.gridInterface.getDatasource().getRows()[0].company,
            grid
        );
        const prefix = company.slice(0, 3);
        // count the filters run from now on
        await page.evaluate((g) => {
            const datasource = document.querySelector(g).grid.gridInterface.getDatasource();
            const filter = datasource.filter.bind(datasource);
            window.__filters = 0;
            datasource.filter = (...args) => {
                window.__filters++;
                return filter(...args);
            };
        }, grid);
        const all = await rowCount();
        await page.locator(filterInput('Company')).focus();
        await page.keyboard.type(prefix, { delay: 60 });
        await page.waitForTimeout(100);
        check(`${theme}: no filter in the pause`, (await rowCount()) === all, await rowCount());
        await page.waitForTimeout(450);
        const typedRows = await rowCount();
        check(`${theme}: the rows changed without Enter`, typedRows < all && typedRows > 0, [typedRows, all]);
        const companies = await cells('company');
        check(
            `${theme}: they begin with ${prefix}`,
            companies.every((text) => text.toLowerCase().startsWith(prefix.toLowerCase())),
            companies.slice(0, 3)
        );
        const focus = () =>
            page.evaluate(() => ({
                label: document.activeElement?.getAttribute('aria-label'),
                value: document.activeElement?.value,
                caret: document.activeElement?.selectionStart
            }));
        const afterPause = await focus();
        check(
            `${theme}: the focus and the caret stay`,
            afterPause.label === 'Filter Company' && afterPause.caret === prefix.length,
            afterPause
        );
        // a letter in the middle: the caret after it, also after the filter
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.type('x');
        await page.waitForTimeout(450);
        const middle = await focus();
        check(
            `${theme}: a letter typed in the middle keeps the caret after it`,
            middle.label === 'Filter Company' &&
                middle.value === `${prefix.slice(0, 2)}x${prefix.slice(2)}` &&
                middle.caret === 3,
            middle
        );
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(450);
        const filters = await page.evaluate(() => window.__filters);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
        check(
            `${theme}: Enter after the pause does not filter again`,
            (await page.evaluate(() => window.__filters)) === filters,
            filters
        );
        await page.screenshot({ path: `${shots}/fas-typed-${theme}.png` });
        await typeFilter('Company', '');

        // ------------------------------------------------------------- the grid config dialog
        await page.locator(`${grid} .footer-settings`).click();
        await page.waitForSelector('dialog.column-settings');
        await page.locator('dialog.column-settings [role="option"][data-field="dueDate"]').click();
        await page.waitForTimeout(150);
        const asShown = page.locator('dialog.column-settings .column-settings-filter-as-shown');
        check(
            `${theme}: dialog: Filter as shown under the format, on`,
            (await asShown.isChecked()) && !(await asShown.isDisabled())
        );
        check(
            `${theme}: dialog: Filter as you type next to the operator`,
            (await page.locator('dialog.column-settings .column-settings-filter-on-type').count()) === 1
        );
        await page.screenshot({ path: `${shots}/fas-dialog-${theme}.png` });
        await page.locator('dialog.column-settings .column-settings-format').click();
        await page.locator('[data-menu-id="header.format.date.weekday"]').click();
        await page.waitForTimeout(150);
        const hint = await asShown
            .locator('xpath=ancestor::div[contains(@class,"column-settings-field")]')
            .locator('.column-settings-hint')
            .textContent();
        check(
            `${theme}: dialog: Day of week greys it out, the hint says why`,
            (await asShown.isDisabled()) && !(await asShown.isChecked()) && hint.includes('Not for the day of the week'),
            hint.trim()
        );
        await page.screenshot({ path: `${shots}/fas-dialog-weekday-${theme}.png` });
        await page.locator('dialog.column-settings button', { hasText: 'Cancel' }).click();

        await page.close();
    }
    await browser.close();
    check('no errors on the page', errors.length === 0, errors.slice(0, 5));
    console.log(results.join('\n'));
    const failed = results.filter((line) => line.startsWith('FAIL')).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
