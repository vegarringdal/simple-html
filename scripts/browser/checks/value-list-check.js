// Real browser check of the filter menu's value list showing what the cells show, light and dark:
// - the "Lookups" sample (#sample/lookups): Country (a text lookup) lists the labels, not the codes, with
//   their counts; the search finds a label; Enter applies an IN of the code; the rows and the cells; the
//   footer's chip shows the label; opened again only that one checked; Customer (a lookup on a number
//   field) has a value list of labels, unchecking one gives a NOT_IN of its number, the chip the label
// - the "Custom formatter" sample (#sample/custom-formatter, "Upper case country, compact phone"): Country
//   lists the formatter's text (NORWAY), unchecking it is a NOT_IN of the value (Norway); the search of
//   phone finds the text without spaces, Enter applies an IN of the values with their spaces
// - screenshots of the lists, the search and the chip
// Usage: node value-list-check.js <site url> <shots dir>
const fs = require('node:fs');
const [, , base, shots] = process.argv;
if (!base || !shots) {
    console.log('usage: node value-list-check.js <site url> <shots dir>');
    process.exit(2);
}
const { chromium } = require('playwright');
fs.mkdirSync(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? `  (${detail})` : ''}`);

const COUNTRY_NAMES = ['Norway', 'Sweden', 'Denmark', 'Finland', 'Iceland', 'Germany', 'France', 'Spain', 'Italy', 'Portugal'];

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];

    const open = async (sample, dark) => {
        const page = await browser.newPage({ viewport: { width: 1300, height: 1400 }, deviceScaleFactor: 1 });
        page.on('pageerror', (e) => errors.push(String(e)));
        page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
        await page.addInitScript((d) => localStorage.setItem('simple-html-demo-theme', d ? 'dark' : 'light'), dark);
        await page.goto(`${base}#sample/${sample}`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell input');
        await page.waitForTimeout(300);
        return page;
    };

    // helpers on a page
    const helpers = (page) => {
        // runs fn(gridInterface, arg) in the page, on the stage's grid
        const grid = (fn, arg) =>
            page.evaluate(
                ({ source, arg }) => {
                    const gridInterface = document.querySelector('.stage simple-html-grid').grid.gridInterface;
                    return new Function('gridInterface', 'arg', `return (${source})(gridInterface, arg)`)(gridInterface, arg);
                },
                { source: fn.toString(), arg }
            );
        const openList = async (label) => {
            await page.locator(`.stage input[aria-label="Filter ${label}"]`).first().click({ button: 'right' });
            await page.waitForTimeout(200);
            await page.mouse.move(5, 1390);
            await page.waitForTimeout(50);
        };
        const listRows = () =>
            page.evaluate(() =>
                Array.from(document.querySelectorAll('.simple-html-grid-value-scroll .simple-html-grid-value-row'), (row) => ({
                    text: row.querySelector('.simple-html-grid-value-text').textContent.trim(),
                    count: row.querySelector('.simple-html-grid-value-count')?.textContent.trim() ?? null,
                    checked: row.querySelector('input').checked
                }))
            );
        const info = () => page.evaluate(() => document.querySelector('.simple-html-grid-value-info')?.textContent.trim());
        const search = async (text) => {
            await page.locator('.simple-html-grid-value-search').fill(text);
            await page.waitForTimeout(100);
        };
        const menuOpen = () => page.evaluate(() => !!document.querySelector('.simple-html-grid-menu'));
        const chips = () =>
            page.evaluate(() =>
                Array.from(document.querySelectorAll('.stage .footer-filter-chip'), (c) =>
                    c.textContent.replace(/\s+/g, ' ').trim()
                )
            );
        const filter = () => grid((gi) => gi.getDatasource().getFilter());
        const values = (field) =>
            grid(
                (gi, f) =>
                    gi
                        .getDatasource()
                        .getDataRows()
                        .map((row) => row[f]),
                field
            );
        const apply = async () => {
            await page.locator('.simple-html-grid-value-buttons .simple-html-grid-button-primary').click();
            await page.waitForTimeout(150);
        };
        const clip = async (selector, margin = 12) => {
            const r = await page.evaluate((s) => {
                const el = document.querySelector(s);
                if (!el) return null;
                const b = el.getBoundingClientRect();
                return { x: b.left, y: b.top, width: b.width, height: b.height };
            }, selector);
            return r
                ? {
                      x: Math.max(0, r.x - margin),
                      y: Math.max(0, r.y - margin),
                      width: r.width + 2 * margin,
                      height: r.height + 2 * margin
                  }
                : undefined;
        };
        return { grid, openList, listRows, info, search, menuOpen, chips, filter, values, apply, clip };
    };

    for (const dark of [false, true]) {
        const theme = dark ? 'dark' : 'light';

        // ---- 1. the lookups sample
        let page = await open('lookups', dark);
        let h = helpers(page);

        await h.openList('Country');
        let rows = await h.listRows();
        check(
            `${theme} lookups: Country lists the labels, in order, 20 rows each`,
            rows.map((r) => r.text).join(',') === [...COUNTRY_NAMES].sort((a, b) => a.localeCompare(b)).join(',') &&
                rows.every((r) => r.count === '20' && r.checked),
            rows.map((r) => `${r.text} ${r.count}`).join(', ')
        );
        check(`${theme} lookups: no code in the list`, !rows.some((r) => /^[A-Z]{2}$/.test(r.text)));
        check(`${theme} lookups: "10 values"`, (await h.info()) === '10 values', await h.info());
        await page.screenshot({
            path: `${shots}/lookups-country-list-${theme}.png`,
            clip: await h.clip('.simple-html-grid-popover')
        });

        await h.search('way');
        rows = await h.listRows();
        check(
            `${theme} lookups: the search finds the label`,
            rows.length === 1 && rows[0].text === 'Norway' && (await h.info()) === '1 value',
            rows.map((r) => r.text).join(',')
        );
        await h.search('dk');
        rows = await h.listRows();
        // DK is the code of Denmark: the codes are not searched
        check(
            `${theme} lookups: the search searches the labels, not the codes`,
            rows.length === 0 && (await h.info()) === '0 values',
            rows.map((r) => r.text).join(',')
        );
        await h.search('way');
        await page.screenshot({
            path: `${shots}/lookups-country-search-${theme}.png`,
            clip: await h.clip('.simple-html-grid-popover')
        });

        await page.locator('.simple-html-grid-value-search').press('Enter');
        await page.waitForTimeout(150);
        let applied = await h.filter();
        check(
            `${theme} lookups: Enter applies an IN of the code, the menu closes`,
            !(await h.menuOpen()) &&
                JSON.stringify(applied) ===
                    JSON.stringify({ group: 'AND', children: [{ field: 'countryCode', operator: 'IN', value: ['NO'] }] }),
            JSON.stringify(applied)
        );
        const codes = await h.values('countryCode');
        check(`${theme} lookups: 20 rows, all NO`, codes.length === 20 && codes.every((c) => c === 'NO'), `${codes.length}`);
        const firstCell = await page.locator('.stage input.cellpos-middle-pinned-0-0-0').first().inputValue();
        check(`${theme} lookups: the cells show Norway`, firstCell === 'Norway', firstCell);
        let chips = await h.chips();
        check(
            `${theme} lookups: the footer chip shows the label`,
            chips.length === 1 && chips[0] === 'Country in Norway',
            chips.join(' | ')
        );
        const filterString = await h.grid((gi) => gi.getDatasource().getFilterString());
        check(`${theme} lookups: getFilterString() has the code`, filterString.includes("['NO']"), filterString);
        const headerFilters = await h.grid((gi) => gi.getState().headerFilters);
        const headerCell = await page.locator('.stage input[aria-label="Filter Country"]').first().inputValue();
        check(
            `${theme} lookups: the header filter cell is empty`,
            !headerFilters.countryCode && headerCell === '',
            JSON.stringify(headerFilters)
        );
        await page.screenshot({
            path: `${shots}/lookups-chip-${theme}.png`,
            clip: await h.clip('.stage .simple-html-grid-footer', 6)
        });

        await h.openList('Country');
        rows = await h.listRows();
        check(
            `${theme} lookups: opened again, only Norway checked`,
            rows.length === 10 &&
                rows
                    .filter((r) => r.checked)
                    .map((r) => r.text)
                    .join(',') === 'Norway',
            rows
                .filter((r) => r.checked)
                .map((r) => r.text)
                .join(',')
        );
        const mixed = await page.evaluate(() => document.querySelector('.simple-html-grid-value-all input').indeterminate);
        check(`${theme} lookups: Select all mixed`, mixed === true);
        await page.locator('.simple-html-grid-value-all').click();
        await h.apply();
        chips = await h.chips();
        check(
            `${theme} lookups: Select all, Apply: every row, no chip`,
            (await h.values('countryCode')).length === 200 && chips.length === 0,
            chips.join(' | ')
        );

        // a lookup on a number field
        await h.openList('Customer');
        rows = await h.listRows();
        const labels = rows.map((r) => r.text);
        check(
            `${theme} lookups: Customer (a number field) has a value list of the labels`,
            rows.length > 1 && labels.every((t) => /^[A-Z].* \d+$/.test(t)) && !labels.some((t) => /^\d+$/.test(t)),
            labels.slice(0, 4).join(', ')
        );
        check(
            `${theme} lookups: the labels in order`,
            labels.join(',') === [...labels].sort((a, b) => a.localeCompare(b)).join(',')
        );
        await page.screenshot({
            path: `${shots}/lookups-customer-list-${theme}.png`,
            clip: await h.clip('.simple-html-grid-popover')
        });
        const first = rows[0].text;
        await page.locator('.simple-html-grid-value-scroll .simple-html-grid-value-row').first().click();
        await h.apply();
        applied = await h.filter();
        const condition = applied?.children?.[0];
        const id = condition?.value?.[0];
        check(
            `${theme} lookups: unchecking one is a NOT_IN of its number`,
            condition?.operator === 'NOT_IN' && condition.value.length === 1 && typeof id === 'number',
            JSON.stringify(applied)
        );
        const ids = await h.values('customerId');
        const idLabel = await h.grid((gi, i) => gi.__getLookupColumn('customerId').formatter.format(i), id);
        check(
            `${theme} lookups: the rows without it, its label the one unchecked`,
            ids.length > 0 && ids.length < 200 && !ids.includes(id) && idLabel === first,
            `${ids.length} ${idLabel}`
        );
        chips = await h.chips();
        check(
            `${theme} lookups: the chip shows its label`,
            chips.length === 1 && chips[0] === `Customer not in ${first}`,
            chips.join(' | ')
        );
        await page.close();

        // ---- 2. a formatter of a text field
        page = await open('custom-formatter', dark);
        h = helpers(page);
        await page.locator('button', { hasText: 'Upper case country, compact phone' }).click();
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell input');
        await page.waitForTimeout(300);

        await h.openList('Country');
        rows = await h.listRows();
        const upperNames = COUNTRY_NAMES.map((n) => n.toUpperCase());
        check(
            `${theme} formatter: Country lists the formatter's text (upper case)`,
            rows.length === 10 && rows.every((r) => upperNames.includes(r.text)),
            rows.map((r) => `${r.text} ${r.count}`).join(', ')
        );
        await page.screenshot({
            path: `${shots}/formatter-country-list-${theme}.png`,
            clip: await h.clip('.simple-html-grid-popover')
        });
        await page.locator('.simple-html-grid-value-scroll .simple-html-grid-value-row', { hasText: 'NORWAY' }).first().click();
        await h.apply();
        applied = await h.filter();
        check(
            `${theme} formatter: unchecking NORWAY is a NOT_IN of the value, Norway`,
            JSON.stringify(applied) ===
                JSON.stringify({ group: 'AND', children: [{ field: 'country', operator: 'NOT_IN', value: ['Norway'] }] }),
            JSON.stringify(applied)
        );
        const countries = await h.values('country');
        check(`${theme} formatter: no Norway left`, countries.length > 0 && !countries.includes('Norway'), `${countries.length}`);
        await h.grid((gi) => gi.getDatasource().filter(null));

        await h.openList('Phone');
        rows = await h.listRows();
        check(
            `${theme} formatter: phone lists the text without spaces, cut off at 100`,
            rows.length === 100 &&
                rows.every((r) => !r.text.includes(' ')) &&
                (await h.info()) === 'Only the first 100 values are shown',
            `${rows.length} ${rows[0]?.text} ${await h.info()}`
        );
        // across the space the formatter took out: '4712' is in '+4712...', not in '+47 12...'
        const part = rows[0].text.slice(1, 6);
        await h.search(part);
        rows = await h.listRows();
        check(
            `${theme} formatter: the search finds the shown text`,
            rows.length >= 1 && rows.every((r) => r.text.includes(part)),
            `${part}: ${rows.map((r) => r.text).join(',')}`
        );
        await page.screenshot({
            path: `${shots}/formatter-phone-search-${theme}.png`,
            clip: await h.clip('.simple-html-grid-popover')
        });
        await page.locator('.simple-html-grid-value-search').press('Enter');
        await page.waitForTimeout(150);
        applied = await h.filter();
        const phones = await h.values('phone');
        const list = applied?.children?.[0]?.value ?? [];
        check(
            `${theme} formatter: Enter applies an IN of the values, with their spaces`,
            applied?.children?.[0]?.operator === 'IN' &&
                list.length > 0 &&
                list.every((v) => v.includes(' ')) &&
                phones.length === list.length &&
                phones.every((p) => p.replaceAll(' ', '').includes(part)),
            JSON.stringify(applied)
        );
        await page.close();
    }

    check('no page errors', errors.length === 0, errors.join(' | '));
    await browser.close();
    console.log(results.join('\n'));
    const failed = results.filter((r) => r.startsWith('FAIL')).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})();
