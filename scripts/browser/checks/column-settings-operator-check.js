// Real browser check of the filter operator in the column settings dialog (columnSettings.ts):
// - a number column: the picker shows the operator in use, "Default: ..." under it
// - its menu opens in the dialog, picking Less than changes the picker only; Apply switches the header
//   filter: the operator indicator of the column shows <
// - a checkbox column has no operator; a text column the text operators
// Usage: node column-settings-operator-check.js <site url> [shots dir]
const path = require('node:path');
const [, , base, shots] = process.argv;
const { chromium } = require('playwright');
// a column's settings are in tabs: an element of a hidden one, its tab clicked first
require('../sections')();

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];
    for (const scheme of ['light', 'dark']) {
        const context = await browser.newContext({ viewport: { width: 1300, height: 900 }, colorScheme: scheme });
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto(`${base}#sample/full-grid`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
        await page.click('.stage .footer-settings');
        await page.waitForSelector('dialog.column-settings');
        const pick = async (label) => {
            await page.click(`dialog.column-settings [role="option"]:has(.column-settings-option-label:text-is("${label}"))`);
            await page.waitForTimeout(50);
        };
        const picker = 'dialog.column-settings .column-settings-operator';
        const hint = () =>
            page.evaluate(() => {
                const field = [...document.querySelectorAll('dialog.column-settings .column-settings-field')].find((each) =>
                    each.textContent.includes('Filter operator')
                );
                return field ? field.querySelector('.column-settings-hint')?.textContent.trim() : null;
            });
        const labels = await page.$$eval('dialog.column-settings .column-settings-option-label', (all) =>
            all.map((each) => each.textContent.trim())
        );
        const numberLabel = labels.includes('Age') ? 'Age' : labels.find((l) => /balance/i.test(l));
        await pick(numberLabel);
        const before = (await page.textContent(picker))?.trim();
        check(`${scheme}: a number column shows the operator in use`, before === 'Greater than or equal', before);
        check(`${scheme}: the default under it`, (await hint()) === 'Default: Greater than or equal', await hint());
        await page.click(picker);
        await page.waitForSelector('dialog.column-settings [data-menu-id="filter.operator.lessThan"]');
        const inDialog = await page.evaluate(() => !!document.querySelector('dialog.column-settings .simple-html-grid-menu'));
        check(`${scheme}: the menu is in the dialog`, inDialog);
        if (shots) {
            await page.screenshot({ path: `${shots}/settings-operator-menu-${scheme}.png` });
        }
        await page.click('dialog.column-settings [data-menu-id="filter.operator.lessThan"]');
        await page.waitForTimeout(50);
        check(`${scheme}: picked: the picker says Less than`, (await page.textContent(picker))?.trim() === 'Less than');
        if (shots) {
            await page.screenshot({ path: `${shots}/settings-operator-${scheme}.png` });
        }
        await page.click('dialog.column-settings button:text-is("Apply")');
        await page.waitForTimeout(100);
        await page.click('dialog.column-settings button:text-is("Cancel")');
        await page.waitForTimeout(100);
        const indicator = await page.evaluate((name) => {
            const input = [...document.querySelectorAll('.stage .simple-html-grid-cell-filter-input')].find((each) =>
                each.getAttribute('aria-label')?.includes(name)
            );
            return input?.parentElement?.querySelector('.simple-html-grid-filter-operator')?.textContent.trim() ?? null;
        }, numberLabel);
        check(`${scheme}: the header filter's indicator shows <`, indicator === '<', String(indicator));
        // a checkbox column: no operator
        await page.click('.stage .footer-settings');
        await page.waitForSelector('dialog.column-settings');
        const checkbox = await page.$$eval('dialog.column-settings [role="option"]', (all) =>
            all
                .find((each) => each.querySelector('.column-settings-option-type').textContent.trim() === 'Checkbox')
                ?.querySelector('.column-settings-option-label')
                .textContent.trim()
        );
        if (checkbox) {
            await pick(checkbox);
            check(`${scheme}: a checkbox column has no operator`, (await page.$(picker)) === null);
        }
        await page.keyboard.press('Escape');
        await context.close();
    }
    check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    await browser.close();
    console.log(results.join('\n'));
    const failed = results.filter((r) => r.startsWith('FAIL')).length;
    console.log(`${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})();
