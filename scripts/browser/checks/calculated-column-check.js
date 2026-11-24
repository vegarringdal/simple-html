// Real browser check of the calculated columns (GridState.calculatedColumns, calculatedColumns.ts,
// formula.ts) and of the colour rules on several fields, of a formula and of a custom colour - on the
// "Calculated columns" sample (#sample/calculated-columns), in the four looks: default and TreDeSpace,
// light and dark.
// - the sample: Total = price * qty and Days late computed on every row on screen; a click on Total's
//   label sorts on it; its header filter filters on the values; an edit of a price changes the total;
//   the multi-field rule on Customer colours the rows that are late with a total over 2000; the formula
//   rule on Total its custom colour (a custom property, the text black or white on it)
// - the dialog: Add calculated column three times - two fields (one put in with the { } button), an IF,
//   a DAYS(TODAY()) - the type and the value of the preview row shown; an invalid formula's problem at
//   once, Apply waits (aria-disabled), the badge Error; Apply: the columns at the end of the layout, their
//   values; a rule of the kind Conditions and one of the kind Formula made in the dialog; a custom colour
//   from the colour picker
// - the state: getState() -> JSON -> setState() without them (gone from the layout) -> back
// - no rounded corners, no page errors; screenshots of the grid and the dialog in each look
// Usage: node calculated-column-check.js <site url> [shots dir]
const path = require('node:path');
const fs = require('node:fs');
const [, , base, shots] = process.argv;
if (!base) {
    console.log('usage: node calculated-column-check.js <site url> [screenshot dir]');
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
    results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? `  (${JSON.stringify(detail).slice(0, 600)})` : ''}`);

const COLOUR_TOOLS = `
window.__rgb = (text) => {
    window.__canvas = window.__canvas || Object.assign(document.createElement('canvas'), { width: 1, height: 1 });
    const x = window.__canvas.getContext('2d', { willReadFrequently: true });
    x.clearRect(0, 0, 1, 1);
    x.fillStyle = '#000';
    x.fillStyle = text;
    x.fillRect(0, 0, 1, 1);
    const d = x.getImageData(0, 0, 1, 1).data;
    return [d[0] / 255, d[1] / 255, d[2] / 255, d[3] / 255];
};
window.__lum = ([r, g, b]) => {
    const l = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * l(r) + 0.7152 * l(g) + 0.0722 * l(b);
};
window.__contrast = (a, b) => {
    const [x, y] = [window.__lum(a), window.__lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
};
`;

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];
    const looks = [
        { theme: 'light', grid: 'default' },
        { theme: 'dark', grid: 'default' },
        { theme: 'light', grid: 'tredespace' },
        { theme: 'dark', grid: 'tredespace' }
    ];
    for (const look of looks) {
        const name = `${look.grid}-${look.theme}`;
        const full = name === 'default-light';
        const context = await browser.newContext({ viewport: { width: 1300, height: 1000 } });
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
        page.on('console', (m) => m.type() === 'error' && errors.push(`${name} console: ${m.text()}`));
        await page.addInitScript((l) => {
            localStorage.setItem('simple-html-demo-theme', l.theme);
            localStorage.setItem('simple-html-demo-grid-theme', l.grid);
        }, look);
        await page.addInitScript(COLOUR_TOOLS);
        await page.goto(`${base}#sample/calculated-columns`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
        await page.waitForTimeout(400);

        const dialogSel = 'dialog.column-settings';
        const api = (fn, arg) =>
            page.evaluate(
                ([source, a]) => {
                    const gi = document.querySelector('.stage simple-html-grid').grid.gridInterface;
                    // biome-ignore lint/security/noGlobalEval: the check's own function, sent as text
                    return eval(`(${source})`)(gi, a);
                },
                [fn.toString(), arg]
            );
        const shot = async (file, locator) => {
            if (shots) {
                await (locator ?? page).screenshot({ path: `${shots}/${file}-${name}.png` });
            }
        };
        const byId = (part) => page.locator(`${dialogSel} [id$="-settings-${part}"]`);
        const button = (text) => page.locator(`${dialogSel} button`, { hasText: new RegExp(`^\\s*${text}\\s*$`) });
        /** the cells of a field on screen: the row's values, the text shown, the classes, the colours drawn */
        const cellsOf = (field) =>
            page.evaluate((f) => {
                const grid = document.querySelector('.stage simple-html-grid');
                const datasource = grid.grid.gridInterface.getDatasource();
                return [...grid.querySelectorAll('.simple-html-grid-col-cell[type="row-cell"]')]
                    .filter((c) => c.$attribute === f && c.closest('.simple-html-grid-row').style.display === 'block')
                    .sort((a, b) => a.$row - b.$row)
                    .map((cell) => {
                        const row = datasource.getRow(cell.$row);
                        const input = cell.querySelector('input');
                        const styles = getComputedStyle(cell);
                        const rowBg = getComputedStyle(cell.closest('.simple-html-grid-row')).backgroundColor;
                        const bg = window.__rgb(styles.backgroundColor)[3] === 0 ? rowBg : styles.backgroundColor;
                        const colour = getComputedStyle(input ?? cell).color;
                        return {
                            row: cell.$row,
                            value: row?.[f],
                            price: row?.price,
                            qty: row?.qty,
                            status: row?.status,
                            daysLate: row?.daysLate,
                            total: row?.total,
                            text: input?.value,
                            classes: [...cell.classList].filter((n) => n.startsWith('simple-html-grid-cell-')),
                            custom: cell.style.getPropertyValue('--simple-html-grid-rule-bg'),
                            bg,
                            colour,
                            weight: getComputedStyle(input ?? cell).fontWeight,
                            contrast: Math.round(window.__contrast(window.__rgb(colour), window.__rgb(bg)) * 100) / 100
                        };
                    });
            }, field);
        const scrollTo = async (field) => {
            await page.evaluate((f) => {
                const g = document.querySelector('.stage simple-html-grid').grid.gridInterface;
                const center = g.__getGridConfig().layout.center;
                const index = center.findIndex((c) => c.fields.includes(f));
                const left = center.slice(0, index).reduce((sum, c) => sum + c.width, 0);
                const scroller = document.querySelector('.stage .simple-html-grid-middle-scroller');
                scroller.scrollLeft = Math.max(0, left - 100);
            }, field);
            await page.waitForTimeout(250);
        };
        const openDialog = async (field) => {
            await api((gi, f) => gi.openColumnSettings(f), field);
            await page.waitForSelector(dialogSel);
            await page.waitForTimeout(120);
        };

        // ---- the sample's calculated columns
        const totals = await cellsOf('total');
        check(
            `${name}: Total is price * qty on every row on screen, formatted with 2 decimals`,
            totals.length > 5 &&
                totals.every((c) => Math.abs(c.value - c.price * c.qty) < 1e-9 && c.text === (c.price * c.qty).toFixed(2)),
            totals.slice(0, 3)
        );
        const days = await cellsOf('daysLate');
        check(
            `${name}: Days late: 0 for a done order, else at least 0`,
            days.every((c) => (c.status === 'done' ? c.value === 0 : c.value >= 0) && c.text === String(c.value)),
            days.slice(0, 3)
        );
        // the multi-field rule on Customer: late AND a total over 2000 -> red, bold
        const customers = await cellsOf('customer');
        const flagged = customers.filter((c) => c.daysLate > 0 && c.total > 2000);
        check(
            `${name}: the rule on two fields colours Customer where late and over 2000 only, readable`,
            flagged.length > 0 &&
                customers.every(
                    (c) => c.classes.includes('simple-html-grid-cell-text-red') === (c.daysLate > 0 && c.total > 2000)
                ) &&
                flagged.every((c) => Number(c.weight) >= 700 && c.contrast >= 4.5),
            { flagged: flagged.length, sample: flagged.slice(0, 1) }
        );
        // the formula rule on Total: a custom background, black or white text on it
        const custom = totals.filter((c) => c.qty >= 15 && c.status === 'waiting');
        check(
            `${name}: the formula rule on Total: its custom colour as a custom property, text 4.5:1 on it`,
            custom.length > 0 &&
                totals.every(
                    (c) => c.classes.includes('simple-html-grid-cell-bg-custom') === (c.qty >= 15 && c.status === 'waiting')
                ) &&
                custom.every((c) => c.custom === '#c4b5fd' && c.bg === 'rgb(196, 181, 253)' && c.contrast >= 4.5),
            custom.slice(0, 1)
        );
        await shot('calculated-grid');

        if (full) {
            // ---- sort on Total by its label
            await page.evaluate(() => {
                const cells = [...document.querySelectorAll('.stage .simple-html-grid-col-cell')];
                cells
                    .find((c) => c.$attribute === 'total' && c.getAttribute('type') === 'label')
                    ?.setAttribute('data-check', 'label-total');
            });
            await page.locator('[data-check="label-total"]').click();
            await page.waitForTimeout(200);
            const sorted = (await cellsOf('total')).map((c) => c.value);
            check(
                `${name}: a click on Total's label sorts on its values`,
                sorted.every((v, i) => i === 0 || sorted[i - 1] <= v),
                sorted.slice(0, 5)
            );
            // ---- the header filter on Total: >= 3000 (the column's operator)
            await page.evaluate(() =>
                [...document.querySelectorAll('.stage input.simple-html-grid-cell-filter-input')]
                    .find((input) => input.parentElement?.$attribute === 'total')
                    ?.setAttribute('data-check', 'filter-total')
            );
            const filterInput = page.locator('[data-check="filter-total"]');
            await filterInput.fill('3000');
            await filterInput.press('Enter');
            await page.waitForTimeout(250);
            const filtered = (await cellsOf('total')).map((c) => c.value);
            check(
                `${name}: the header filter of Total filters on the values computed`,
                filtered.length > 0 && filtered.every((v) => v >= 3000),
                filtered.slice(0, 5)
            );
            await api((gi) => gi.setState({ filter: null, headerFilters: {}, sorting: [] }));
            await page.waitForTimeout(150);
            // ---- an edit of a price changes the total of its row
            const before = (await cellsOf('total'))[0];
            const priceInput = page
                .locator('.stage .simple-html-grid-col-cell[type="row-cell"] input[data-attribute="price"]')
                .first();
            await priceInput.click();
            await priceInput.fill('100');
            await priceInput.press('Enter');
            await page.waitForTimeout(250);
            const after = (await cellsOf('total')).find((c) => c.row === before.row);
            const changes = await api((gi) => JSON.stringify(gi.getDatasource().getChanges().modifiedEntities));
            check(
                `${name}: an edit of a price: its total follows, only the price is a change`,
                after.price === 100 &&
                    after.value === 100 * after.qty &&
                    after.text === (100 * after.qty).toFixed(2) &&
                    !changes.includes('total'),
                { before: before.value, after, changes }
            );
        }

        // ---- the dialog: three calculated columns
        await openDialog('total');
        const addCalc = async (formula) => {
            await button('Add calculated column').click();
            await page.waitForTimeout(100);
            const focused = await page.evaluate(() => document.activeElement?.id?.replace(/^.*-settings-/, ''));
            await byId('calculated-formula').fill(formula);
            await page.waitForTimeout(100);
            return focused;
        };
        const focused = await addCalc('{price} * ');
        // the second field with the { } button: at the caret
        await page.locator(`${dialogSel} .column-settings-calculated .column-settings-insert`).click();
        await page.waitForTimeout(150);
        await page.locator('.simple-html-grid-menu-search').fill('qty');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
        const first = await page.evaluate(() => ({
            formula: document.querySelector('dialog.column-settings [id$="-settings-calculated-formula"]').value,
            gives: document.querySelector('dialog.column-settings .column-settings-calculated-type')?.textContent.trim(),
            value: document.querySelector('dialog.column-settings .column-settings-calculated-value')?.textContent.trim(),
            name: document.querySelector('dialog.column-settings [id$="-settings-calculated-name"]')?.value,
            pending: !!document.querySelector('dialog.column-settings .column-settings-calculated-pending')
        }));
        check(
            `${name}: Add calculated column: calc_1, the focus on its formula, { } puts {qty} in, Gives: Number, its value in the row`,
            focused === 'calculated-formula' &&
                first.name === 'calc_1' &&
                first.formula === '{price} * {qty}' &&
                first.gives === 'Gives: Number' &&
                /^In this row: [\d.]+$/.test(first.value) &&
                first.pending,
            first
        );
        await addCalc('IF({qty} >= 10, "bulk", "single")');
        const second = await page.evaluate(() =>
            document.querySelector('dialog.column-settings .column-settings-calculated-type')?.textContent.trim()
        );
        check(`${name}: an IF gives a text`, second === 'Gives: Text', second);
        await addCalc('DAYS({due}, TODAY())');
        await byId('calculated-label').fill('Age of due');
        // an invalid one: its problem at once, Apply waits, the badge Error
        await addCalc('{price} *');
        const invalid = await page.evaluate(() => ({
            problem: [
                ...document.querySelectorAll('dialog.column-settings .column-settings-calculated .column-settings-problem')
            ].map((p) => p.textContent.trim()),
            apply: [...document.querySelectorAll('dialog.column-settings button')]
                .find((b) => b.textContent.trim() === 'Apply')
                ?.getAttribute('aria-disabled'),
            badges: [
                ...document.querySelectorAll('dialog.column-settings [role="option"][data-field="calc_4"] .column-settings-badge')
            ].map((b) => b.textContent.trim())
        }));
        check(
            `${name}: an invalid formula: its problem at once, Apply aria-disabled, the badge Error`,
            invalid.problem.includes('The formula ends too soon') && invalid.apply === 'true' && invalid.badges.includes('Error'),
            invalid
        );
        await byId('calculated-formula').fill('{price} * {qty} / 0');
        await page.waitForTimeout(80);
        const divide = await page.evaluate(() =>
            [...document.querySelectorAll('dialog.column-settings .column-settings-calculated .column-settings-problem')].map(
                (p) => p.textContent.trim()
            )
        );
        check(
            `${name}: a division by 0 is said for the row, it holds nothing back`,
            divide.includes('Divides by 0 in this row: no value'),
            divide
        );
        await button('Remove calculated column').click();
        await page.waitForTimeout(100);
        await shot('calculated-dialog', page.locator(dialogSel));
        await button('Apply').click();
        await page.waitForTimeout(300);
        const applied = await api((gi) => {
            const state = gi.getState();
            const row = gi
                .getDatasource()
                .getRows()
                .find((r) => !r.__group);
            return {
                calculated: state.calculatedColumns,
                last: state.layout.center.slice(-3).map((c) => c.fields[0]),
                values: [row.calc_1, row.calc_2, row.calc_3, row.price * row.qty]
            };
        });
        check(
            `${name}: Apply: the three at the end of the layout, their values in the rows`,
            applied.last.join() === 'calc_1,calc_2,calc_3' &&
                applied.calculated.calc_3.label === 'Age of due' &&
                applied.calculated.calc_4 === undefined &&
                Math.abs(applied.values[0] - applied.values[3]) < 1e-9 &&
                ['bulk', 'single'].includes(applied.values[1]) &&
                Number.isInteger(applied.values[2]),
            applied
        );

        // ---- a colour rule of the kind Conditions on calc_2, made in the dialog: status = waiting AND qty >= 10
        await page.locator(`${dialogSel} [role="option"][data-field="calc_2"]`).click();
        await page.waitForTimeout(100);
        await button('Add rule').click();
        await page.waitForTimeout(80);
        await byId('rule-0-kind-conditions').check();
        await page.waitForTimeout(80);
        await byId('rule-0-condition-0-field').click();
        await page.waitForTimeout(120);
        await page.locator('.simple-html-grid-menu-search').fill('status');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(120);
        await byId('rule-0-condition-0-value').fill('waiting');
        await button('Add condition').click();
        await page.waitForTimeout(100);
        await byId('rule-0-condition-1-field').click();
        await page.waitForTimeout(120);
        await page.locator('.simple-html-grid-menu-search').fill('qty');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(120);
        await byId('rule-0-condition-1-value').fill('10');
        await page.locator(`${dialogSel} input[name$="-rule-0-color"][aria-label="None"]`).click();
        await page.locator(`${dialogSel} input[name$="-rule-0-background"][aria-label="Teal"]`).click();
        await page.waitForTimeout(80);
        // a second rule of the kind Formula, with a custom background from the colour picker
        await button('Add rule').click();
        await page.waitForTimeout(80);
        await byId('rule-1-kind-formula').check();
        await page.waitForTimeout(80);
        await byId('rule-1-expression').fill('{qty} < 3');
        await page.waitForTimeout(80);
        await page.locator(`${dialogSel} input[name$="-rule-1-color"][aria-label="None"]`).click();
        await page.evaluate(() => {
            const input = document.querySelector('dialog.column-settings [id$="-settings-rule-1-background-custom"]');
            input.value = '#fbbf24';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await page.waitForTimeout(100);
        const ruleDialog = await page.evaluate(() => ({
            result: document
                .querySelector('dialog.column-settings .column-settings-rule[data-rule="1"] .column-settings-rule-result')
                ?.textContent.trim(),
            problems: [...document.querySelectorAll('dialog.column-settings .column-settings-rule .column-settings-problem')].map(
                (p) => p.textContent.trim()
            ),
            customPicked: document
                .querySelector('dialog.column-settings [id$="-settings-rule-1-background-custom"]')
                .classList.contains('column-settings-swatch-custom-picked'),
            radios: document.querySelectorAll('dialog.column-settings input[name$="-rule-1-background"]:checked').length
        }));
        check(
            `${name}: the dialog: a rule on two fields and a formula rule, its result in the row, the custom colour picked (no swatch checked)`,
            /^(True|False) in this row/.test(ruleDialog.result ?? '') &&
                ruleDialog.problems.length === 0 &&
                ruleDialog.customPicked &&
                ruleDialog.radios === 0,
            ruleDialog
        );
        await page.locator(`${dialogSel} .column-settings-rules`).scrollIntoViewIfNeeded();
        await shot('calculated-rules-dialog', page.locator(dialogSel));
        await button('Apply & close').click();
        await page.waitForTimeout(300);
        await scrollTo('calc_2');
        const coloured = await cellsOf('calc_2');
        const teal = await page.evaluate(() => {
            const probe = document.createElement('span');
            probe.style.backgroundColor = 'var(--simple-html-grid-palette-teal-bg-color)';
            document.querySelector('.stage simple-html-grid').appendChild(probe);
            const value = getComputedStyle(probe).backgroundColor;
            probe.remove();
            return value;
        });
        const both = coloured.filter((c) => c.status === 'waiting' && c.qty >= 10);
        const few = coloured.filter((c) => !(c.status === 'waiting' && c.qty >= 10) && c.qty < 3);
        check(
            `${name}: Apply: waiting AND qty >= 10 on teal, qty < 3 (else) on the custom amber, readable`,
            both.length > 0 &&
                both.every((c) => c.bg === teal && c.contrast >= 4.5) &&
                few.every((c) => c.bg === 'rgb(251, 191, 36)' && c.contrast >= 4.5) &&
                coloured
                    .filter((c) => !(c.status === 'waiting' && c.qty >= 10) && c.qty >= 3)
                    .every((c) => !c.classes.includes('simple-html-grid-cell-bg')),
            { teal, both: both.slice(0, 1), few: few.slice(0, 1) }
        );
        const ruleState = await api((gi) => JSON.stringify(gi.getState().formats.calc_2));
        check(
            `${name}: the state has the two rules as plain JSON`,
            ruleState ===
                JSON.stringify({
                    rules: [
                        {
                            conditions: [
                                { field: 'status', operator: 'EQUAL', value: 'waiting' },
                                { field: 'qty', operator: 'GREATER_THAN_OR_EQUAL_TO', value: '10' }
                            ],
                            background: 'teal'
                        },
                        { expression: '{qty} < 3', background: '#fbbf24' }
                    ]
                }),
            ruleState
        );
        await shot('calculated-applied');

        // ---- the state round trip
        const roundTrip = await api((gi) => {
            const saved = JSON.parse(JSON.stringify(gi.getState()));
            gi.setState({ calculatedColumns: {} });
            const without = gi.getState().layout.center.map((c) => c.fields[0]);
            const rowWithout = gi.getDatasource().getAllData()[0].total;
            gi.setState(saved);
            const back = gi.getState();
            return {
                without,
                rowWithout,
                back: back.layout.center.map((c) => c.fields[0]),
                same: JSON.stringify(back.calculatedColumns) === JSON.stringify(saved.calculatedColumns),
                total: gi.getDatasource().getAllData()[0].total
            };
        });
        check(
            `${name}: the state round trip: without them the layout has none, back they are there again`,
            !roundTrip.without.some((f) => ['total', 'daysLate', 'calc_1'].includes(f)) &&
                roundTrip.rowWithout === undefined &&
                roundTrip.back.includes('calc_3') &&
                roundTrip.same &&
                typeof roundTrip.total === 'number',
            roundTrip
        );

        const radius = await page.evaluate(() => {
            const all = [...document.querySelectorAll('.stage simple-html-grid *')];
            return all
                .map((e) => getComputedStyle(e).borderRadius)
                .filter((r) => r !== '0px')
                .slice(0, 3);
        });
        check(`${name}: no rounded corners in the grid`, radius.length === 0, radius);
        await context.close();
    }

    // a phone: the dialog of a calculated column fits, the swatches stay 20px
    {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push(`phone: ${e}`));
        await page.addInitScript(() => localStorage.setItem('simple-html-demo-theme', 'light'));
        await page.goto(`${base}#sample/calculated-columns`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
        await page.waitForTimeout(400);
        await page.evaluate(() =>
            document.querySelector('.stage simple-html-grid').grid.gridInterface.openColumnSettings('total')
        );
        await page.waitForTimeout(200);
        // the swatches are on the Colours tab of the column's settings
        await page.locator('dialog.column-settings .column-settings-sections [role="tab"]', { hasText: 'Colours' }).click();
        await page.waitForTimeout(150);
        const phone = await page.evaluate(() => {
            const dialog = document.querySelector('dialog.column-settings').getBoundingClientRect();
            const wide = [...document.querySelectorAll('dialog.column-settings .column-settings-panel *')].filter(
                (e) => e.getBoundingClientRect().right > dialog.right + 1
            );
            const swatch = document.querySelector('dialog.column-settings .column-settings-swatch')?.getBoundingClientRect();
            return {
                dialogRight: Math.round(dialog.right),
                width: innerWidth,
                wide: wide.map((e) => e.className).slice(0, 3),
                swatch: swatch && [swatch.width, swatch.height]
            };
        });
        check(
            'phone: the dialog in the screen, nothing wider than it, the swatches 20px',
            phone.dialogRight <= phone.width && phone.wide.length === 0 && phone.swatch?.[0] === 20,
            phone
        );
        if (shots) {
            await page.locator('dialog.column-settings .column-settings-rules').scrollIntoViewIfNeeded();
            await page.screenshot({ path: `${shots}/calculated-phone.png` });
        }
        await context.close();
    }

    check('no page errors', errors.length === 0, errors.slice(0, 3));
    await browser.close();
    console.log(results.join('\n'));
    console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
})();
