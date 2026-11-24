// Real browser check of the tabs of a column's settings in the grid config dialog (ColumnSection in
// columnSettings.ts, gridConfigTabs.ts tabList): General, Display, Header filter, Colours.
// - a number column of the full grid sample: the four tabs, General shown, the others hidden; each tab by a
//   click shows its settings and hides the others, the preview under every tab
// - the keys: Tab comes to the tab shown, ArrowRight / ArrowLeft / Home / End move and show, the focus on it
// - the height: every tab shorter than the whole form was (the sum of the tabs), the dialog in the window
// - a checkbox column: General and Colours only
// - a problem on Display (Show as link, no address): the mark on its tab while General is shown
// - a phone (390px): the tabs wrap, nothing wider than the dialog
// - light and dark screenshots
// Usage: node column-sections-check.js <site url> [screenshot dir]
const [, , base, shots] = process.argv;
const { chromium } = require('playwright');

const results = [];
const check = (name, ok, detail = '') =>
    results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${JSON.stringify(detail)})` : ''}`);
const grid = '.stage simple-html-grid';

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];

    const open = async ({ width, height, dark }) => {
        const page = await browser.newPage({ viewport: { width, height } });
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.addInitScript((d) => localStorage.setItem('simple-html-demo-theme', d ? 'dark' : 'light'), dark);
        await page.goto(`${base}#sample/full-grid`);
        await page.waitForSelector(`${grid} .simple-html-grid-col-cell`);
        await page.waitForTimeout(300);
        return page;
    };
    /** the number column with the most settings: a bar, a scale or icons */
    const numberField = (page) =>
        page.evaluate((g) => {
            const gi = document.querySelector(g).grid.gridInterface;
            const ds = gi.getDatasource();
            const fields = gi.getLayoutFields().map((f) => f.attribute ?? f);
            return fields.find((f) => ds.getField(f).type === 'number' && !gi.__getLookupColumn(f));
        }, grid);
    const state = (page) =>
        page.evaluate(() => {
            const d = document.querySelector('dialog.column-settings');
            const tabs = [...d.querySelectorAll('.column-settings-sections [role="tab"]')];
            const shown = [...d.querySelectorAll('.column-settings-section')].find((s) => !s.hidden);
            const rect = d.getBoundingClientRect();
            return {
                tabs: tabs.map((t) => `${t.textContent.replace(/\s+/g, ' ').trim()}:${t.getAttribute('aria-selected')}`),
                shownId: shown?.id ?? null,
                shownTab: shown ? document.getElementById(shown.getAttribute('aria-labelledby'))?.textContent.trim() : null,
                visibleSections: [...d.querySelectorAll('.column-settings-section')].filter((s) => s.offsetParent !== null)
                    .length,
                sectionHeight: shown ? Math.round(shown.getBoundingClientRect().height) : 0,
                previewShown: !!d.querySelector('.column-settings-preview-cell')?.offsetParent,
                focused:
                    document.activeElement?.getAttribute('role') === 'tab' ? document.activeElement.textContent.trim() : null,
                dialog: { top: Math.round(rect.top), bottom: Math.round(rect.bottom), right: Math.round(rect.right) },
                window: { width: innerWidth, height: innerHeight }
            };
        });
    const tab = (page, text) => page.locator('dialog.column-settings .column-settings-sections [role="tab"]', { hasText: text });

    for (const dark of [false, true]) {
        const theme = dark ? 'dark' : 'light';
        const page = await open({ width: 1300, height: 900, dark });
        const field = await numberField(page);
        await page.evaluate(([g, f]) => document.querySelector(g).grid.gridInterface.openColumnSettings(f), [grid, field]);
        await page.waitForTimeout(200);

        let s = await state(page);
        check(
            `${theme}: a number column (${field}): four tabs, General shown`,
            s.tabs.join() === 'General:true,Display:false,Header filter:false,Colours:false',
            s.tabs
        );
        check(
            `${theme}: one tab's settings visible, the preview under them`,
            s.visibleSections === 1 && s.shownTab === 'General' && s.previewShown,
            s
        );

        // the height of each tab, and the dialog in the window
        const heights = {};
        for (const name of ['General', 'Display', 'Header filter', 'Colours']) {
            await tab(page, name).click();
            await page.waitForTimeout(120);
            s = await state(page);
            heights[name] = s.sectionHeight;
            check(`${theme}: a click on ${name} shows it, the others hidden`, s.shownTab === name && s.visibleSections === 1, s);
            check(
                `${theme}: ${name}: the dialog in the window`,
                s.dialog.top >= 0 && s.dialog.bottom <= s.window.height,
                s.dialog
            );
            if (shots) {
                await page
                    .locator('dialog.column-settings')
                    .screenshot({ path: `${shots}/sections-${theme}-${name.replace(' ', '-').toLowerCase()}.png` });
            }
        }
        const sum = Object.values(heights).reduce((a, b) => a + b, 0);
        const tallest = Math.max(...Object.values(heights));
        check(`${theme}: the tallest tab is much shorter than the whole form was`, tallest < sum * 0.75, { heights, sum });

        // the keys: Tab from Add calculated column (after the list) comes to the tab shown
        await tab(page, 'General').click();
        await page.locator('dialog.column-settings .column-settings-calculated-add').focus();
        await page.keyboard.press('Tab');
        s = await state(page);
        check(`${theme}: Tab after the list of the columns comes to the tab shown`, s.focused === 'General', s.focused);
        await page.keyboard.press('ArrowRight');
        s = await state(page);
        check(`${theme}: ArrowRight shows Display, the focus on it`, s.focused === 'Display' && s.shownTab === 'Display', s);
        await page.keyboard.press('End');
        s = await state(page);
        check(`${theme}: End: Colours`, s.focused === 'Colours' && s.shownTab === 'Colours', s);
        await page.keyboard.press('ArrowRight');
        s = await state(page);
        check(`${theme}: ArrowRight on the last: General`, s.focused === 'General' && s.shownTab === 'General', s);
        await page.keyboard.press('Tab');
        const into = await page.evaluate(() => {
            const el = document.activeElement;
            return !!el.closest('.column-settings-section:not([hidden])');
        });
        check(`${theme}: Tab from the tab goes into its settings`, into);

        // a checkbox column
        const boolField = await page.evaluate((g) => {
            const gi = document.querySelector(g).grid.gridInterface;
            return gi
                .getLayoutFields()
                .map((f) => f.attribute ?? f)
                .find((f) => gi.getDatasource().getField(f).type === 'boolean');
        }, grid);
        if (boolField) {
            await page
                .locator('dialog.column-settings [role="option"]', {
                    has: page.locator(`xpath=self::*[@data-field="${boolField}"]`)
                })
                .click();
            await page.waitForTimeout(120);
            s = await state(page);
            check(
                `${theme}: a checkbox column (${boolField}): General and Colours`,
                s.tabs.join() === 'General:true,Colours:false',
                s.tabs
            );
        }

        // a problem on Display: a text column, Show as link with no address
        const textField = await page.evaluate((g) => {
            const gi = document.querySelector(g).grid.gridInterface;
            return gi
                .getLayoutFields()
                .map((f) => f.attribute ?? f)
                .find(
                    (f) =>
                        gi.getDatasource().getField(f).type === 'text' &&
                        !gi.__getLookupColumn(f) &&
                        !gi.getState().formats[f]?.link
                );
        }, grid);
        await page.locator(`dialog.column-settings [role="option"][data-field="${textField}"]`).click();
        await tab(page, 'Display').click();
        await page.locator('dialog.column-settings .column-settings-check', { hasText: 'Show as link' }).locator('input').click();
        await tab(page, 'General').click();
        await page.waitForTimeout(120);
        const mark = await page.evaluate(() => {
            const display = [...document.querySelectorAll('dialog.column-settings .column-settings-sections [role="tab"]')].find(
                (t) => t.textContent.includes('Display')
            );
            const dot = display?.querySelector('.column-settings-tab-problem');
            const r = dot?.getBoundingClientRect();
            return {
                text: display?.textContent.replace(/\s+/g, ' ').trim(),
                size: r ? [r.width, r.height] : null,
                color: dot ? getComputedStyle(dot).backgroundColor : null
            };
        });
        check(
            `${theme}: a problem on Display: a 6px mark on its tab, said "Error"`,
            mark.text === 'Display Error' && mark.size?.[0] === 6,
            mark
        );
        if (shots) {
            await page.locator('dialog.column-settings').screenshot({ path: `${shots}/sections-${theme}-problem.png` });
        }
        await page.close();
    }

    // a phone
    {
        const page = await open({ width: 390, height: 800, dark: false });
        const field = await numberField(page);
        await page.evaluate(([g, f]) => document.querySelector(g).grid.gridInterface.openColumnSettings(f), [grid, field]);
        await page.waitForTimeout(200);
        for (const name of ['General', 'Display', 'Header filter', 'Colours']) {
            await tab(page, name).click();
            await page.waitForTimeout(120);
            const wide = await page.evaluate(() => {
                const d = document.querySelector('dialog.column-settings').getBoundingClientRect();
                return [...document.querySelectorAll('dialog.column-settings .column-settings-panel *')]
                    .filter((e) => e.offsetParent !== null && e.getBoundingClientRect().right > d.right + 1)
                    .map((e) => e.className)
                    .slice(0, 3);
            });
            check(`phone: ${name}: nothing wider than the dialog`, wide.length === 0, wide);
        }
        const tabs = await page.evaluate(() =>
            [...document.querySelectorAll('dialog.column-settings .column-settings-sections [role="tab"]')].map((t) => {
                const r = t.getBoundingClientRect();
                return Math.round(r.right);
            })
        );
        const right = await page.evaluate(() =>
            Math.round(document.querySelector('dialog.column-settings').getBoundingClientRect().right)
        );
        check(
            'phone: the tabs in the dialog',
            tabs.every((r) => r <= right),
            { tabs, right }
        );
        if (shots) {
            await tab(page, 'General').click();
            await page.screenshot({ path: `${shots}/sections-phone.png` });
        }
        await page.close();
    }

    check('no page errors', errors.length === 0, errors);
    console.log(results.join('\n'));
    console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
    await browser.close();
    process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
})();
