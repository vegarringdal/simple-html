// Real browser check of the grid config dialog on small screens (#sample/views): a laptop of 1366x768 at
// 150 % zoom (some 910x425 css pixels for the page) and one of 1280x720 at 150 % (853x400), and a phone:
// - every tab fits: the dialog in the window, its footer's Apply & close on screen, nothing wider than its
//   body (no sideways scroll)
// - side by side (the laptops): the list of the columns stays in view while the settings scroll
// - the colour rules: one open, the others one line each; a new rule open, the one before closed
// - the phone: the list or a column's settings, never both - a column clicked shows its settings, ‹ Columns
//   the list, Enter in the list its settings again
// Usage: node dialog-small-screens-check.js <site url> [screenshot dir]
const [, , base, shots] = process.argv;
if (!base) {
    console.log('usage: node dialog-small-screens-check.js <site url> [screenshot dir]');
    process.exit(2);
}
const { chromium, devices } = require('playwright');
if (shots) {
    require('node:fs').mkdirSync(shots, { recursive: true });
}

const results = [];
const check = (name, ok, detail = '') =>
    results.push(
        `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : ''}`
    );
const dialog = 'dialog.column-settings';

/** the dialog's box, the window's, the footer's last button, the shown body's widths */
const measure = (page) =>
    page.$eval(dialog, (d) => {
        const box = d.getBoundingClientRect();
        const apply = [...d.querySelectorAll('.filter-editor-footer button')].pop().getBoundingClientRect();
        const body = d.querySelector('.filter-editor-body:not([hidden])');
        return {
            inWindow: box.left >= 0 && box.top >= 0 && box.right <= innerWidth + 0.5 && box.bottom <= innerHeight + 0.5,
            applyShown: apply.bottom <= innerHeight + 0.5 && apply.right <= innerWidth + 0.5 && apply.top >= 0,
            sideways: body.scrollWidth - body.clientWidth
        };
    });

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];
    const screens = [
        ['laptop 1366x768 at 150 %', { viewport: { width: 910, height: 425 }, deviceScaleFactor: 1.5 }],
        ['laptop 1280x720 at 150 %', { viewport: { width: 853, height: 400 }, deviceScaleFactor: 1.5 }],
        ['phone', { ...devices['Pixel 7'] }]
    ];
    try {
        for (const [name, options] of screens) {
            const phone = name === 'phone';
            const context = await browser.newContext(options);
            const page = await context.newPage();
            page.on('pageerror', (e) => errors.push(String(e)));
            await page.addInitScript(() => localStorage.setItem('simple-html-demo-theme', 'light'));
            await page.goto(`${base}#sample/views`);
            await page.waitForSelector('.stage simple-html-grid .footer-settings');
            await page.click('.stage simple-html-grid .footer-settings');
            await page.waitForSelector(dialog);

            const shown = (selector) =>
                page.$eval(
                    `${dialog} ${selector}`,
                    (el) => el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none'
                );
            if (phone) {
                check(
                    `${name}: the list first, no settings beside or under it`,
                    (await shown('.column-settings-columns')) && !(await shown('.column-settings-panel'))
                );
                await page.click(`${dialog} [role="option"][data-field="balance"]`);
                check(
                    `${name}: a column clicked: its settings, the list gone, ‹ Columns`,
                    (await shown('.column-settings-panel')) &&
                        !(await shown('.column-settings-columns')) &&
                        (await shown('.column-settings-back'))
                );
                await page.click(`${dialog} .column-settings-back`);
                const back = (await shown('.column-settings-columns')) && !(await shown('.column-settings-panel'));
                const focus = await page.evaluate(() => document.activeElement?.classList.contains('column-settings-list'));
                check(`${name}: ‹ Columns: the list again, the focus in it`, back && focus);
                await page.keyboard.press('Enter');
                check(`${name}: Enter in the list: the settings of its column`, await shown('.column-settings-panel'));
            } else {
                check(
                    `${name}: side by side, no ‹ Columns`,
                    (await shown('.column-settings-columns')) &&
                        (await shown('.column-settings-panel')) &&
                        !(await shown('.column-settings-back'))
                );
                await page.click(`${dialog} [role="option"][data-field="balance"]`);
            }

            // every tab of the column, the Detail form and Defaults tabs: in the window, nothing sideways
            const sections = await page.$$eval(`${dialog} .column-settings-sections [role="tab"]`, (tabs) =>
                tabs.map((tab) => tab.id)
            );
            const bad = [];
            for (const id of sections) {
                await page.click(`#${id}`);
                const m = await measure(page);
                if (!m.inWindow || !m.applyShown || m.sideways > 1) {
                    bad.push({ id: id.replace(/^.*-section-/, ''), ...m });
                }
            }
            for (const tab of ['detailForm', 'defaults', 'columns']) {
                await page.click(`${dialog} [role="tab"][id$="-settings-tab-${tab}"]`);
                const m = await measure(page);
                if (!m.inWindow || !m.applyShown || m.sideways > 1) {
                    bad.push({ tab, ...m });
                }
            }
            check(`${name}: every tab in the window, Apply & close on screen, nothing sideways`, bad.length === 0, bad);

            // the colour rules: three added - the last open, the two before one line each
            if (phone && !(await shown('.column-settings-panel'))) {
                await page.click(`${dialog} [role="option"][data-field="balance"]`);
            }
            await page.click(`${dialog} .column-settings-sections [role="tab"]:has-text("Colours")`);
            for (let index = 0; index < 3; index++) {
                await page.click(`${dialog} .column-settings-rules-add`);
            }
            const rules = await page.$$eval(`${dialog} .column-settings-rule`, (els) =>
                els.map((el) => ({
                    closed: el.classList.contains('column-settings-rule-closed'),
                    height: Math.round(el.getBoundingClientRect().height)
                }))
            );
            check(
                `${name}: three rules: the new one open, the others one line (under 48px)`,
                rules.length === 3 &&
                    !rules[2].closed &&
                    rules[0].closed &&
                    rules[1].closed &&
                    rules[0].height < 48 &&
                    rules[1].height < 48,
                rules
            );
            await page.click(`${dialog} [data-rule="0"] .column-settings-rule-toggle`);
            const toggled = await page.$$eval(`${dialog} .column-settings-rule`, (els) =>
                els.map((el) => el.classList.contains('column-settings-rule-closed'))
            );
            check(
                `${name}: a closed rule clicked opens, the open one closes`,
                JSON.stringify(toggled) === '[false,true,true]',
                toggled
            );

            if (!phone) {
                // the settings scrolled to the end: the list still in view
                const sticky = await page.$eval(dialog, (d) => {
                    const body = d.querySelector('.filter-editor-body:not([hidden])');
                    body.scrollTop = body.scrollHeight;
                    const list = d.querySelector('.column-settings-list').getBoundingClientRect();
                    const frame = body.getBoundingClientRect();
                    return {
                        scrolled: body.scrollTop,
                        listTop: Math.round(list.top - frame.top),
                        listBottom: Math.round(frame.bottom - list.bottom)
                    };
                });
                check(
                    `${name}: the settings scrolled, the list of the columns still in view`,
                    sticky.scrolled > 0 && sticky.listTop >= -1 && sticky.listBottom >= -1,
                    sticky
                );
            }
            if (shots) {
                await page.screenshot({ path: `${shots}/dialog-small-${name.replace(/\W+/g, '-')}.png` });
            }
            await context.close();
        }
    } catch (error) {
        check('the run', false, String(error?.stack ?? error));
    }
    check('no page errors', errors.length === 0, errors);
    await browser.close();
    console.log(results.join('\n'));
    const failed = results.filter((line) => line.startsWith('FAIL')).length;
    console.log(`\n${results.length - failed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
})();
