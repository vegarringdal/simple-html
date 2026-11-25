// Real browser check of the column settings dialog's label, placeholder, blank / 0 and checkboxes
// (columnSettings.ts, ColumnFormat.label / placeholder / placeholderLabel / numberOverride / checkbox) on the
// "Full grid" sample (#sample/full-grid), in the four looks: default and TreDeSpace, light and dark.
// - a label: typed in the dialog, the list, the heading and the badge follow at once; Apply -> the header,
//   the header filter's name, the column chooser, a footer chip, the filter editor's field, the CSV header
// - the placeholder: a text, then Use the column label (the input dashed and off, the label in it)
// - a number column: Show 0 as blank / Show blank as 0, one turns the other off; the cells, the CSV
// - Show as checkbox on Newsletter (1 / 0 as text): the values, a problem (the same value twice) holds
//   Apply back; the cells are checkboxes, checked where the value is 1; a click writes '0' / '1', Space
//   too, Shift+click nothing; editing off: a click changes nothing; the CSV, a header filter on 1 and
//   sorting keep to the value
// - getState() -> JSON -> resetState() -> setState() gives it all back; Reset all in the dialog
// - no rounded corners in the dialog; screenshots of the dialog and the grid in each look
// Usage: node column-settings-more-check.js <site url> [shots dir]
const path = require('node:path');
const fs = require('node:fs');
const [, , base, shots] = process.argv;
if (!base) {
    console.log('usage: node column-settings-more-check.js <site url> [screenshot dir]');
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
    results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? `  (${JSON.stringify(detail)})` : ''}`);

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
        const context = await browser.newContext({ viewport: { width: 1300, height: 1000 } });
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
        page.on('console', (m) => m.type() === 'error' && errors.push(`${name} console: ${m.text()}`));
        await page.addInitScript((l) => {
            localStorage.setItem('simple-html-demo-theme', l.theme);
            localStorage.setItem('simple-html-demo-grid-theme', l.grid);
        }, look);
        await page.goto(`${base}#sample/full-grid`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
        await page.waitForTimeout(400);

        const dialogSel = 'dialog.column-settings';
        const gearSel = '.stage .footer-settings';
        /** runs a function with the grid's interface in the page */
        const api = (fn, arg) =>
            page.evaluate(
                ([source, a]) => {
                    const gi = document.querySelector('.stage simple-html-grid').grid.gridInterface;
                    // biome-ignore lint/security/noGlobalEval: the check's own function, sent as text
                    return eval(`(${source})`)(gi, a);
                },
                [fn.toString(), arg]
            );
        const openDialog = async () => {
            await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
            await page.locator(gearSel).click();
            await page.waitForSelector(dialogSel);
            await page.waitForTimeout(100);
        };
        const pick = async (field) => {
            await page.locator(`${dialogSel} [role="option"][data-field="${field}"]`).click();
            await page.waitForTimeout(80);
        };
        const toggle = async (text) => {
            await page.locator(`${dialogSel} .column-settings-check`, { hasText: text }).click();
            await page.waitForTimeout(60);
        };
        const checked = (text) =>
            page.locator(`${dialogSel} .column-settings-check`, { hasText: text }).locator('input').isChecked();
        const input = (part) => page.locator(`${dialogSel} input[id$="-settings-${part}"]`);
        const option = (field) =>
            page.evaluate(
                ([sel, f]) => {
                    const o = document.querySelector(`${sel} [role="option"][data-field="${f}"]`);
                    return {
                        label: o.querySelector('.column-settings-option-label').textContent.trim(),
                        badges: [...o.querySelectorAll('.column-settings-badge')].map((b) => b.textContent.trim())
                    };
                },
                [dialogSel, field]
            );
        const heading = () =>
            page.evaluate(() => document.querySelector('.column-settings-heading')?.textContent.replace(/\s+/g, ' ').trim());
        const shot = async (file, locator) => {
            if (shots) {
                await (locator ?? page).screenshot({ path: `${shots}/${file}-${name}.png` });
            }
        };
        const button = (text) => page.locator(`${dialogSel} button`, { hasText: new RegExp(`^\\s*${text}\\s*$`) });
        /** the grid renders the columns in view: scrolled sideways until the field's cells are in it */
        const scrollTo = async (field) => {
            for (let left = 0; left < 6000; left += 100) {
                const found = await page.evaluate(
                    ([f, l]) => {
                        const scroller = document.querySelector('.stage .simple-html-grid-middle-scroller');
                        const r = document.querySelector(`.stage input[data-attribute="${f}"]`)?.getBoundingClientRect();
                        const s = scroller.getBoundingClientRect();
                        if (r && r.left >= s.left && r.right <= s.right) {
                            return true;
                        }
                        scroller.scrollLeft = l;
                        return false;
                    },
                    [field, left]
                );
                if (found) {
                    break;
                }
                await page.waitForTimeout(120);
            }
            await page.waitForTimeout(200);
        };

        // ---- the label and the placeholder of a column: Company
        await openDialog();
        await pick('company');
        await input('label').fill('Firm');
        await page.waitForTimeout(60);
        let company = await option('company');
        check(
            `${name}: label: the list and the heading follow the label typed, its badge`,
            company.label === 'Firm' && company.badges.includes('Label') && (await heading()) === 'Firm Text',
            { company, heading: await heading() }
        );
        const labelPlaceholder = await input('label').getAttribute('placeholder');
        check(
            `${name}: label: the input shows the column's own label when empty`,
            labelPlaceholder === 'Company',
            labelPlaceholder
        );
        await input('placeholder').fill('Search firms');
        await page.waitForTimeout(60);
        company = await option('company');
        check(`${name}: placeholder: its badge`, company.badges.includes('Placeholder'), company);
        await shot('settings-more-label', page.locator(dialogSel));
        const radius = await page.evaluate(() =>
            [...document.querySelectorAll('dialog.column-settings, dialog.column-settings *')]
                .filter((e) => !(e instanceof HTMLInputElement && e.type === 'checkbox'))
                .map((e) => getComputedStyle(e).borderRadius)
                .filter((r) => r !== '0px')
        );
        check(`${name}: no rounded corners in the dialog`, radius.length === 0, radius.slice(0, 3));
        await button('Apply & close').click();
        await page.waitForTimeout(200);

        const headerText = (field) =>
            page.evaluate((f) => document.querySelector(`.stage [data-attribute-header="${f}"]`)?.textContent.trim(), field);
        const filterInput = (label) =>
            page.locator(`.stage input.simple-html-grid-cell-filter-input[aria-label="Filter ${label}"]`);
        check(`${name}: label: the header`, (await headerText('company')) === 'Firm', await headerText('company'));
        // the placeholder is the empty cells' (the user: it "was supposed to be for row"): the current row's
        // Company input has it - a placeholder is shown on the current row only by default
        const rowPlaceholder = () =>
            page.evaluate(() => {
                const gi = document.querySelector('.stage simple-html-grid').grid.gridInterface;
                gi.getDatasource().setRowAsCurrentEntity(0);
                const cell = [...document.querySelectorAll('.stage input[data-attribute="company"]')].find(
                    (input) => input.className.includes('cellpos-') && / cellpos-[a-z-]*?-0-/.test(` ${input.className}`)
                );
                return cell?.getAttribute('placeholder') ?? null;
            });
        check(
            `${name}: label: the header filter's name`,
            (await filterInput('Firm').count()) === 1,
            await filterInput('Firm').count()
        );
        check(
            `${name}: placeholder: the current row's empty cells`,
            (await rowPlaceholder()) === 'Search firms',
            await rowPlaceholder()
        );
        // the column chooser (header menu, Columns...)
        await page.locator('.stage [data-attribute-header="company"]').click({ button: 'right' });
        await page.locator('[data-menu-id="header.column.chooser"]').click();
        await page.waitForTimeout(150);
        const chooser = await page.evaluate(() =>
            [...document.querySelectorAll('.simple-html-grid-menu-item')]
                .map((e) => e.textContent.trim())
                .filter((t) => t === 'Firm' || t === 'Company')
        );
        check(`${name}: label: the column chooser`, chooser.includes('Firm') && !chooser.includes('Company'), chooser);
        await page.locator('.simple-html-label-button-menu-bottom').click();
        await page.waitForTimeout(100);
        // a filter on it: the footer's chip, the filter editor's field, the CSV header
        await filterInput('Firm').fill('wonka');
        await filterInput('Firm').press('Enter');
        await page.waitForTimeout(250);
        const chip = await page.evaluate(() =>
            [...document.querySelectorAll('.stage .footer-filter-attr')].map((e) => e.textContent.trim())
        );
        check(`${name}: label: the footer's filter chip`, chip.includes('Firm'), chip);
        await api((gi) => gi.openFilterEditor());
        await page.waitForTimeout(200);
        const editorField = await page.evaluate(() =>
            [...document.querySelectorAll('dialog.filter-editor-content:not(.column-settings) .filter-editor-pick-text')].map(
                (e) => e.textContent.trim()
            )
        );
        check(`${name}: label: the filter editor's field`, editorField.includes('Firm'), editorField);
        await shot('settings-more-filter-editor');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
        const csvHeader = await api((gi) => gi.getCsv({ rows: 'all' }).split(/\r?\n/)[0]);
        check(
            `${name}: label: the CSV header`,
            csvHeader.split(',').includes('Firm') && !csvHeader.split(',').includes('Company'),
            csvHeader.slice(0, 60)
        );
        await api((gi) => {
            gi.getDatasource().filter(null);
            gi.setState({ headerFilters: {} });
        });
        await page.waitForTimeout(200);

        // Use the column label: the input off (dashed), the label in it
        await openDialog();
        await pick('company');
        await toggle('Use the column label');
        const placeholderInput = await page.evaluate(() => {
            const i = document.querySelector('dialog.column-settings input[id$="-settings-placeholder"]');
            return {
                disabled: i.disabled,
                placeholder: i.placeholder,
                value: i.value,
                border: getComputedStyle(i).borderTopStyle
            };
        });
        check(
            `${name}: Use the column label: the input off and dashed, the label in it`,
            placeholderInput.disabled &&
                placeholderInput.placeholder === 'Firm' &&
                placeholderInput.value === '' &&
                placeholderInput.border === 'dashed',
            placeholderInput
        );
        await button('Apply & close').click();
        await page.waitForTimeout(200);
        check(
            `${name}: Use the column label: the empty cells' placeholder is the label`,
            (await rowPlaceholder()) === 'Firm',
            await rowPlaceholder()
        );
        check(
            `${name}: the header filter keeps its own placeholder`,
            (await filterInput('Firm').getAttribute('placeholder')) === 'Text'
        );

        // ---- a number column: blank / 0 on discount
        await api((gi) => {
            const rows = gi.getDatasource().getRows();
            rows[0].discount = 0;
            rows[1].discount = null;
        });
        await openDialog();
        await pick('discount');
        await toggle('Show 0 as blank');
        check(
            `${name}: 0 as blank: on, its badge`,
            (await checked('Show 0 as blank')) && (await option('discount')).badges.includes('Blank / 0')
        );
        await toggle('Show blank as 0');
        check(
            `${name}: blank as 0 turns 0 as blank off`,
            (await checked('Show blank as 0')) && !(await checked('Show 0 as blank'))
        );
        await toggle('Show 0 as blank');
        check(`${name}: and the other way`, !(await checked('Show blank as 0')) && (await checked('Show 0 as blank')));
        await shot('settings-more-number', page.locator(dialogSel));
        await button('Apply & close').click();
        await page.waitForTimeout(200);
        await scrollTo('discount');
        const discountCells = () =>
            page.evaluate(() =>
                [...document.querySelectorAll('.stage input[data-attribute="discount"]')].slice(0, 2).map((e) => e.value)
            );
        let cells = await discountCells();
        check(`${name}: 0 as blank: the cell of 0 is empty, a blank empty`, cells[0] === '' && cells[1] === '', cells);
        let csv = await api((gi) => gi.getCsv({ rows: 'all', fields: ['discount'] }).split(/\r?\n/));
        // a CSV of one column quotes an empty value: a line of its own
        check(`${name}: 0 as blank: the CSV too`, csv[0] === 'Discount' && csv[1] === '""' && csv[2] === '""', csv.slice(0, 3));
        await openDialog();
        await pick('discount');
        await toggle('Show blank as 0');
        await button('Apply & close').click();
        await page.waitForTimeout(200);
        await scrollTo('discount');
        cells = await discountCells();
        check(`${name}: blank as 0: 0 and the blank show 0`, cells[0] === '0' && cells[1] === '0', cells);

        // ---- Show as checkbox on Newsletter: '1' / '0' as text
        await api((gi) => gi.getDatasource().setRowAsCurrentEntity(0));
        await openDialog();
        await pick('newsletter');
        await toggle('Show as checkbox');
        const values = { checked: await input('checked').inputValue(), unchecked: await input('unchecked').inputValue() };
        const textGone =
            (await input('text').count()) === 0 &&
            (await page.locator(`${dialogSel} .column-settings-check`, { hasText: 'Show as link' }).count()) === 0;
        check(
            `${name}: checkbox: the values 1 / 0, no template and no link while it is on`,
            values.checked === '1' && values.unchecked === '0' && textGone,
            values
        );
        check(
            `${name}: checkbox: its badge`,
            (await option('newsletter')).badges.includes('Checkbox'),
            await option('newsletter')
        );
        await input('unchecked').fill('1');
        await page.waitForTimeout(60);
        const held = await page.evaluate(() => ({
            problems: [...document.querySelectorAll('dialog.column-settings .column-settings-problem')].map((p) =>
                p.textContent.trim()
            ),
            apply: document.querySelector('dialog.column-settings .simple-html-grid-button-primary').getAttribute('aria-disabled')
        }));
        check(
            `${name}: checkbox: the same value twice is a problem, Apply held back`,
            held.problems.some((p) => p.startsWith('The checked and the unchecked value are the same')) && held.apply === 'true',
            held
        );
        await shot('settings-more-checkbox-problem', page.locator(dialogSel));
        await input('unchecked').fill('0');
        await page.waitForTimeout(60);
        await shot('settings-more-checkbox', page.locator(dialogSel));
        await button('Apply & close').click();
        await page.waitForTimeout(250);

        // the cells: checkboxes, scrolled into view
        await scrollTo('newsletter');
        const state = () =>
            page.evaluate(() => {
                const gi = document.querySelector('.stage simple-html-grid').grid.gridInterface;
                const rows = gi.getDatasource().getRows();
                const boxes = [...document.querySelectorAll('.stage input[data-attribute="newsletter"]')];
                return {
                    types: [...new Set(boxes.map((b) => b.type))],
                    shown: boxes.slice(0, 6).map((b) => b.checked),
                    values: rows.slice(0, 6).map((r) => r.newsletter)
                };
            });
        let now = await state();
        check(
            `${name}: checkbox: the cells are checkboxes, checked where the value is '1'`,
            now.types.length === 1 && now.types[0] === 'checkbox' && now.shown.every((on, i) => on === (now.values[i] === '1')),
            now
        );
        const box = page.locator('.stage input[data-attribute="newsletter"]').first();
        const before = now.values[0];
        await box.click();
        await page.waitForTimeout(150);
        now = await state();
        const flipped = before === '1' ? '0' : '1';
        check(
            `${name}: checkbox: a click writes '${flipped}' (text), the box follows`,
            now.values[0] === flipped && now.shown[0] === (flipped === '1'),
            now
        );
        await box.press('Space');
        await page.waitForTimeout(150);
        now = await state();
        check(`${name}: checkbox: Space writes it back`, now.values[0] === before && now.shown[0] === (before === '1'), now);
        await box.click({ modifiers: ['Shift'] });
        await page.waitForTimeout(150);
        now = await state();
        check(`${name}: checkbox: Shift+click changes nothing`, now.values[0] === before, now);
        await shot('settings-more-cells');
        // editing off: a click changes nothing
        await page.locator('.stage-buttons button, .stage button', { hasText: 'Editing: on' }).first().click();
        await page.waitForTimeout(250);
        await page.locator('.stage input[data-attribute="newsletter"]').first().click();
        await page.waitForTimeout(150);
        now = await state();
        check(
            `${name}: checkbox: editing off, a click changes nothing`,
            now.values[0] === before && now.shown[0] === (before === '1'),
            now
        );
        /** the header filter of a column shown as checkboxes is a checkbox, neither checked nor unchecked at first */
        const expectFilterCheckbox = async (locator) => {
            const box = await locator.evaluate((el) => ({ type: el.type, indeterminate: el.indeterminate }));
            check(
                `${name}: checkbox: the header filter is a checkbox, no filter at first`,
                box.type === 'checkbox' && box.indeterminate,
                box
            );
        };
        await page.locator('.stage button', { hasText: 'Editing: off' }).first().click();
        await page.waitForTimeout(200);
        // the value stays the value: the CSV, the header filter, sorting
        csv = await api((gi) => gi.getCsv({ rows: 'all', fields: ['newsletter'] }).split(/\r?\n/));
        check(
            `${name}: checkbox: the CSV has 1 / 0`,
            csv[0] === 'Newsletter' && csv.slice(1, 6).every((line) => line === '0' || line === '1'),
            csv.slice(0, 4)
        );
        // the header filter is a checkbox now: a click checks it - the rows of the checked value
        await expectFilterCheckbox(filterInput('Newsletter'));
        await filterInput('Newsletter').click();
        await page.waitForTimeout(250);
        const filtered = await api((gi) => {
            const rows = gi.getDatasource().getRows();
            return { count: rows.length, all1: rows.every((r) => r.newsletter === '1') };
        });
        check(
            `${name}: checkbox: the header's checkbox checked keeps the checked rows`,
            filtered.count > 0 && filtered.count < 5000 && filtered.all1,
            filtered
        );
        now = await state();
        check(
            `${name}: checkbox: all shown checked`,
            now.shown.every((on) => on),
            now
        );
        // not checked: the others; a third click: no filter
        await filterInput('Newsletter').click();
        await page.waitForTimeout(250);
        const unchecked = await api((gi) => {
            const rows = gi.getDatasource().getRows();
            return { count: rows.length, none1: rows.every((r) => r.newsletter !== '1') };
        });
        check(
            `${name}: checkbox: the header's checkbox unchecked keeps the others`,
            unchecked.count > 0 && unchecked.none1,
            unchecked
        );
        await filterInput('Newsletter').click();
        await page.waitForTimeout(250);
        const all = await api((gi) => gi.getDatasource().getRows().length);
        check(`${name}: checkbox: a third click, no filter`, all >= 5000 || all === filtered.count + unchecked.count, { all });
        // a click on the header sorts
        await page.locator('.stage [data-attribute-header="newsletter"]').click();
        await page.waitForTimeout(250);
        const sorted = await api((gi) =>
            gi
                .getDatasource()
                .getRows()
                .slice(0, 3)
                .map((r) => r.newsletter)
        );
        check(
            `${name}: checkbox: sorted by the value, 0 first`,
            sorted.every((v) => v === '0'),
            sorted
        );

        // ---- the state: JSON, reset, back
        const saved = await api((gi) => JSON.stringify(gi.getState().formats));
        const parsed = JSON.parse(saved);
        check(
            `${name}: state: the formats have it all`,
            parsed.company?.label === 'Firm' &&
                parsed.company?.placeholderRowLabel === true &&
                parsed.discount?.numberOverride === 'BLANK_TO_ZERO' &&
                parsed.newsletter?.checkbox?.checked === '1',
            parsed
        );
        await api((gi) => gi.resetState());
        await page.waitForTimeout(250);
        check(`${name}: state: resetState() gives the config's label back`, (await headerText('company')) === 'Company');
        await api((gi, json) => gi.setState({ formats: JSON.parse(json) }), saved);
        await page.waitForTimeout(250);
        now = await state();
        check(
            `${name}: state: setState(JSON) gives it back`,
            (await headerText('company')) === 'Firm' && now.types[0] === 'checkbox',
            { header: await headerText('company'), now }
        );
        await shot('settings-more-grid');

        // Reset all in the dialog: back to the start, applied
        await openDialog();
        await button('Reset all').click();
        await page.waitForTimeout(80);
        const after = { company: await option('company'), newsletter: await option('newsletter') };
        check(
            `${name}: Reset all: the label and the badges gone in the dialog`,
            after.company.label === 'Company' && after.company.badges.length === 0 && after.newsletter.badges.length === 0,
            after
        );
        await button('Apply & close').click();
        await page.waitForTimeout(200);
        now = await state();
        check(
            `${name}: Reset all + Apply: text cells again, the config's label`,
            (await headerText('company')) === 'Company' && now.types[0] === 'text',
            now
        );
        await context.close();
    }
    check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    await browser.close();
    console.log(results.join('\n'));
    const failed = results.filter((r) => r.startsWith('FAIL')).length;
    console.log(`${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})();
