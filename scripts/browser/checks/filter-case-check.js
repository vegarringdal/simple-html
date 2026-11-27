// Real browser check of case sensitive filters and the operators of each type (#sample/filtering),
// light and dark: the header filter menu's Operator › per type (text, number, date, boolean), "Match
// case" (the toggle, the state, the rows, the value list keeping case apart), a column that always
// matches case (filterCaseSensitive: on and greyed out, "(always)"), the filter editor's Aa toggle and
// its operator picker per field type, BETWEEN in the editor (From / To) and in the header filter
// (typed as 30..40), the footer's chips (between, the Aa marker), the look (no rounded corners) and
// screenshots.
// Usage: node filter-case-check.js <site url> <shots dir>
const path = require('node:path');
const fs = require('node:fs');
const [, , base, shots] = process.argv;
if (!base || !shots) {
    console.log('usage: node filter-case-check.js <site url> <shots dir>');
    process.exit(2);
}
const { chromium } = require('playwright');
fs.mkdirSync(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const TEXT_OPERATORS = [
    'filter.operator.equal',
    'filter.operator.notEqualTo',
    'filter.operator.contains',
    'filter.operator.doesNotContain',
    'filter.operator.beginWith',
    'filter.operator.endWith'
];
const RANGE_OPERATORS = [
    'filter.operator.equal',
    'filter.operator.notEqualTo',
    'filter.operator.lessThan',
    'filter.operator.lessThanOrEqualTo',
    'filter.operator.greaterThan',
    'filter.operator.greaterThanOrEqualTo',
    'filter.operator.between'
];

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];
    for (const dark of [false, true]) {
        const theme = dark ? 'dark' : 'light';
        const page = await browser.newPage({ viewport: { width: 1300, height: 1400 }, deviceScaleFactor: 2 });
        page.on('pageerror', (e) => errors.push(String(e)));
        page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
        await page.addInitScript((d) => localStorage.setItem('simple-html-demo-theme', d ? 'dark' : 'light'), dark);
        await page.goto(`${base}#sample/filtering`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
        await page.waitForTimeout(300);

        const gi = 'document.querySelector(".stage simple-html-grid").grid.gridInterface';
        const run = (code) => page.evaluate(`(() => { const gi = ${gi}; const ds = gi.getDatasource(); ${code} })()`);

        // three rows of a fruit in upper case: the same text in another case
        const company = await run(`
            const fields = ['company', 'country', 'age', 'balance', 'date1', 'isActive', 'favoriteFruit', 'phone'];
            const rows = ds.getAllData().map((row) => Object.fromEntries(fields.map((f) => [f, row[f]])));
            // a name with lower case letters
            const name = rows[0].favoriteFruit;
            let changed = 0;
            for (const row of rows) {
                if (row.favoriteFruit === name && changed < 3) {
                    row.favoriteFruit = name.toUpperCase();
                    changed++;
                }
            }
            ds.setData(rows);
            return name;
        `);
        const COMPANY = company.toUpperCase();

        const state = () => run('return gi.getState();');
        const filterOf = () => run('return ds.getFilter();');
        const rowCount = () => run('return ds.getDataRows().length;');
        const companies = () => run('return [...new Set(ds.getDataRows().map((r) => r.favoriteFruit))].sort();');
        const reset = () => run('gi.setState({ filter: null, headerFilters: {} });');
        const closeMenu = () => run('gi.closeMenu();');
        const headerInput = (label) => page.locator(`.stage input[aria-label="Filter ${label}"]`).first();
        const typeHeader = async (label, text) => {
            const input = headerInput(label);
            await input.fill(text);
            await input.press('Enter');
            await page.waitForTimeout(100);
        };
        /** opens the filter menu of a column, then Filter › */
        const openFilter = async (label) => {
            await headerInput(label).click({ button: 'right' });
            await page.waitForTimeout(150);
            await page.click('[data-menu-id="filter.filter"]');
            await page.waitForTimeout(150);
        };
        /** the ids in Operator › of a column, [] when there is none */
        const operatorsOf = async (label) => {
            await openFilter(label);
            if (!(await page.$('[data-menu-id="filter.operator"]'))) {
                await closeMenu();
                return [];
            }
            await page.click('[data-menu-id="filter.operator"]');
            await page.waitForTimeout(150);
            const ids = await page.evaluate(() =>
                Array.from(document.querySelectorAll('.simple-html-grid-menu [data-menu-id^="filter.operator."]'), (e) =>
                    e.getAttribute('data-menu-id')
                )
            );
            await closeMenu();
            return ids;
        };

        // ---- 1. Operator › per type
        check(`${theme}: text column - the text operators`, same(await operatorsOf('fruit'), TEXT_OPERATORS));
        check(`${theme}: number column - the comparisons and between`, same(await operatorsOf('Age'), RANGE_OPERATORS));
        check(`${theme}: date column - the comparisons and between`, same(await operatorsOf('date'), RANGE_OPERATORS));
        check(`${theme}: boolean column - no Operator ›`, same(await operatorsOf('active'), []));
        await openFilter('Age');
        check(`${theme}: no Match case on a number column`, !(await page.$('[data-menu-id="filter.matchCase"]')));
        await closeMenu();

        // ---- 2. Match case in the header filter menu
        const all = await rowCount();
        await typeHeader('fruit', COMPANY);
        const ignoringCase = await rowCount();
        check(
            `${theme}: ignoring case the upper case text finds both`,
            same(await companies(), [company, COMPANY].sort()),
            JSON.stringify(await companies())
        );
        await openFilter('fruit');
        const item = page.locator('[data-menu-id="filter.matchCase"]');
        check(
            `${theme}: Match case is a menuitemcheckbox, off`,
            (await item.getAttribute('role')) === 'menuitemcheckbox' && (await item.getAttribute('aria-checked')) === 'false'
        );
        await page.screenshot({ path: `${shots}/case-menu-${theme}.png` });
        await item.click();
        await page.waitForTimeout(150);
        check(
            `${theme}: Match case on: only the upper case rows`,
            same(await companies(), [COMPANY]) && (await rowCount()) === 3 && ignoringCase > 3,
            `${await rowCount()} of ${ignoringCase}`
        );
        const headerState = (await state()).headerFilters.favoriteFruit;
        check(
            `${theme}: Match case is state`,
            same(headerState, { value: COMPANY, caseSensitive: true }),
            JSON.stringify(headerState)
        );
        check(`${theme}: the condition has caseSensitive`, JSON.stringify(await filterOf()).includes('"caseSensitive":true'));
        await openFilter('fruit');
        check(
            `${theme}: Match case shows its ✓`,
            (await page.locator('[data-menu-id="filter.matchCase"]').getAttribute('aria-checked')) === 'true'
        );
        await page.screenshot({ path: `${shots}/case-menu-on-${theme}.png` });
        await closeMenu();
        // the footer marker
        const marker = await page.evaluate(() => {
            const m = document.querySelector('.stage .footer-filter-case');
            return m && { text: m.textContent.trim(), title: m.getAttribute('title') };
        });
        check(`${theme}: the footer chip has Aa`, same(marker, { text: 'Aa', title: 'Match case' }), JSON.stringify(marker));
        await page.locator('.stage .simple-html-grid-footer').screenshot({ path: `${shots}/case-footer-${theme}.png` });

        // the value list keeps the cases apart while it is on
        await typeHeader('fruit', '');
        await headerInput('fruit').click({ button: 'right' });
        await page.waitForTimeout(200);
        const listed = await page.evaluate(
            (names) =>
                names.map((name) =>
                    Array.from(document.querySelectorAll('.simple-html-grid-value-text'), (e) => e.textContent.trim()).includes(
                        name
                    )
                ),
            [company, COMPANY]
        );
        check(`${theme}: the value list lists both cases apart`, same(listed, [true, true]), JSON.stringify(listed));
        await page.screenshot({ path: `${shots}/case-value-list-${theme}.png` });
        await closeMenu();
        // off again
        await openFilter('fruit');
        await page.click('[data-menu-id="filter.matchCase"]');
        await page.waitForTimeout(100);
        check(
            `${theme}: Match case off: no header filter left in the state`,
            same((await state()).headerFilters, {}),
            JSON.stringify((await state()).headerFilters)
        );
        check(`${theme}: every row again`, (await rowCount()) === all);
        await headerInput('fruit').click({ button: 'right' });
        await page.waitForTimeout(200);
        const merged = await page.evaluate(
            (names) =>
                names.map((name) =>
                    Array.from(document.querySelectorAll('.simple-html-grid-value-text'), (e) => e.textContent.trim()).includes(
                        name
                    )
                ),
            [company, COMPANY]
        );
        check(
            `${theme}: off, the value list has the two cases as one entry`,
            merged.filter(Boolean).length === 1,
            JSON.stringify(merged)
        );
        await closeMenu();

        // ---- 3. a column that always matches case
        await run('gi.updateConfig({ columns: { favoriteFruit: { filterCaseSensitive: true } } });');
        await page.waitForTimeout(150);
        await openFilter('fruit');
        const forced = await page.evaluate(() => {
            const e = document.querySelector('[data-menu-id="filter.matchCase"]');
            return {
                checked: e.getAttribute('aria-checked'),
                disabled: e.getAttribute('aria-disabled'),
                hint: e.querySelector('i')?.textContent
            };
        });
        check(
            `${theme}: forced column - Match case on, greyed out, (always)`,
            same(forced, { checked: 'true', disabled: 'true', hint: '(always)' }),
            JSON.stringify(forced)
        );
        await page.screenshot({ path: `${shots}/case-forced-menu-${theme}.png` });
        await page.click('[data-menu-id="filter.matchCase"]', { force: true });
        await page.waitForTimeout(100);
        check(`${theme}: forced column - a click changes nothing`, same((await state()).headerFilters, {}));
        await closeMenu();
        await typeHeader('fruit', company.toLowerCase());
        check(`${theme}: forced column - lower case finds nothing`, (await rowCount()) === 0, String(await rowCount()));
        await typeHeader('fruit', '');

        // ---- 4. the filter editor: Aa, the operators of each field, BETWEEN
        await run(`
            ds.filter({
                group: 'AND',
                children: [
                    { field: 'country', operator: 'EQUAL', value: 'Norway' },
                    { field: 'favoriteFruit', operator: 'BEGIN_WITH', value: ${JSON.stringify(company.slice(0, 2))} },
                    { field: 'age', operator: 'BETWEEN', value: [30, 40] },
                    { field: 'isActive', operator: 'EQUAL', value: true }
                ]
            });
            gi.openFilterEditor();
        `);
        await page.waitForSelector('.filter-editor-content[open]');
        await page.waitForTimeout(200);
        const editor = await page.evaluate(() =>
            Array.from(document.querySelectorAll('.filter-editor-content .filter-editor-condition'), (row) => {
                const toggle = row.querySelector('.filter-editor-case');
                return {
                    toggle: toggle && {
                        text: toggle.textContent.trim(),
                        pressed: toggle.getAttribute('aria-pressed'),
                        disabled: toggle.getAttribute('aria-disabled'),
                        name: toggle.getAttribute('aria-label')
                    },
                    inputs: Array.from(row.querySelectorAll('.filter-editor-value'), (i) => [
                        i.getAttribute('aria-label'),
                        i.value
                    ])
                };
            })
        );
        check(
            `${theme}: editor - Aa on a text condition, off`,
            same(editor[0].toggle, { text: 'Aa', pressed: 'false', disabled: null, name: 'Match case' }),
            JSON.stringify(editor[0].toggle)
        );
        check(
            `${theme}: editor - Aa of the forced column pressed, greyed out`,
            same(editor[1].toggle, {
                text: 'Aa',
                pressed: 'true',
                disabled: 'true',
                name: 'Match case: always, for this column'
            }),
            JSON.stringify(editor[1].toggle)
        );
        check(`${theme}: editor - no Aa on a number or a boolean`, editor[2].toggle === null && editor[3].toggle === null);
        check(
            `${theme}: editor - BETWEEN has From and To`,
            same(editor[2].inputs, [
                ['From', '30'],
                ['To', '40']
            ]),
            JSON.stringify(editor[2].inputs)
        );
        await page.locator('.filter-editor-content').screenshot({ path: `${shots}/case-editor-${theme}.png` });

        // the toggle by mouse: pressed, filled with the accent colour, square corners
        await page.locator('.filter-editor-content .filter-editor-case').first().click();
        await page.waitForTimeout(100);
        const look = await page.evaluate(() => {
            const t = document.querySelector('.filter-editor-content .filter-editor-case');
            const style = getComputedStyle(t);
            return {
                pressed: t.getAttribute('aria-pressed'),
                radius: style.borderRadius,
                bg: style.backgroundColor,
                color: style.color
            };
        });
        check(`${theme}: editor - a click presses Aa`, look.pressed === 'true');
        check(
            `${theme}: editor - Aa square and filled`,
            look.radius === '0px' && look.bg !== 'rgba(0, 0, 0, 0)',
            JSON.stringify(look)
        );
        await page.mouse.move(0, 0);
        await page
            .locator('.filter-editor-content .filter-editor-condition')
            .first()
            .screenshot({ path: `${shots}/case-editor-toggle-on-${theme}.png` });

        // the operator picker of each field
        const pickerOf = async (index) => {
            await page.locator('.filter-editor-content .filter-editor-pick-operator').nth(index).click();
            await page.waitForTimeout(150);
            const items = await page.evaluate(() =>
                Array.from(document.querySelectorAll('.filter-editor-content .simple-html-grid-menu-item'), (e) =>
                    e.textContent.trim()
                )
            );
            if (index === 2) {
                await page.screenshot({ path: `${shots}/case-editor-number-operators-${theme}.png` });
            }
            await page.keyboard.press('Escape');
            await page.waitForTimeout(100);
            return items;
        };
        const textItems = await pickerOf(0);
        const numberItems = await pickerOf(2);
        const booleanItems = await pickerOf(3);
        check(
            `${theme}: editor - text operators`,
            same(textItems, [
                'Equal',
                'Not Equal To',
                'Contains',
                'Does Not Contain',
                'Begin With',
                'End With',
                'In',
                'Not In',
                'Is Blank',
                'Is Not Blank'
            ]),
            JSON.stringify(textItems)
        );
        check(
            `${theme}: editor - number operators`,
            same(numberItems, [
                'Equal',
                'Not Equal To',
                'Less Than',
                'Less Than Or Equal To',
                'Greater Than',
                'Greater Than Or Equal To',
                'Between',
                'In',
                'Not In',
                'Is Blank',
                'Is Not Blank'
            ]),
            JSON.stringify(numberItems)
        );
        check(
            `${theme}: editor - boolean operators`,
            same(booleanItems, ['Equal', 'Not Equal To', 'Is Blank', 'Is Not Blank']),
            JSON.stringify(booleanItems)
        );
        check(`${theme}: editor still open after Esc in a picker`, !!(await page.$('.filter-editor-content[open]')));

        // Apply: the conditions as edited
        await page.locator('.filter-editor-content .filter-editor-footer button:text-is("Apply")').click();
        await page.waitForTimeout(150);
        const applied = await filterOf();
        check(
            `${theme}: editor - Apply: caseSensitive on the toggled and the forced conditions, BETWEEN its ends`,
            applied.children[0].caseSensitive === true &&
                applied.children[1].caseSensitive === true &&
                same(applied.children[2].value, [30, 40]) &&
                applied.children[3].caseSensitive === undefined,
            JSON.stringify(applied)
        );
        await page.locator('.filter-editor-content .filter-editor-footer button:text-is("Cancel")').click();
        await page.waitForTimeout(100);

        // ---- 5. BETWEEN in the header filter
        await run('gi.updateConfig({ columns: {} });');
        await reset();
        await openFilter('Age');
        await page.click('[data-menu-id="filter.operator"]');
        await page.waitForTimeout(150);
        await page.click('[data-menu-id="filter.operator.between"]');
        await page.waitForTimeout(150);
        check(
            `${theme}: header BETWEEN - the placeholder from..to`,
            (await headerInput('Age').getAttribute('placeholder')) === 'from..to'
        );
        await typeHeader('Age', '30..40');
        const ages = await run('return ds.getDataRows().map((r) => r.age);');
        check(
            `${theme}: header BETWEEN 30..40 - every age from 30 to 40, both ends`,
            ages.length > 0 && ages.every((a) => a >= 30 && a <= 40) && ages.includes(30) && ages.includes(40),
            `${ages.length} rows`
        );
        const chip = await page.evaluate(() =>
            document.querySelector('.stage .footer-filter-chips')?.textContent.replace(/\s+/g, ' ').trim()
        );
        check(`${theme}: header BETWEEN - the chip`, chip === 'Age between 30 and 40', chip);
        await run('gi.rebuild();');
        check(
            `${theme}: header BETWEEN - the cell shows 30..40 after a rebuild`,
            (await headerInput('Age').inputValue()) === '30..40'
        );
        await page.locator('.stage simple-html-grid').screenshot({ path: `${shots}/case-between-header-${theme}.png` });
        await typeHeader('Age', '50..');
        const open = await page.evaluate(() =>
            document.querySelector('.stage .footer-filter-chips')?.textContent.replace(/\s+/g, ' ').trim()
        );
        check(`${theme}: header BETWEEN 50.. - an open end, shown as ≥`, open === 'Age ≥ 50', open);

        // ---- 6. no rounded corners in what was added
        const radii = await page.evaluate(() =>
            Array.from(
                document.querySelectorAll('.stage .footer-filter-chip, .stage .footer-filter-case'),
                (e) => getComputedStyle(e).borderRadius
            )
        );
        check(`${theme}: square corners`, radii.length > 0 && radii.every((r) => r === '0px'), JSON.stringify(radii));
        await reset();

        await page.close();
    }
    await browser.close();
    check('no page errors', errors.length === 0, errors.join(' | '));
    console.log(results.join('\n'));
    const failed = results.filter((r) => r.startsWith('FAIL')).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})();
