// Real browser check of Multiline and Read only in the grid config dialog (columnSettings.ts editingSettings):
// the user - "for text we should also be able to set if its multiline or not, and readonly in edit mode".
// - Company: Read only checked, Apply: its cells' inputs are read only, typing does not change the value
// - City: Multiline checked, Apply: Enter on a cell opens the text editor (a textarea)
// - both back off, Apply: the format has neither
// Usage: node column-settings-edit-check.js <site url> [shots dir]
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
        const page = await browser.newPage({ viewport: { width: 1300, height: 900 }, colorScheme: scheme });
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto(`${base}#sample/full-grid`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
        const gi = 'document.querySelector(".stage simple-html-grid").grid.gridInterface';
        const formats = () => page.evaluate(`${gi}.getState().formats`);
        const toggleIn = async (label, text) => {
            await page.click(`dialog.column-settings [role="option"]:has(.column-settings-option-label:text-is("${label}"))`);
            await page.click(`dialog.column-settings .column-settings-check:has-text("${text}") input`);
        };
        await page.click('.stage .footer-settings');
        await page.waitForSelector('dialog.column-settings');
        await toggleIn('Company', 'Read only');
        await toggleIn('City', 'Multiline');
        if (shots) {
            await page.screenshot({ path: `${shots}/settings-edit-${scheme}.png` });
        }
        await page.click('dialog.column-settings button:text-is("Apply & close")');
        await page.waitForTimeout(150);
        const set = await formats();
        check(
            `${scheme}: Apply: the formats have them`,
            set.company?.readonly === true && set.city?.multiline === true,
            JSON.stringify({ company: set.company, city: set.city })
        );

        // Company: read only
        const company = page.locator('.stage input[data-attribute="company"]').nth(2);
        const before = await company.inputValue();
        await company.click();
        await page.keyboard.type('zz');
        await page.waitForTimeout(100);
        check(
            `${scheme}: Company read only: its input is read only, typing changes nothing`,
            (await company.evaluate((input) => input.readOnly)) && (await company.inputValue()) === before,
            `${before} -> ${await company.inputValue()}`
        );

        // City: multiline - Enter opens the text editor
        const city = page.locator('.stage input[data-attribute="city"]').nth(2);
        await city.click();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(200);
        const editor = await page.evaluate(
            () =>
                !!document.querySelector(
                    'textarea.simple-html-grid-text-editor, .simple-html-grid-text-editor textarea, textarea'
                )
        );
        check(`${scheme}: City multiline: Enter opens the text editor`, editor);
        await page.keyboard.press('Escape');

        // back off
        await page.click('.stage .footer-settings');
        await page.waitForSelector('dialog.column-settings');
        await toggleIn('Company', 'Read only');
        await toggleIn('City', 'Multiline');
        await page.click('dialog.column-settings button:text-is("Apply & close")');
        await page.waitForTimeout(150);
        const after = await formats();
        check(
            `${scheme}: unchecked again: neither in the format`,
            after.company?.readonly === undefined && after.city?.multiline === undefined,
            JSON.stringify({ company: after.company, city: after.city })
        );
        await page.close();
    }
    check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    await browser.close();
    console.log(results.join('\n'));
    const failed = results.filter((r) => r.startsWith('FAIL')).length;
    console.log(`${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})();
