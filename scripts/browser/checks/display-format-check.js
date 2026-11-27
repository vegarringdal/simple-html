// Real browser check of the display formats (ColumnConfig.format, GridState.formats, Format › in the
// header menu) on the "Full grid" sample (#sample/full-grid) and the Norwegian "Translation" sample:
// the formats of the config in the cells; Format › on a date column -> Norwegian, Week ISO, Day of week;
// on a number column -> Norwegian separators, Decimals › 2, the totals row in the format; a formatted
// cell edited shows the value; getState() / setState() through JSON keep the formats; the names of a
// date in Norwegian (format.locale nb-NO) in Chromium's Intl. Screenshots light and dark at 1300x1400
// with Format › open.
// Usage: node display-format-check.js <site url> [screenshot dir]
const path = require('node:path');
const fs = require('node:fs');
const [, , base, shots] = process.argv;
if (!base) {
    console.log('usage: node display-format-check.js <site url> [screenshot dir]');
    process.exit(2);
}
const { chromium } = require('playwright');
// a column's settings are in tabs: an element of a hidden one, its tab clicked first
require('../sections')();
if (shots) {
    fs.mkdirSync(shots, { recursive: true });
}

const results = [];
const check = (name, ok, detail = '') =>
    results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${JSON.stringify(detail)})` : ''}`);

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];
    for (const dark of [false, true]) {
        const theme = dark ? 'dark' : 'light';
        const page = await browser.newPage({ viewport: { width: 1300, height: 1400 } });
        page.on('pageerror', (e) => errors.push(`${theme}: ${e}`));
        page.on('console', (m) => m.type() === 'error' && errors.push(`${theme} console: ${m.text()}`));
        await page.addInitScript((d) => localStorage.setItem('simple-html-demo-theme', d ? 'dark' : 'light'), dark);
        await page.goto(`${base}#sample/full-grid`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
        await page.waitForTimeout(300);
        // the columns balance ... updated in view: the middle section scrolled 300px
        await page.evaluate(() => {
            document.querySelector('.stage .simple-html-grid-middle-scroller').scrollLeft = 300;
        });
        await page.waitForTimeout(300);

        const entry = (id) => page.locator(`[data-menu-id="${id}"]`);
        /** the values of the shown inputs of a field, the first rows */
        const cells = (field, count = 6) =>
            page.evaluate(
                ([field, count]) =>
                    [...document.querySelectorAll(`.stage input[data-attribute="${field}"]`)]
                        .filter((input) => input.offsetParent !== null)
                        .map((input) => ({ row: input.closest('.simple-html-grid-col-cell').$row, value: input.value }))
                        .sort((a, b) => a.row - b.row)
                        .slice(0, count)
                        .map((cell) => cell.value),
                [field, count]
            );
        const all = (values, pattern) => values.length > 0 && values.every((value) => value === '' || pattern.test(value));
        const label = (field) => page.locator(`.stage [data-attribute-header="${field}"]`).first();
        const pick = async (field, ...ids) => {
            await label(field).click({ button: 'right' });
            for (const id of ids) {
                await entry(id).click();
            }
            await page.waitForTimeout(150);
        };
        const state = () =>
            page.evaluate(() => document.querySelector('.stage simple-html-grid').grid.gridInterface.getState().formats);

        // the formats of the config
        check(
            `${theme}: credit in its format, 1 234,56`,
            all(await cells('credit'), /^-?\d{1,3}( \d{3})*,\d{2}$/),
            await cells('credit', 3)
        );
        check(`${theme}: dueDate as the ISO week`, all(await cells('dueDate'), /^\d{4}-W\d{2}$/), await cells('dueDate', 3));
        // updated is further right: in view, then back
        const scrollMiddle = async (left) => {
            await page.evaluate((px) => {
                document.querySelector('.stage .simple-html-grid-middle-scroller').scrollLeft = px;
            }, left);
            await page.waitForTimeout(300);
        };
        await scrollMiddle(700);
        check(
            `${theme}: updated as 22.11.2026 13:45`,
            all(await cells('updated'), /^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/),
            await cells('updated', 3)
        );
        await scrollMiddle(300);
        check(
            `${theme}: orderDate without a format, the field formatter`,
            all(await cells('orderDate'), /^\d{4}-\d{2}-\d{2}$/),
            await cells('orderDate', 3)
        );

        // Format › open on a date column: the screenshot
        await label('orderDate').click({ button: 'right' });
        await entry('header.format').click();
        await page.waitForTimeout(200);
        const dateMenu = await page.evaluate(() =>
            [...document.querySelectorAll('[data-menu-id^="header.format."]')].map((e) =>
                e.textContent.replace(/\s+/g, ' ').trim()
            )
        );
        check(
            `${theme}: Format › of a date column lists the date formats, no time ones`,
            dateMenu.some((t) => /^Week, ISO \(\d{4}-W\d{2}\)$/.test(t)) && !dateMenu.some((t) => t.startsWith('ISO with time')),
            dateMenu.slice(0, 4)
        );
        const checkedDefault = await entry('header.format.default').getAttribute('aria-checked');
        check(`${theme}: Default has the ✓`, checkedDefault === 'true', checkedDefault);
        // no rounded corners on the menus
        const radius = await page.evaluate(() =>
            [...document.querySelectorAll('.simple-html-grid-menu, .simple-html-grid-popover, .simple-html-grid-menu-item')]
                .map((e) => getComputedStyle(e).borderRadius)
                .filter((r) => r !== '0px')
        );
        check(`${theme}: no rounded corners in the menu`, radius.length === 0, radius.slice(0, 3));
        if (shots) {
            await page.screenshot({ path: `${shots}/display-format-date-menu-${theme}.png` });
        }
        await page.keyboard.press('Escape');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);

        await pick('orderDate', 'header.format', 'header.format.date.norwegian');
        check(
            `${theme}: Format › Norwegian: 22.11.2026`,
            all(await cells('orderDate'), /^\d{2}\.\d{2}\.\d{4}$/),
            await cells('orderDate', 3)
        );
        await pick('orderDate', 'header.format', 'header.format.date.weekIso');
        check(`${theme}: Format › Week, ISO`, all(await cells('orderDate'), /^\d{4}-W\d{2}$/), await cells('orderDate', 3));
        await pick('orderDate', 'header.format', 'header.format.date.weekday');
        check(
            `${theme}: Format › Day of week, English names`,
            all(await cells('orderDate'), /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/),
            await cells('orderDate', 3)
        );
        check(`${theme}: the state has it`, JSON.stringify((await state()).orderDate) === '{"date":"weekday"}', await state());

        // a number column: Norwegian, then Decimals › 2 - with its submenu open for the screenshot
        await pick('balance', 'header.format', 'header.format.number.norwegian');
        check(
            `${theme}: balance Norwegian separators`,
            all(await cells('balance'), /^-?\d{1,3}( \d{3})*(,\d+)?$/),
            await cells('balance', 3)
        );
        await label('balance').click({ button: 'right' });
        await entry('header.format').click();
        await entry('header.format.decimals').click();
        await page.waitForTimeout(200);
        if (shots) {
            await page.screenshot({ path: `${shots}/display-format-number-menu-${theme}.png` });
        }
        await entry('header.format.decimals.2').click();
        await page.waitForTimeout(150);
        check(
            `${theme}: balance Decimals › 2: 1 234,50`,
            all(await cells('balance'), /^-?\d{1,3}( \d{3})*,\d{2}$/),
            await cells('balance', 3)
        );
        // its number format - Format › changes that part only, the sample's colour rules of balance stay
        check(
            `${theme}: the state of balance`,
            JSON.stringify((await state()).balance?.number) === '{"decimals":2,"thousands":" ","decimal":","}' &&
                (await state()).balance?.rules?.length === 1,
            (await state()).balance
        );

        // the totals row: the sum of balance in its format
        await page.evaluate(() =>
            document.querySelector('.stage simple-html-grid').grid.gridInterface.setState({ totalsRow: true })
        );
        await page.waitForTimeout(200);
        const sum = await page.evaluate(
            () =>
                document.querySelector(
                    '.simple-html-grid-totals [data-aggregate="sum:balance"] .simple-html-grid-aggregate-value'
                )?.textContent
        );
        check(`${theme}: the totals row sums balance in its format`, /^\d{1,3}( \d{3})+,\d{2}$/.test(sum ?? ''), sum);

        // editing: a formatted number cell shows the plain value while it has the focus
        if (!dark) {
            const first = page.locator('.stage input[data-attribute="credit"]').first();
            const shown = await first.inputValue();
            await first.click();
            await page.waitForTimeout(100);
            const editing = await first.inputValue();
            check(
                'a credit cell edited: the plain number',
                !/ /.test(editing) && Number(editing) === Number(shown.replaceAll(' ', '').replace(',', '.')),
                `${shown} -> ${editing}`
            );
            await page.keyboard.press('Control+a');
            await page.keyboard.type('1234.5');
            await page.keyboard.press('Tab');
            await page.waitForTimeout(300);
            check('typed 1234.5 and Tab: shown 1 234,50', (await first.inputValue()) === '1 234,50', await first.inputValue());

            // a date cell shown as weeks: the click opens the date picker, the input shows the date
            const due = page.locator('.stage input[data-attribute="dueDate"]').first();
            const dueShown = await due.inputValue();
            await due.click();
            await page.waitForTimeout(200);
            const dueEditing = await due.inputValue();
            check(
                'a dueDate cell (week) edited: the date',
                /^\d{4}-W\d{2}$/.test(dueShown) && /^\d{4}-\d{2}-\d{2}$/.test(dueEditing),
                `${dueShown} -> ${dueEditing}`
            );
            await page.keyboard.press('Escape');
            await page.locator('.stage [data-attribute-header="company"]').first().click();
            await page.waitForTimeout(200);

            // the header filter keeps to the field formatter: its placeholder
            const placeholder = await page
                .locator('.stage input[data-attribute-filter="dueDate"], .stage [data-attribute-filter="dueDate"] input')
                .first()
                .getAttribute('placeholder')
                .catch(() => null);
            check(
                'the header filter of dueDate: the field formatter placeholder',
                placeholder === null || placeholder === 'YYYY-MM-DD',
                placeholder
            );

            // getState() through JSON, setState() back
            const kept = await page.evaluate(() => {
                const gi = document.querySelector('.stage simple-html-grid').grid.gridInterface;
                const saved = JSON.stringify(gi.getState());
                gi.setState({ formats: {} });
                const cleared = gi.getState().formats;
                gi.setState(JSON.parse(saved));
                return { cleared, back: gi.getState().formats, saved: JSON.parse(saved).formats };
            });
            check('setState({ formats: {} }) clears them', Object.keys(kept.cleared).length === 0, kept.cleared);
            check(
                'setState(the JSON of getState()) gives them back',
                JSON.stringify(kept.back) === JSON.stringify(kept.saved),
                kept.back
            );
            check(
                'the cells back in the formats',
                all(await cells('orderDate'), /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/),
                await cells('orderDate', 3)
            );
        }
        if (shots) {
            await page.screenshot({ path: `${shots}/display-format-grid-${theme}.png` });
        }
        await page.close();
    }

    // Norwegian: the names by Chromium's Intl in nb-NO, the menu in Norwegian
    const page = await browser.newPage({ viewport: { width: 1300, height: 1400 } });
    page.on('pageerror', (e) => errors.push(`translation: ${e}`));
    await page.goto(`${base}#sample/translation`);
    await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
    await page.waitForTimeout(300);
    const dates = await page.evaluate(() =>
        [...document.querySelectorAll('.stage input[data-attribute="date1"]')]
            .filter((i) => i.offsetParent !== null)
            .slice(0, 4)
            .map((i) => i.value)
    );
    check(
        'translation: the date column in Norwegian, søndag 22. november 2026',
        dates.length > 0 &&
            dates.every((d) =>
                /^(mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag) \d{1,2}\. (januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember) \d{4}$/.test(
                    d
                )
            ),
        dates
    );
    await page.locator('.stage [data-attribute-header="date1"]').first().click({ button: 'right' });
    await page.locator('[data-menu-id="header.format"]').click();
    await page.waitForTimeout(200);
    const week = await page.locator('[data-menu-id="header.format.date.weekIso"]').textContent();
    check(
        'translation: Format › in Norwegian, the week as "uke 47 2026"',
        /^\s*Uke, ISO\s*\(uke \d{2} \d{4}\)\s*$/.test(week),
        week
    );
    if (shots) {
        await page.screenshot({ path: `${shots}/display-format-norwegian.png` });
    }
    await browser.close();

    for (const error of errors) {
        results.push(`FAIL  ${error}`);
    }
    console.log(results.join('\n'));
    const failed = results.filter((r) => r.startsWith('FAIL')).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})();
