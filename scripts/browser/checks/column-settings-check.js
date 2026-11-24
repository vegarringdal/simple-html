// (copied from the shared folder for the grid config dialog: the gear is named Grid config, the Columns tab
// is a stop of Tab between the ✕ and the list of the columns)
// Real browser check of the column settings dialog and the links of a text column (ColumnFormat.link /
// .text, the gear in the footer - GridConfig.settingsButton) on the "Full grid" sample (#sample/full-grid),
// in the four looks: default and TreDeSpace (data-grid-theme="tredespace" on the body), light and dark.
// The gear: where it is, its name, no overlap with the summary of the selected cells and the filter's row
// (also at 380px wide); the dialog: opened by the gear on the column of the focused cell, the focus in it,
// a date column (Format › in its picker, Week ISO), a number column (Norwegian), a text column (a template
// from other columns, Show as link, the address with a field put in with the { } menu, a javascript:
// address refused at once and Apply held back), the preview, Apply & close -> links in the cells, the focus
// back on the gear; a click on a link opens it (a popup for a new tab, intercepted), Ctrl+click too without
// a range, Shift+click no popup, Alt+Enter, a right click the row menu; editing a link cell still works (F2,
// a double click beside the text); a javascript: / data: value in the data is no link and runs nothing;
// getState() -> JSON -> resetState() -> setState() gives the links back; the header menu's Column
// settings… and Esc (focus back in the grid); the keyboard: Enter on the gear, Tab into the dialog, the
// arrows of the list; no rounded corners. Screenshots at 1300x1400.
// Usage: node column-settings-check.js <site url> [screenshot dir]
const path = require('node:path');
const fs = require('node:fs');
const [, , base, shots] = process.argv;
if (!base) {
    console.log('usage: node column-settings-check.js <site url> [screenshot dir]');
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

/** two rects overlap */
const overlap = (a, b) => !!a && !!b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

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
        const context = await browser.newContext({ viewport: { width: 1300, height: 1400 } });
        // the links go nowhere: every page off the site is answered here
        await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) =>
            route.fulfill({ status: 200, contentType: 'text/html', body: '<p>opened</p>' })
        );
        const page = await context.newPage();
        const alerts = [];
        page.on('dialog', async (dialog) => {
            alerts.push(dialog.message());
            await dialog.dismiss();
        });
        page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
        page.on('console', (m) => m.type() === 'error' && errors.push(`${name} console: ${m.text()}`));
        await page.addInitScript((l) => {
            localStorage.setItem('simple-html-demo-theme', l.theme);
            localStorage.setItem('simple-html-demo-grid-theme', l.grid);
        }, look);
        await page.goto(`${base}#sample/full-grid`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
        await page.waitForTimeout(400);
        const bodyTheme = await page.evaluate(() => document.body.getAttribute('data-grid-theme'));
        check(
            `${name}: the look is on`,
            look.grid === 'tredespace' ? bodyTheme === 'tredespace' : bodyTheme !== 'tredespace',
            bodyTheme
        );

        // the grid of the sample is taller than the window: its footer in view
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(100);
        const api = (fn, arg) => page.evaluate(fn, arg);
        const gearSel = '.stage .footer-settings';
        const dialogSel = 'dialog.column-settings';
        const rect = (selector) =>
            page.evaluate((s) => {
                const r = document.querySelector(s)?.getBoundingClientRect();
                return r
                    ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }
                    : null;
            }, selector);

        // ---- the gear
        const gear = await rect(gearSel);
        const footer = await rect('.stage .simple-html-grid-footer');
        check(
            `${name}: the gear at the right end of the footer, on its row`,
            gear && footer && footer.right - gear.right <= 6 && gear.top >= footer.top && gear.bottom <= footer.bottom,
            { gear, footer }
        );
        const gearInfo = await page.evaluate((s) => {
            const g = document.querySelector(s);
            return {
                label: g.getAttribute('aria-label'),
                title: g.getAttribute('title'),
                tag: g.tagName,
                radius: getComputedStyle(g).borderRadius
            };
        }, gearSel);
        check(
            `${name}: the gear is a button named Grid config, square`,
            gearInfo.tag === 'BUTTON' &&
                gearInfo.label === 'Grid config' &&
                gearInfo.title === 'Grid config' &&
                gearInfo.radius === '0px',
            gearInfo
        );
        // a range of numbers: the summary of the selected cells
        await api(() => {
            const gi = document.querySelector('.stage simple-html-grid').grid.gridInterface;
            gi.setRanges([{ fromRow: 0, fromField: 'age', toRow: 4, toField: 'credit' }]);
        });
        await page.waitForTimeout(200);
        const summary = await rect('.stage .footer-summary');
        const gearNow = await rect(gearSel);
        check(`${name}: the summary shown, left of the gear`, !!summary && summary.right <= gearNow.left, {
            summary,
            gear: gearNow
        });
        if (shots && look.grid === 'default') {
            const f = await rect('.stage .simple-html-grid-footer');
            await page.screenshot({
                path: `${shots}/column-settings-footer-${name}.png`,
                clip: { x: Math.max(0, f.right - 650), y: f.top - 40, width: 650, height: f.height + 40 }
            });
        }

        // 380px wide: the gear, the summary and the filter's row do not overlap, with and without a filter
        await api(() => {
            const el = document.querySelector('.stage simple-html-grid');
            el.dataset.oldWidth = el.style.width;
            el.style.width = '380px';
            el.grid.gridInterface.rebuild();
        });
        await page.waitForTimeout(300);
        for (const filtered of [false, true]) {
            if (filtered) {
                await api(() => {
                    const gi = document.querySelector('.stage simple-html-grid').grid.gridInterface;
                    gi.getDatasource().filter({
                        group: 'AND',
                        children: [
                            { field: 'age', operator: 'GREATER_THAN', value: 30 },
                            { field: 'company', operator: 'CONTAINS', value: 'a' }
                        ]
                    });
                    gi.setRanges([{ fromRow: 0, fromField: 'age', toRow: 3, toField: 'credit' }]);
                });
                await page.waitForTimeout(300);
            } else {
                await api(() => {
                    const gi = document.querySelector('.stage simple-html-grid').grid.gridInterface;
                    gi.setRanges([{ fromRow: 0, fromField: 'age', toRow: 3, toField: 'credit' }]);
                });
                await page.waitForTimeout(200);
            }
            const g = await rect(gearSel);
            const s = await rect('.stage .footer-summary');
            const row = await rect('.stage .footer-filter');
            const visibleGear = await page.evaluate((sel) => {
                const r = document.querySelector(sel).getBoundingClientRect();
                const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
                return !!hit?.closest('.footer-settings');
            }, gearSel);
            check(
                `${name}: 380px ${filtered ? 'with a filter' : 'without'}: the gear on top, no overlap with the summary and the filter's row`,
                visibleGear && !overlap(g, s) && !overlap(g, row) && !overlap(s, row),
                { g, s, row }
            );
            if (shots && look.grid === 'default') {
                const f = await rect('.stage .simple-html-grid-footer');
                await page.screenshot({
                    path: `${shots}/column-settings-footer-380-${filtered ? 'filter' : 'nofilter'}-${name}.png`,
                    clip: { x: f.left, y: f.top - 30, width: f.width, height: f.height + 30 }
                });
            }
        }
        await api(() => {
            const el = document.querySelector('.stage simple-html-grid');
            el.style.width = el.dataset.oldWidth;
            el.grid.gridInterface.getDatasource().filter(null);
            el.grid.gridInterface.clearRanges();
            el.grid.gridInterface.rebuild();
        });
        await page.waitForTimeout(300);

        // ---- the dialog, from the gear on the column of the focused cell. The sample's city has a template
        // in the config: taken away first, the dialog makes it again, with a link
        await api(() => {
            const gi = document.querySelector('.stage simple-html-grid').grid.gridInterface;
            const formats = gi.getState().formats;
            delete formats.city;
            gi.setState({ formats });
        });
        await page.locator('.stage input[data-attribute="balance"]').first().click();
        await page.locator(gearSel).click();
        await page.waitForSelector(dialogSel);
        await page.waitForTimeout(150);
        const heading = () =>
            page.evaluate(() => document.querySelector('.column-settings-heading')?.textContent.replace(/\s+/g, ' ').trim());
        check(
            `${name}: the gear opens the dialog on the focused cell's column`,
            (await heading()) === 'Balance Number',
            await heading()
        );
        const opened = await page.evaluate(() => ({
            modal: document.querySelector('dialog.column-settings').matches(':modal'),
            focus: document.activeElement === document.querySelector('dialog.column-settings')
        }));
        check(`${name}: a modal dialog, the focus in it`, opened.modal && opened.focus, opened);
        const radius = await page.evaluate(() =>
            [...document.querySelectorAll('dialog.column-settings, dialog.column-settings *')]
                .filter((e) => !(e instanceof HTMLInputElement && e.type === 'checkbox'))
                .map((e) => getComputedStyle(e).borderRadius)
                .filter((r) => r !== '0px')
        );
        check(`${name}: no rounded corners in the dialog`, radius.length === 0, radius.slice(0, 3));

        const pick = async (field) => {
            await page.locator(`${dialogSel} [role="option"][data-field="${field}"]`).click();
            await page.waitForTimeout(80);
        };
        const preview = () => page.evaluate(() => document.querySelector('.column-settings-preview-cell')?.textContent.trim());

        // a number column: Norwegian in its picker
        await page.locator(`${dialogSel} .column-settings-format`).click();
        await page.locator(`${dialogSel} [data-menu-id="header.format.number.norwegian"]`).click();
        check(`${name}: number: Norwegian in the preview`, /^\d{1,3}( \d{3})*,\d+$/.test(await preview()), await preview());

        // a date column: Format › entries, Week ISO
        await pick('orderDate');
        await page.locator(`${dialogSel} .column-settings-format`).click();
        await page.waitForTimeout(120);
        if (shots) {
            await page.screenshot({ path: `${shots}/column-settings-date-menu-${name}.png`, fullPage: true });
        }
        await page.locator(`${dialogSel} [data-menu-id="header.format.date.weekIso"]`).click();
        check(`${name}: date: Week ISO in the preview`, /^\d{4}-W\d{2}$/.test(await preview()), await preview());

        // a text column: city - a template of other columns, a link with a field put in from the menu
        await pick('city');
        await page.locator(`${dialogSel} input[id$="-settings-text"]`).fill('{city} in {countryCode}');
        check(
            `${name}: text: the template of two columns in the preview`,
            / in [A-Z]{2}$/.test(await preview()),
            await preview()
        );
        await page.locator(`${dialogSel} .column-settings-check`, { hasText: 'Show as link' }).click();
        const url = page.locator(`${dialogSel} input[id$="-settings-url"]`);
        await url.fill('javascript:alert(1)');
        const refused = await page.evaluate(() => ({
            problems: [...document.querySelectorAll('.column-settings-problem')].map((p) => p.textContent.trim()),
            apply: document
                .querySelector('dialog.column-settings .simple-html-grid-button-primary')
                .getAttribute('aria-disabled'),
            invalid: document.querySelector('input[id$="-settings-url"]').getAttribute('aria-invalid')
        }));
        check(
            `${name}: a javascript: address refused at once, Apply held back`,
            refused.problems.some((p) => p.startsWith('Not a link')) && refused.apply === 'true' && refused.invalid === 'true',
            refused
        );
        if (shots) {
            await page.screenshot({ path: `${shots}/column-settings-problem-${name}.png`, fullPage: true });
        }
        await url.fill('https://www.openstreetmap.org/search?query=');
        await url.press('End');
        await page.locator(`${dialogSel} input[id$="-settings-url"] + .column-settings-insert`).click();
        await page.locator(`${dialogSel} .simple-html-grid-menu-search`).fill('cit');
        await page.locator(`${dialogSel} [data-menu-id="filterEditor.field.city"]`).click();
        const urlValue = await url.inputValue();
        check(
            `${name}: the field put in from the { } menu at the caret`,
            urlValue === 'https://www.openstreetmap.org/search?query={city}',
            urlValue
        );
        const previewLink = await page.evaluate(() => {
            const a = document.querySelector('.column-settings-preview-cell a');
            return a
                ? {
                      href: a.getAttribute('href'),
                      target: a.target,
                      rel: a.rel,
                      text: a.textContent.trim(),
                      address: document.querySelector('.column-settings-preview-address')?.textContent.trim()
                  }
                : null;
        });
        check(
            `${name}: the preview a link, in a new tab, its address under it`,
            previewLink &&
                previewLink.href.startsWith('https://www.openstreetmap.org/search?query=') &&
                previewLink.target === '_blank' &&
                previewLink.rel === 'noopener noreferrer' &&
                previewLink.address === previewLink.href,
            previewLink
        );
        if (shots) {
            await page.screenshot({ path: `${shots}/column-settings-text-${name}.png`, fullPage: true });
        }
        // Apply & close: the focus back on the gear
        await page.locator(`${dialogSel} .simple-html-grid-button-primary`).click();
        await page.waitForTimeout(200);
        const closed = await page.evaluate(() => ({
            gone: !document.querySelector('dialog.column-settings'),
            focus: document.activeElement?.className
        }));
        check(
            `${name}: Apply & close: gone, the focus back on the gear`,
            closed.gone && closed.focus === 'footer-settings',
            closed
        );

        // ---- the links in the cells
        const cityLink = await page.evaluate(() => {
            const a = document.querySelector(
                '.stage .simple-html-grid-cell-custom[data-attribute="city"] a.simple-html-grid-cell-link'
            );
            return a
                ? {
                      href: a.getAttribute('href'),
                      text: a.textContent,
                      target: a.target,
                      deco: getComputedStyle(a).textDecorationLine
                  }
                : null;
        });
        check(
            `${name}: the city cells are links with the template's text`,
            cityLink &&
                / in [A-Z]{2}$/.test(cityLink.text) &&
                cityLink.href.startsWith('https://www.openstreetmap.org/search?query=') &&
                cityLink.target === '_blank' &&
                cityLink.deco === 'underline',
            cityLink
        );
        const state = await api(() => document.querySelector('.stage simple-html-grid').grid.gridInterface.getState().formats);
        check(
            `${name}: the state has the formats of the dialog`,
            state.city?.link?.newTab === true && state.orderDate?.date === 'weekIso' && state.balance?.number?.decimal === ',',
            state.city
        );
        if (shots) {
            await page.screenshot({ path: `${shots}/column-settings-links-${name}.png`, fullPage: true });
        }

        // a click on the text: a popup (new tab)
        const cityLinks = page.locator(
            '.stage .simple-html-grid-cell-custom[data-attribute="city"] a.simple-html-grid-cell-link'
        );
        const expected = await cityLinks.first().getAttribute('href');
        let popup = context.waitForEvent('page', { timeout: 3000 }).catch(() => null);
        await cityLinks.first().click();
        let tab = await popup;
        check(`${name}: a click on the text opens it in a new tab`, !!tab && tab.url() === expected, tab?.url());
        await tab?.close();
        // Ctrl+click: a tab too, no range
        popup = context.waitForEvent('page', { timeout: 3000 }).catch(() => null);
        await cityLinks.nth(1).click({ modifiers: ['Control'] });
        tab = await popup;
        const ranges = await api(() => document.querySelector('.stage simple-html-grid').grid.gridInterface.getRanges().length);
        check(`${name}: Ctrl+click opens it, no range`, !!tab && ranges === 0, { url: tab?.url(), ranges });
        await tab?.close();
        // Shift+click: no tab
        popup = context.waitForEvent('page', { timeout: 1200 }).catch(() => null);
        await cityLinks.nth(2).click({ modifiers: ['Shift'] });
        tab = await popup;
        check(`${name}: Shift+click opens nothing`, !tab, tab?.url());
        await tab?.close();
        await page.keyboard.press('Escape');

        // the cell: a press beside the text focuses it, Alt+Enter opens the link, F2 edits the value
        const hosts = page.locator('.stage .simple-html-grid-cell-custom[data-attribute="city"]');
        const box = await hosts.nth(1).boundingBox();
        await page.mouse.click(box.x + box.width - 3, box.y + box.height / 2);
        const focusedHost = await page.evaluate(() => document.activeElement?.classList.contains('simple-html-grid-cell-custom'));
        check(`${name}: a press beside the text focuses the cell`, focusedHost);
        popup = context.waitForEvent('page', { timeout: 3000 }).catch(() => null);
        await page.keyboard.press('Alt+Enter');
        tab = await popup;
        check(`${name}: Alt+Enter opens the link`, !!tab, tab?.url());
        await tab?.close();
        await page.bringToFront();
        await hosts.nth(1).focus();
        const value = await api(() => {
            const host = [...document.querySelectorAll('.stage .simple-html-grid-cell-custom[data-attribute="city"]')][1];
            const row = host.closest('.simple-html-grid-col-cell').$row;
            return document.querySelector('.stage simple-html-grid').grid.gridInterface.getDatasource().getRows()[row].city;
        });
        await page.keyboard.press('F2');
        await page.waitForTimeout(100);
        const editor = await page.evaluate(() => document.querySelector('.simple-html-grid-text-editor input')?.value);
        check(`${name}: F2 edits the value, not the template`, editor === value, { editor, value });
        await page.keyboard.press('End');
        await page.keyboard.type('X');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
        const edited = await hosts.nth(1).locator('a').textContent();
        check(`${name}: the edit saved, the link shows it`, edited.startsWith(`${value}X in `), edited);
        await page.mouse.dblclick(box.x + box.width - 3, box.y + box.height / 2);
        await page.waitForTimeout(100);
        const dbl = await page.evaluate(() => !!document.querySelector('.simple-html-grid-text-editor input'));
        check(`${name}: a double click beside the text edits`, dbl);
        await page.keyboard.press('Escape');
        // a right click on the text: the row menu
        await cityLinks.first().click({ button: 'right' });
        await page.waitForTimeout(100);
        const rowMenu = await page.evaluate(() => !!document.querySelector('[data-menu-id="row.copy"]'));
        check(`${name}: a right click on the text opens the row menu`, rowMenu);
        await page.keyboard.press('Escape');

        // hostile values in the data: company as a whole address
        await api(() => {
            const gi = document.querySelector('.stage simple-html-grid').grid.gridInterface;
            gi.setState({ formats: { ...gi.getState().formats, company: { link: { url: '{company}' } } } });
            const rows = gi.getDatasource().getRows();
            rows[0].company = 'javascript:alert(1)';
            rows[1].company = 'data:text/html,<script>alert(1)</script>';
            rows[2].company = 'https://ok.example/';
            rows[3].company = 'java\nscript:alert(1)';
        });
        await page.waitForTimeout(200);
        const hostile = await page.evaluate(() => {
            const gi = document.querySelector('.stage simple-html-grid').grid.gridInterface;
            const byRow = new Map(
                [...document.querySelectorAll('.stage .simple-html-grid-cell-custom[data-attribute="company"]')].map((host) => [
                    host.closest('.simple-html-grid-col-cell').$row,
                    host.querySelector('a')
                ])
            );
            return [0, 1, 2, 3].map((row) => ({
                href: byRow.get(row)?.getAttribute('href') ?? null,
                text: byRow.get(row)?.textContent,
                value: gi.getDatasource().getRows()[row].company.slice(0, 12)
            }));
        });
        check(
            `${name}: javascript:, data: in the data are no links, https is`,
            hostile[0].href === null &&
                hostile[1].href === null &&
                hostile[2].href === 'https://ok.example/' &&
                hostile[3].href === null,
            hostile
        );
        const companyLinks = page.locator('.stage .simple-html-grid-cell-custom[data-attribute="company"] a');
        await companyLinks.first().click();
        await page.waitForTimeout(200);
        check(`${name}: a click on a javascript: value runs nothing`, alerts.length === 0 && page.url().startsWith(base), {
            alerts,
            url: page.url()
        });

        // the state through JSON
        const kept = await api(() => {
            const gi = document.querySelector('.stage simple-html-grid').grid.gridInterface;
            const saved = JSON.stringify(gi.getState());
            gi.resetState();
            const cityLink = () => document.querySelector('.stage .simple-html-grid-cell-custom[data-attribute="city"] a');
            const resetLink = !!cityLink();
            const resetInput = document.querySelector('.stage input[data-attribute="city"]')?.value;
            gi.setState(JSON.parse(saved));
            return { resetLink, resetInput, back: cityLink()?.textContent };
        });
        // the config's city is a template, {city} ({countryCode}), no link; the dialog's a link, {city} in {countryCode}
        check(
            `${name}: resetState() goes back to the config (a template, no link), setState(JSON) to the dialog's link`,
            !kept.resetLink && / \([A-Z]{2}\)$/.test(kept.resetInput) && / in [A-Z]{2}$/.test(kept.back),
            kept
        );

        // the header menu's Column settings…, then Esc: the focus back in the grid
        await page.locator('.stage [data-attribute-header="company"]').first().click({ button: 'right' });
        await page.locator('[data-menu-id="header.settings"]').click();
        await page.waitForSelector(dialogSel);
        check(
            `${name}: Column settings… in the header menu opens it on the column`,
            (await heading()) === 'Company Text',
            await heading()
        );
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);
        const afterEsc = await page.evaluate(() => ({
            gone: !document.querySelector('dialog.column-settings'),
            inGrid: !!document.activeElement?.closest('.stage simple-html-grid')
        }));
        check(`${name}: Esc closes it, the focus back in the grid`, afterEsc.gone && afterEsc.inGrid, afterEsc);

        // the keyboard: Enter on the gear, Tab into the dialog, the arrows of the list
        await page.locator(gearSel).focus();
        await page.keyboard.press('Enter');
        await page.waitForSelector(dialogSel);
        await page.keyboard.press('Tab');
        const first = await page.evaluate(() => document.activeElement?.className);
        // the grid config dialog: the tab shown (Columns) is a stop between the ✕ and the list
        await page.keyboard.press('Tab');
        const tabStop = await page.evaluate(
            () => `${document.activeElement?.getAttribute('role')}:${document.activeElement?.textContent.trim()}`
        );
        await page.keyboard.press('Tab');
        const second = await page.evaluate(() => document.activeElement?.getAttribute('role'));
        const before = await heading();
        await page.keyboard.press('ArrowDown');
        const after = await heading();
        check(
            `${name}: Tab: the ✕, the Columns tab, then the list; ArrowDown picks the next column`,
            first === 'filter-editor-close' && tabStop === 'tab:Columns' && second === 'listbox' && before !== after,
            {
                first,
                tabStop,
                second,
                before,
                after
            }
        );
        const outline = await page.evaluate(
            () => getComputedStyle(document.querySelector('.column-settings-option[aria-selected="true"]')).outlineStyle
        );
        check(`${name}: the picked column has the focus outline`, outline === 'solid', outline);
        if (shots) {
            await page.screenshot({ path: `${shots}/column-settings-keyboard-${name}.png`, fullPage: true });
        }
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
        const backOnGear = await page.evaluate(() => document.activeElement?.className);
        check(`${name}: Esc: the focus back on the gear`, backOnGear === 'footer-settings', backOnGear);

        // a link in this tab: the page goes there (last, it leaves the page)
        await api(() => {
            const gi = document.querySelector('.stage simple-html-grid').grid.gridInterface;
            gi.setState({ formats: { ...gi.getState().formats, city: { link: { url: 'https://same.example/{city}' } } } });
        });
        await page.waitForTimeout(150);
        const sameLink = page.locator('.stage .simple-html-grid-cell-custom[data-attribute="city"] a').first();
        const sameHref = await sameLink.getAttribute('href');
        await Promise.all([page.waitForURL(sameHref, { timeout: 4000 }).catch(() => null), sameLink.click()]);
        check(`${name}: a link without newTab opens in the page`, page.url() === sameHref, { url: page.url(), sameHref });
        await context.close();
    }
    await browser.close();
    for (const line of results) {
        console.log(line);
    }
    const failed = results.filter((line) => line.startsWith('FAIL')).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    if (errors.length) {
        console.log('page errors:');
        for (const e of errors) {
            console.log(`  ${e}`);
        }
    }
    process.exit(failed || errors.length ? 1 : 0);
})();
