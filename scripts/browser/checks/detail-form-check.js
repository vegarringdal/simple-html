// Real browser check of the detail form (GridConfig.detailForm, detailForm.ts) and the grid config
// dialog's tabs (gridConfigTabs.ts, detailFormSettings.ts) on the "Full grid" sample (#sample/full-grid)
// and the "Detail form" sample (#sample/detail-form), in the looks default and TreDeSpace, light and dark.
//
// The gear -> the dialog titled Grid config, its tabs (a click, ArrowLeft / ArrowRight, Home / End, the
// focus on the tab), the Detail form tab: Show the detail form, three fields picked in a chosen order (a
// multiline one, moved to the top with Alt+ArrowUp), Apply & close -> the panel at the right with the
// current row, the labels in that order; a click on a row and Alt+ArrowDown move the form along; a row with
// notes of three lines: the textarea shows all of it; the rows still scroll sideways, the pinned right
// columns and the scrollbars end where the form starts, the footer as wide as the grid; typing in the form
// edits the row (the cell follows), Ctrl+Z undoes; getState() -> JSON -> resetState() -> setState() gives
// it back; the window made narrower and wider; a phone (390px): the form under the rows; no rounded
// corners. Screenshots of each look.
//
// Usage: node detail-form-check.js <site url> [screenshot dir]
const path = require('node:path');
const fs = require('node:fs');
const [, , base, shots] = process.argv;
if (!base) {
    console.log('usage: node detail-form-check.js <site url> [screenshot dir]');
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

const GRID = '.stage simple-html-grid';

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
        const full = look.grid === 'default' && look.theme === 'light';
        const context = await browser.newContext({ viewport: { width: 1300, height: 1000 } });
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
        page.on('console', (m) => m.type() === 'error' && errors.push(`${name} console: ${m.text()}`));
        await page.addInitScript((l) => {
            localStorage.setItem('simple-html-demo-theme', l.theme);
            localStorage.setItem('simple-html-demo-grid-theme', l.grid);
        }, look);
        await page.goto(`${base}#sample/full-grid`);
        await page.waitForSelector(`${GRID} .simple-html-grid-col-cell`);
        await page.waitForTimeout(400);

        const api = (fn, arg) => page.evaluate(fn, arg);
        const rect = (selector) =>
            page.evaluate((s) => {
                const r = document.querySelector(s)?.getBoundingClientRect();
                return r
                    ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }
                    : null;
            }, selector);
        const formSel = `${GRID} .simple-html-grid-detail-form`;
        const formInfo = () =>
            page.evaluate((s) => {
                const form = document.querySelector(s);
                return {
                    hidden: form.hidden,
                    row: form.querySelector('.simple-html-grid-detail-form-row')?.textContent.trim() ?? null,
                    empty: form.querySelector('.simple-html-grid-detail-form-empty')?.textContent.trim() ?? null,
                    fields: [...form.querySelectorAll('.simple-html-grid-detail-form-field')].map((f) => {
                        const c = f.querySelector('input, textarea');
                        return {
                            field: f.dataset.field,
                            label: f.querySelector('label').textContent.trim(),
                            tag: c.tagName,
                            value: c.type === 'checkbox' ? c.checked : c.value
                        };
                    })
                };
            }, formSel);

        // the grid of the sample can be taller than the window: its footer in view
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(100);

        // ---- the dialog: the gear, the title, the tabs
        await page.locator(`${GRID} .footer-settings`).click();
        await page.waitForSelector('dialog.column-settings');
        const dialog = await page.evaluate(() => {
            const d = document.querySelector('dialog.column-settings');
            return {
                title: document.getElementById(d.getAttribute('aria-labelledby'))?.textContent.trim(),
                tabs: [...d.querySelectorAll(':scope > [role="tablist"] [role="tab"]')].map(
                    (t) => `${t.textContent.trim()}:${t.getAttribute('aria-selected')}`
                ),
                gear: document.querySelector('.stage .footer-settings').getAttribute('aria-label')
            };
        });
        check(
            `${name}: the gear and the dialog say Grid config`,
            dialog.title === 'Grid config' && dialog.gear === 'Grid config',
            dialog
        );
        check(`${name}: two tabs, Columns shown`, dialog.tabs.join() === 'Columns:true,Detail form:false', dialog.tabs);
        if (shots) {
            await page.screenshot({ path: `${shots}/dialog-columns-${name}.png` });
        }

        const selectedTab = () =>
            page.evaluate(() => {
                const tab = document.querySelector('dialog.column-settings [role="tab"][aria-selected="true"]');
                return { text: tab.textContent.trim(), focused: document.activeElement === tab };
            });
        await page.locator('dialog.column-settings [role="tab"]', { hasText: 'Detail form' }).click();
        let tab = await selectedTab();
        check(`${name}: a click shows the Detail form tab`, tab.text === 'Detail form', tab);
        await page.keyboard.press('ArrowLeft');
        tab = await selectedTab();
        check(`${name}: ArrowLeft shows Columns, the focus on it`, tab.text === 'Columns' && tab.focused, tab);
        await page.keyboard.press('ArrowRight');
        tab = await selectedTab();
        check(`${name}: ArrowRight shows Detail form, the focus on it`, tab.text === 'Detail form' && tab.focused, tab);
        await page.keyboard.press('Home');
        await page.keyboard.press('End');
        tab = await selectedTab();
        check(`${name}: Home / End`, tab.text === 'Detail form' && tab.focused, tab);
        const panels = await page.evaluate(() =>
            [...document.querySelectorAll('dialog.column-settings > [role="tabpanel"]')].map(
                (p) => `${p.className.split(' ')[1]}:${p.hidden}`
            )
        );
        check(
            `${name}: the Columns panel hidden, the Detail form one shown`,
            panels.join() === 'column-settings-body:true,detail-form-settings:false',
            panels
        );

        // ---- pick three fields: notes (several lines) to the top with Alt+ArrowUp, company, orderDate
        await page.locator('dialog.column-settings .detail-form-settings-show').check();
        const option = (field) => page.locator(`dialog.column-settings .detail-form-settings-option[data-field="${field}"]`);
        await option('notes').locator('.column-settings-option-label').click();
        await page.keyboard.press('Space');
        for (let i = 0; i < 40; i++) {
            await page.keyboard.press('Alt+ArrowUp');
        }
        await option('company').locator('.detail-form-settings-box').click();
        await option('orderDate').locator('.detail-form-settings-box').click();
        const listed = await page.evaluate(() =>
            [...document.querySelectorAll('dialog.column-settings .detail-form-settings-option')]
                .filter((o) => o.getAttribute('aria-checked') === 'true')
                .map((o) => o.dataset.field)
        );
        check(
            `${name}: notes first (Alt+ArrowUp), then company and orderDate checked`,
            listed.join() === 'notes,company,orderDate',
            listed
        );
        const firstOption = await page.evaluate(
            () => document.querySelector('dialog.column-settings .detail-form-settings-option')?.dataset.field
        );
        check(`${name}: notes moved to the top of the list`, firstOption === 'notes', firstOption);
        if (shots) {
            await page.screenshot({ path: `${shots}/dialog-detail-form-${name}.png` });
        }
        const dialogRadius = await page.evaluate(() =>
            [...document.querySelectorAll('dialog.column-settings, dialog.column-settings *')]
                .filter((e) => !(e instanceof HTMLInputElement && e.type === 'checkbox'))
                .map((e) => getComputedStyle(e).borderRadius)
                .filter((r) => r !== '0px')
        );
        check(`${name}: no rounded corners in the dialog`, dialogRadius.length === 0, dialogRadius);
        await page.locator('dialog.column-settings button', { hasText: 'Apply & close' }).click();
        await page.waitForTimeout(200);
        check(`${name}: Apply & close closes it`, (await page.locator('dialog.column-settings').count()) === 0);

        // ---- the panel at the right with the current row
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.locator(`${GRID} input[data-attribute="company"]`).first().click();
        await page.waitForTimeout(200);
        let info = await formInfo();
        const cellCompany = await page.evaluate(() => document.activeElement.value);
        check(
            `${name}: the form shown, the fields in their order`,
            !info.hidden && info.fields.map((f) => f.label).join() === 'Notes,Company,Orderdate',
            info.fields.map((f) => f.label)
        );
        check(`${name}: the form shows the current row`, info.fields[1]?.value === cellCompany && info.row === 'Row 1', {
            info,
            cellCompany
        });
        const g = await rect(GRID);
        const f = await rect(formSel);
        const body = await rect(`${GRID} .simple-html-grid-body`);
        const middle = await rect(`${GRID} .simple-html-grid-middle-scroller`);
        const pinnedRight = await rect(`${GRID} .simple-html-grid-header-view-pinned-right`);
        const footer = await rect(`${GRID} .simple-html-grid-footer`);
        const scroller = await rect(`${GRID} .simple-html-grid-body-scroller`);
        check(
            `${name}: the form at the right, 300px, inside the grid`,
            Math.abs(f.width - 300) <= 1 && Math.abs(f.right - (g.right - 1)) <= 2 && f.left > g.left,
            { f, g }
        );
        check(
            `${name}: the rows, the pinned right columns, the scrollbars end where the form starts`,
            body.right <= f.left + 1 &&
                middle.right <= f.left + 1 &&
                pinnedRight.right <= f.left + 1 &&
                scroller.right <= f.left + 1,
            { body, middle, pinnedRight, scroller, f }
        );
        check(
            `${name}: the footer as wide as the grid, under the form`,
            footer.right >= g.right - 2 && footer.top >= f.bottom - 1,
            { footer, f }
        );

        // Alt+ArrowDown: the cell below, its row the current row - the form follows
        await page.keyboard.press('Alt+ArrowDown');
        await page.waitForTimeout(300);
        info = await formInfo();
        const nextCompany = await page.evaluate(() => document.activeElement.value);
        check(
            `${name}: Alt+ArrowDown moves the form to the next row`,
            info.row === 'Row 2' && info.fields[1]?.value === nextCompany,
            info.row
        );

        // a row with notes of three lines: all of it readable
        await api(() => {
            const gi = document.querySelector('.stage simple-html-grid').grid.gridInterface;
            const datasource = gi.getDatasource();
            const index = datasource.getRows().findIndex((row) => typeof row.notes === 'string' && row.notes.includes('\n'));
            datasource.setRowAsCurrentEntity(index);
            gi.scrollToRow?.(index);
        });
        await page.waitForTimeout(200);
        const notes = await page.evaluate((s) => {
            const t = document.querySelector(`${s} textarea`);
            return t ? { lines: t.value.split('\n').length, scroll: t.scrollHeight, client: t.clientHeight } : null;
        }, formSel);
        check(
            `${name}: notes of three lines in a textarea, all of it shown`,
            notes && notes.lines === 3 && notes.scroll <= notes.client + 1,
            notes
        );
        if (shots) {
            await page.screenshot({ path: `${shots}/form-${name}.png` });
            const r = await rect(formSel);
            await page.screenshot({
                path: `${shots}/form-zoom-${name}.png`,
                clip: { x: r.left - 200, y: r.top - 30, width: r.width + 200, height: Math.min(r.height + 60, 600) }
            });
        }
        const formRadius = await page.evaluate(
            (s) =>
                [document.querySelector(s), ...document.querySelectorAll(`${s} *`)]
                    .filter((e) => !(e instanceof HTMLInputElement && e.type === 'checkbox'))
                    .map((e) => getComputedStyle(e).borderRadius)
                    .filter((r) => r !== '0px'),
            formSel
        );
        check(`${name}: no rounded corners in the form`, formRadius.length === 0, formRadius);

        if (full) {
            // the rows still scroll sideways
            const scrolled = await page.evaluate(() => {
                const m = document.querySelector('.stage .simple-html-grid-middle-scroller');
                m.scrollLeft = 600;
                m.dispatchEvent(new Event('scroll'));
                return m.scrollLeft;
            });
            await page.waitForTimeout(200);
            const headerScrolled = await page.evaluate(
                () => document.querySelector('.stage .simple-html-grid-header-view-pinned-middle').scrollLeft
            );
            check(`${name}: the rows scroll sideways`, scrolled > 500 && headerScrolled > 500, { scrolled, headerScrolled });
            await page.evaluate(() => {
                const m = document.querySelector('.stage .simple-html-grid-middle-scroller');
                m.scrollLeft = 0;
            });

            // the wheel over the form: the form, not the rows
            const before = await page.evaluate(() => document.querySelector('.stage .simple-html-grid-body-scroller').scrollTop);
            const fr = await rect(formSel);
            await page.mouse.move(fr.left + 50, fr.top + 60);
            await page.mouse.wheel(0, 300);
            await page.waitForTimeout(200);
            const after = await page.evaluate(() => document.querySelector('.stage .simple-html-grid-body-scroller').scrollTop);
            check(`${name}: the wheel over the form does not scroll the rows`, before === after, { before, after });

            // editing in the form: the row and the cell follow, Ctrl+Z undoes
            const company = page.locator(`${formSel} [data-field="company"] input`);
            const was = await company.inputValue();
            await company.click();
            await company.fill('Detail form edit');
            await page.waitForTimeout(150);
            const written = await api(
                () => document.querySelector('.stage simple-html-grid').grid.gridInterface.getDatasource().currentEntity.company
            );
            check(`${name}: typing in the form edits the row`, written === 'Detail form edit', written);
            await page.locator(`${formSel} [data-field="orderDate"] input`).click();
            await page.keyboard.press('Control+z');
            await page.waitForTimeout(150);
            const undone = await company.inputValue();
            check(`${name}: Ctrl+Z in the form undoes it`, undone === was, { undone, was });

            // the state round trip
            const saved = await api(() =>
                JSON.stringify(document.querySelector('.stage simple-html-grid').grid.gridInterface.getState())
            );
            await api(() => document.querySelector('.stage simple-html-grid').grid.gridInterface.resetState());
            await page.waitForTimeout(150);
            const reset = await formInfo();
            await api((s) => document.querySelector('.stage simple-html-grid').grid.gridInterface.setState(JSON.parse(s)), saved);
            await page.waitForTimeout(150);
            const back = await formInfo();
            check(
                `${name}: getState() -> JSON -> resetState() -> setState() gives the form back`,
                reset.hidden && !back.hidden && back.fields.map((x) => x.field).join() === 'notes,company,orderDate',
                { reset: reset.hidden, back: back.fields.map((x) => x.field) }
            );

            // the window narrower, then wider: the form stays at the right while it fits
            await page.setViewportSize({ width: 1000, height: 1000 });
            await page.waitForTimeout(600);
            const narrower = {
                g: await rect(GRID),
                f: await rect(formSel),
                body: await rect(`${GRID} .simple-html-grid-body`),
                middle: await rect(`${GRID} .simple-html-grid-body-view-pinned-middle`)
            };
            const below = await page.evaluate(
                (s) => document.querySelector(s).classList.contains('simple-html-grid-detail-form-below'),
                formSel
            );
            // the pinned columns of the sample take 420px: at the right the scrolling ones would get less than 150px
            check(
                `${name}: a narrower window (grid ${Math.round(narrower.g.width)}px): the form under the rows, the scrolling columns keep their room`,
                below && narrower.f.top >= narrower.body.bottom - 1 && narrower.middle.width >= 150,
                narrower
            );
            // wider again: at the right
            await page.setViewportSize({ width: 1300, height: 1000 });
            await page.waitForTimeout(600);
            const wider = await page.evaluate(
                (s) => document.querySelector(s).classList.contains('simple-html-grid-detail-form-below'),
                formSel
            );
            check(`${name}: the window wider again, the form at the right`, !wider, wider);
            await page.setViewportSize({ width: 1000, height: 1000 });
            await page.waitForTimeout(600);
            if (shots) {
                await page.screenshot({ path: `${shots}/form-1000-${name}.png` });
            }
            await page.setViewportSize({ width: 1300, height: 1000 });
            await page.waitForTimeout(600);
        }
        await context.close();

        // ---- a phone: the detail form sample at 390px, the form under the rows
        const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
        const p2 = await phone.newPage();
        p2.on('pageerror', (e) => errors.push(`${name} phone: ${e}`));
        await p2.addInitScript((l) => {
            localStorage.setItem('simple-html-demo-theme', l.theme);
            localStorage.setItem('simple-html-demo-grid-theme', l.grid);
        }, look);
        await p2.goto(`${base}#sample/detail-form`);
        await p2.waitForSelector(`${GRID} .simple-html-grid-col-cell`);
        await p2.waitForTimeout(500);
        const ph = await p2.evaluate((s) => {
            const r = (e) => e?.getBoundingClientRect();
            const form = document.querySelector(s);
            const grid = document.querySelector('.stage simple-html-grid');
            const body = grid.querySelector('.simple-html-grid-body');
            const footer = grid.querySelector('.simple-html-grid-footer');
            const fr = r(form);
            return {
                below: form.classList.contains('simple-html-grid-detail-form-below'),
                form: { left: fr.left, right: fr.right, top: fr.top, bottom: fr.bottom },
                grid: { left: r(grid).left, right: r(grid).right },
                bodyBottom: r(body).bottom,
                footerTop: r(footer).top,
                fields: form.querySelectorAll('.simple-html-grid-detail-form-field').length,
                pageScrollsSideways: document.documentElement.scrollWidth > window.innerWidth + 1
            };
        }, formSel);
        check(
            `${name}: a phone (390px): the form under the rows, as wide as the grid, over the footer`,
            ph.below &&
                ph.form.top >= ph.bodyBottom - 1 &&
                ph.form.bottom <= ph.footerTop + 1 &&
                ph.form.right - ph.form.left >= ph.grid.right - ph.grid.left - 4 &&
                ph.fields === 5,
            ph
        );
        check(`${name}: a phone: the page does not scroll sideways`, !ph.pageScrollsSideways, ph.pageScrollsSideways);
        if (shots) {
            await p2.evaluate(() => document.querySelector('.stage simple-html-grid').scrollIntoView());
            await p2.waitForTimeout(150);
            await p2.screenshot({ path: `${shots}/phone-${name}.png` });
        }
        await phone.close();
    }
    await browser.close();
    for (const line of results) {
        console.log(line);
    }
    for (const error of errors) {
        console.log(`ERROR ${error}`);
    }
    const failed = results.filter((line) => line.startsWith('FAIL')).length;
    console.log(`\n${results.length - failed}/${results.length} passed, ${errors.length} page errors`);
    process.exit(failed || errors.length ? 1 : 0);
})();
