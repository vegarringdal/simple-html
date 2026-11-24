// Real browser check of the options of the detail form's fields (DetailForm.fieldOptions) on the detail
// form sample: notes minRows 5 - at least 5 lines tall -, a section "More" from country with room above
// it; its header collapses and expands it (the state's collapsed), Tab reaches it, Enter toggles; the
// tab Detail form of the dialog sets them; the menu border of the tredespace theme in dark.
// Usage: node detail-form-sections-check.js <site url> [screenshot dir]
const [, , base, shots] = process.argv;
const { chromium } = require('playwright');
const results = [];
const check = (name, ok, detail = '') =>
    results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${JSON.stringify(detail)})` : ''}`);
const grid = '.stage simple-html-grid';

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];
    for (const dark of [false, true]) {
        const theme = dark ? 'dark' : 'light';
        const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.addInitScript((d) => localStorage.setItem('simple-html-demo-theme', d ? 'dark' : 'light'), dark);
        await page.goto(`${base}#sample/detail-form`);
        await page.waitForSelector(`${grid} .simple-html-grid-detail-form-field`);
        await page.waitForTimeout(300);
        const state = () =>
            page.evaluate(() => {
                const form = document.querySelector('.stage .simple-html-grid-detail-form');
                const notes = form.querySelector('[data-field="notes"] textarea');
                const cs = notes ? getComputedStyle(notes) : null;
                const section = form.querySelector('.simple-html-grid-detail-form-section');
                const header = section?.querySelector('button');
                return {
                    notesHeight: notes ? Math.round(notes.getBoundingClientRect().height) : 0,
                    lineHeight: cs ? parseFloat(cs.lineHeight) : 0,
                    sectionMargin: section ? getComputedStyle(section).marginTop : null,
                    panel: section?.classList.contains('simple-html-grid-detail-form-panel'),
                    title: header?.textContent.trim(),
                    expanded: header?.getAttribute('aria-expanded'),
                    fields: section
                        ? [...section.querySelectorAll('.simple-html-grid-detail-form-field')]
                              .filter((f) => f.offsetParent)
                              .map((f) => f.dataset.field)
                        : [],
                    chevron: header ? getComputedStyle(header.querySelector('svg')).transform : null
                };
            });
        let s = await state();
        check(`${theme}: notes at least 5 lines tall`, s.notesHeight >= Math.floor(5 * s.lineHeight), s);
        check(
            `${theme}: a panel More with country, date1, isActive, 6px above it`,
            s.title === 'More' &&
                s.panel &&
                s.expanded === 'true' &&
                s.sectionMargin === '6px' &&
                s.fields.join() === 'country,date1,isActive',
            s
        );
        if (shots) await page.locator(`${grid} .simple-html-grid-detail-form`).screenshot({ path: `${shots}/form-${theme}.png` });
        const header = page.locator(`${grid} .simple-html-grid-detail-form-section-header`);
        await header.click();
        await page.waitForTimeout(100);
        s = await state();
        const collapsed = await page.evaluate(
            (g) => document.querySelector(g).grid.gridInterface.getState().detailForm.fields[2],
            grid
        );
        check(
            `${theme}: a click collapses it - the user's, the default in the state stays open`,
            s.expanded === 'false' && s.fields.length === 0 && collapsed.collapsed === undefined,
            { s, collapsed }
        );
        const focused = await page.evaluate(() => document.activeElement?.className);
        check(`${theme}: the header keeps the focus`, focused === 'simple-html-grid-detail-form-section-header', focused);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(100);
        s = await state();
        check(`${theme}: Enter expands it again`, s.expanded === 'true' && s.fields.length === 3, s);
        if (shots) {
            await header.click();
            await page
                .locator(`${grid} .simple-html-grid-detail-form`)
                .screenshot({ path: `${shots}/form-${theme}-collapsed.png` });
            await header.click();
        }

        // the dialog: Add section under Company, City moved under it, a panel
        await page.evaluate((g) => document.querySelector(g).grid.gridInterface.openDetailFormSettings(), grid);
        await page.waitForTimeout(200);
        const dlg = page.locator('dialog.column-settings');
        await dlg.locator('.detail-form-settings-option[data-field="company"]').click();
        await dlg.getByRole('button', { name: 'Add section', exact: true }).click();
        const nameFocused = await page.evaluate(() =>
            document.activeElement?.classList.contains('detail-form-settings-section-name')
        );
        await page.keyboard.type('Where');
        await page.keyboard.press('Tab');
        await dlg.locator('.detail-form-settings-panel').check();
        // the first field not in the form: put in it, then up under Where by Alt+ArrowUp
        const city = await dlg
            .locator('.detail-form-settings-list [role="option"][aria-checked="false"]')
            .first()
            .getAttribute('data-field');
        await dlg.locator(`.detail-form-settings-option[data-field="${city}"] .detail-form-settings-box`).click();
        await dlg.locator(`.detail-form-settings-option[data-field="${city}"]`).click();
        const list = dlg.locator('.detail-form-settings-list');
        for (let i = 0; i < 20; i++) {
            const at = await dlg
                .locator('.detail-form-settings-list [role="option"]')
                .evaluateAll((all, c) => all.findIndex((o) => o.dataset.field === c), city);
            if (at <= 2) break;
            await list.press('Alt+ArrowUp');
        }
        const rows = await dlg
            .locator('.detail-form-settings-list [role="option"]')
            .evaluateAll((all) => all.slice(0, 4).map((o) => o.dataset.field ?? `§${o.dataset.section}`));
        if (shots) await dlg.screenshot({ path: `${shots}/dialog-${theme}.png` });
        const wide = await page.evaluate(() => {
            const d = document.querySelector('dialog.column-settings').getBoundingClientRect();
            return [...document.querySelectorAll('dialog.column-settings .detail-form-settings-field *')].filter(
                (e) => e.offsetParent && e.getBoundingClientRect().right > d.right + 1
            ).length;
        });
        check(
            `${theme}: Add section: its name typed at once, a row of the list, City moved under it`,
            nameFocused && rows.join() === `company,§Where,${city},notes` && wide === 0,
            { nameFocused, rows, wide }
        );
        await dlg.getByRole('button', { name: 'Apply', exact: true }).click();
        await page.waitForTimeout(200);
        const after = await page.evaluate((g) => {
            const form = document.querySelector('.stage .simple-html-grid-detail-form');
            return {
                sections: [...form.querySelectorAll('.simple-html-grid-detail-form-section')].map((sec) => ({
                    title: sec.querySelector('.simple-html-grid-detail-form-section-title').textContent,
                    panel: sec.classList.contains('simple-html-grid-detail-form-panel'),
                    fields: [...sec.querySelectorAll('.simple-html-grid-detail-form-field')].map((f) => f.dataset.field)
                })),
                fields: document.querySelector(g).grid.gridInterface.getState().detailForm.fields
            };
        }, grid);
        check(
            `${theme}: Apply: Where with city and notes, More after it`,
            JSON.stringify(after.sections.map((x) => [x.title, x.panel, x.fields])) ===
                JSON.stringify([
                    ['Where', true, [city, 'notes']],
                    ['More', true, ['country', 'date1', 'isActive']]
                ]),
            after
        );
        const scroll = await page.evaluate(() => {
            const b = document.querySelector('.stage .simple-html-grid-detail-form-body');
            const p = b.querySelector('.simple-html-grid-detail-form-panel');
            const h = p.querySelector('button');
            return {
                left: b.scrollLeft,
                wide: b.scrollWidth - b.clientWidth,
                header: Math.round(p.getBoundingClientRect().right - h.getBoundingClientRect().right)
            };
        });
        check(
            `${theme}: the form does not scroll sideways, a panel's header from frame to frame`,
            scroll.left === 0 && scroll.wide === 0 && scroll.header === 1,
            scroll
        );
        if (shots)
            await page.locator(`${grid} .simple-html-grid-detail-form`).screenshot({ path: `${shots}/form-${theme}-after.png` });
        await page.close();
    }

    // the menu's line in tredespace, dark: lighter than the grid's lines
    {
        const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.addInitScript(() => localStorage.setItem('simple-html-demo-theme', 'dark'));
        await page.goto(`${base}#sample/full-grid`);
        await page.waitForSelector(`${grid} .simple-html-grid-col-cell`);
        const colors = await page.evaluate((g) => {
            document.documentElement.setAttribute('data-grid-theme', 'tredespace');
            const el = document.querySelector(g);
            const cs = getComputedStyle(el.querySelector('.simple-html-grid-col-cell') ?? el);
            return {
                menu: getComputedStyle(el).getPropertyValue('--simple-html-grid-menu-border-color').trim(),
                lines: getComputedStyle(el).getPropertyValue('--simple-html-grid-main-bg-border').trim()
            };
        }, grid);
        check(
            'tredespace dark: the menu line is its own colour, not the grid lines',
            colors.menu !== colors.lines && colors.menu !== '',
            colors
        );
        if (shots) {
            await page
                .locator(`${grid} .simple-html-grid-cell-filter-input`)
                .nth(2)
                .click({ button: 'right' })
                .catch(() => {});
            await page.waitForTimeout(300);
            await page.screenshot({ path: `${shots}/tredespace-menu.png`, clip: { x: 0, y: 0, width: 700, height: 600 } });
        }
        await page.close();
    }
    check('no page errors', errors.length === 0, errors);
    console.log(results.join('\n'));
    console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
    await browser.close();
    process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
})();
