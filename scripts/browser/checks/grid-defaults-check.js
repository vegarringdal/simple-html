// Real browser check of the Defaults tab of the grid config dialog (#sample/views): the formats by type -
// a picker each for Date, Date and time and Number, the menu of Format › under it - the Columns tab
// following the draft (Default: Norwegian, the preview), Apply showing them in the cells; the default view
// picked from Standard and the views, kept in the storage of the views; Reset formats; Cancel dropping a
// change; the tab on a phone (nothing wider than the dialog). Screenshots light, dark and a phone.
// Usage: node grid-defaults-check.js <site url> [screenshot dir]
const path = require('node:path');
const fs = require('node:fs');
const [, , base, shots] = process.argv;
if (!base) {
    console.log('usage: node grid-defaults-check.js <site url> [screenshot dir]');
    process.exit(2);
}
const { chromium, devices } = require('playwright');
if (shots) {
    fs.mkdirSync(shots, { recursive: true });
}

const results = [];
const check = (name, ok, detail = '') =>
    results.push(
        `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : ''}`
    );
const grid = '.stage simple-html-grid';
const dialog = 'dialog.column-settings';
const STORAGE = 'simple-html-demo-views';

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];

    const open = async ({ dark = false, phone = false } = {}) => {
        const context = await browser.newContext(
            phone ? { ...devices['Pixel 7'] } : { viewport: { width: 1300, height: 1000 }, deviceScaleFactor: 2 }
        );
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push(String(e)));
        page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
        await page.addInitScript((d) => {
            localStorage.setItem('simple-html-demo-theme', d ? 'dark' : 'light');
            localStorage.setItem('simple-html-demo-grid-theme', 'default');
            if (!sessionStorage.getItem('grid-defaults-check')) {
                sessionStorage.setItem('grid-defaults-check', '1');
                localStorage.removeItem('simple-html-demo-views');
            }
        }, dark);
        await page.goto(`${base}#sample/views`);
        await page.waitForSelector(`${grid} .footer-settings`);
        return { page, context };
    };
    /** the texts of a column's cells, top to bottom */
    const cells = (page, field) =>
        page.$$eval(`${grid} input[data-attribute="${field}"]`, (inputs) =>
            inputs
                .map((input) => ({ top: input.getBoundingClientRect().top, value: input.value }))
                .sort((a, b) => a.top - b.top)
                .slice(0, 3)
                .map((each) => each.value)
        );
    const pickerText = (page, selector) => page.$eval(`${dialog} ${selector}`, (el) => el.textContent.trim());
    const openDefaults = async (page) => {
        await page.click(`${grid} .footer-settings`);
        await page.waitForSelector(dialog);
        await page.click(`${dialog} [role="tab"][id$="-settings-tab-defaults"]`);
    };

    // light: the tab, a format of each type, the Columns tab, Apply
    {
        const { page, context } = await open();
        const before = await cells(page, 'date1');
        await openDefaults(page);
        const tab = await page.$eval(`${dialog} [role="tab"][id$="-settings-tab-defaults"]`, (el) => ({
            text: el.textContent.trim(),
            selected: el.getAttribute('aria-selected')
        }));
        check('the Defaults tab is there and shown', tab.text === 'Defaults' && tab.selected === 'true', tab);
        const pickers = await page.$$eval(`${dialog} .grid-defaults-format`, (els) =>
            els.map((el) => `${el.dataset.type}: ${el.textContent.trim()}`)
        );
        check(
            'a picker each: date, datetime, number - Default',
            pickers.join('|') === 'date: Default|datetime: Default|number: Default',
            pickers
        );
        if (shots) {
            await page.locator(dialog).screenshot({ path: path.join(shots, 'grid-defaults-light.png') });
        }

        await page.click(`${dialog} .grid-defaults-format[data-type="date"]`);
        const menu = await page.$$eval('[data-menu-id^="header.format.date."]', (els) =>
            els.filter((el) => el.offsetParent !== null).map((el) => el.dataset.menuId.replace('header.format.date.', ''))
        );
        check('the date menu: the dates, no time of day', menu.includes('norwegian') && !menu.includes('isoTime'), menu);
        await page.click('[data-menu-id="header.format.date.norwegian"]');
        check(
            'the date picker says Norwegian',
            (await pickerText(page, '.grid-defaults-format[data-type="date"]')) === 'Norwegian'
        );
        await page.click(`${dialog} .grid-defaults-format[data-type="number"]`);
        await page.click('[data-menu-id="header.format.number.norwegian"]');
        const number = await pickerText(page, '.grid-defaults-format[data-type="number"]');
        check('the number picker shows its example', number === '1 234 567,891', number);
        check('nothing applied yet', JSON.stringify(await cells(page, 'date1')) === JSON.stringify(before), before);

        // the Columns tab: the date column follows the draft
        await page.click(`${dialog} [role="tab"][id$="-settings-tab-columns"]`);
        await page.click(`${dialog} [role="option"][data-field="date1"]`);
        await page.click(
            `${dialog} [role="tab"][id$="-section-display"], ${dialog} .column-settings-sections [role="tab"]:nth-child(2)`
        );
        const columnPicker = await pickerText(page, '.column-settings-body .column-settings-format');
        check("the column's picker: Default and the type's format", columnPicker === 'Default: Norwegian', columnPicker);
        const preview = await page.$eval(`${dialog} .column-settings-preview-cell`, (el) => el.textContent.trim());
        check('the preview in the format of the type', /^\d\d\.\d\d\.\d{4}$/.test(preview), preview);

        await page.click(`${dialog} .simple-html-grid-button-primary`);
        await page.waitForSelector(dialog, { state: 'detached' });
        const dates = await cells(page, 'date1');
        check(
            'Apply: the dates as 22.11.2026',
            dates.length > 0 && dates.every((d) => d === '' || /^\d\d\.\d\d\.\d{4}$/.test(d)),
            dates
        );
        const balances = await cells(page, 'balance');
        check(
            'Apply: the numbers with a comma',
            balances.every((b) => b === '' || /,\d/.test(b) || /^\d[\d ]*$/.test(b)),
            balances
        );

        // the default view: Standard and the views, kept in the storage of the views
        await openDefaults(page);
        const buttonCheck = await page.$eval(`${dialog} .grid-defaults-views-button`, (el) => ({
            checked: el.checked,
            text: el.parentElement.textContent.trim()
        }));
        check(
            'Show the views button: on in a sample with views',
            buttonCheck.checked && buttonCheck.text === 'Show the views button',
            buttonCheck
        );
        const viewPicker = `${dialog} .grid-defaults-view`;
        check('the default view picker: Standard', (await pickerText(page, '.grid-defaults-view')) === 'Standard');
        await page.click(viewPicker);
        const entries = await page.$$eval('[data-menu-id^="columnSettings.defaults.defaultView."]', (els) =>
            els.map((el) => el.textContent.trim())
        );
        check('its menu: Standard and the views', entries.length >= 2 && entries[0].startsWith('Standard'), entries);
        const second = await page.$$eval(
            '[data-menu-id^="columnSettings.defaults.defaultView."]',
            (els) => els[1].dataset.menuId
        );
        await page.click(`[data-menu-id="${second}"]`);
        await page.click(`${dialog} .simple-html-grid-button-primary`);
        const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE);
        check(
            'Apply: the view is the default, kept in the storage',
            stored?.defaultView === second.replace('columnSettings.defaults.defaultView.', ''),
            stored?.defaultView
        );

        // Reset formats and Cancel: nothing changes
        await openDefaults(page);
        await page.click(`${dialog} .column-settings-resets button`);
        check('Reset formats: Default again', (await pickerText(page, '.grid-defaults-format[data-type="date"]')) === 'Default');
        await page.click(`${dialog} .filter-editor-footer button:has-text("Cancel")`);
        check(
            'Cancel: the dates still Norwegian',
            (await cells(page, 'date1')).every((d) => d === '' || /^\d\d\.\d\d\.\d{4}$/.test(d))
        );
        await context.close();
    }

    // dark: a screenshot
    {
        const { page, context } = await open({ dark: true });
        await openDefaults(page);
        const colors = await page.$eval(`${dialog} .grid-defaults-format`, (el) => {
            const style = getComputedStyle(el);
            return [style.color, style.backgroundColor];
        });
        check('dark: the pickers are styled as the others', colors[0] !== colors[1], colors);
        if (shots) {
            await page.locator(dialog).screenshot({ path: path.join(shots, 'grid-defaults-dark.png') });
        }
        await context.close();
    }

    // a phone: nothing of the tab wider than the dialog
    {
        const { page, context } = await open({ phone: true });
        await openDefaults(page);
        const widths = await page.$eval(dialog, (el) => {
            const panel = el.querySelector('.grid-defaults-settings');
            return { dialog: el.getBoundingClientRect().width, scroll: panel.scrollWidth, client: panel.clientWidth };
        });
        check('phone: the tab fits the dialog', widths.scroll <= widths.client + 1, widths);
        if (shots) {
            await page.screenshot({ path: path.join(shots, 'grid-defaults-phone.png') });
        }
        await context.close();
    }

    check('no page errors', errors.length === 0, errors);
    await browser.close();
    for (const line of results) {
        console.log(line);
    }
    const failed = results.filter((line) => line.startsWith('FAIL')).length;
    console.log(`\n${results.length - failed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
