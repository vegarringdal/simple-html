// Real browser check of the named views (#sample/views, #sample/full-grid): the views button at the
// footer's left end and its menu - two views saved with other filters and columns, switching between them,
// the * of a changed view, Save, Revert changes, Rename…, Delete, Default view, a reload keeps them
// (viewsStorageKey), the keyboard (Enter on the button, the arrows, Enter, Esc, the name asked for), the
// button clear of "No filter" / Clear and the chips on a wide grid and a phone, the contrast of its text.
// Screenshots light, dark, TreDeSpace and a phone.
// Usage: node views-check.js <site url> [screenshot dir]
const path = require('node:path');
const fs = require('node:fs');
const [, , base, shots] = process.argv;
if (!base) {
    console.log('usage: node views-check.js <site url> [screenshot dir]');
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
const STORAGE = 'simple-html-demo-views';

/** the contrast ratio of two css colours `rgb(r, g, b)` (WCAG) */
function contrast(a, b) {
    const lum = (c) => {
        const [r, g, bl] = c
            .match(/[\d.]+/g)
            .slice(0, 3)
            .map((v) => {
                const s = Number(v) / 255;
                return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
            });
        return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    };
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
}

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];

    /**
     * a page of the site: the theme set before it loads, the views of the sample forgotten (the first load
     * only: a reload keeps them)
     */
    const open = async (sample, { dark = false, tredespace = false, context } = {}) => {
        const ctx = context ?? (await browser.newContext({ viewport: { width: 1300, height: 1100 }, deviceScaleFactor: 2 }));
        const page = await ctx.newPage();
        page.on('pageerror', (e) => errors.push(`${sample}: ${e}`));
        page.on('console', (m) => m.type() === 'error' && errors.push(`${sample} console: ${m.text()}`));
        await page.addInitScript(
            ([d, t]) => {
                localStorage.setItem('simple-html-demo-theme', d ? 'dark' : 'light');
                localStorage.setItem('simple-html-demo-grid-theme', t ? 'tredespace' : 'default');
                if (!sessionStorage.getItem('views-check-loaded')) {
                    sessionStorage.setItem('views-check-loaded', '1');
                    localStorage.removeItem('simple-html-demo-views');
                    localStorage.removeItem('simple-html-demo-full-grid-views');
                }
            },
            [dark, tredespace]
        );
        // a colour as rgb(r, g, b): TreDeSpace's dark colours are oklch(), the canvas converts them
        await page.addInitScript(() => {
            window.toRgb = (color) => {
                const canvas = document.createElement('canvas');
                canvas.width = 1;
                canvas.height = 1;
                const context = canvas.getContext('2d');
                context.fillStyle = color;
                context.fillRect(0, 0, 1, 1);
                const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
                return `rgb(${r}, ${g}, ${b})`;
            };
        });
        await page.goto(`${base}#sample/${sample}`);
        await page.waitForSelector(`${grid} .simple-html-grid-col-cell`);
        await page.waitForTimeout(300);
        return page;
    };
    const api = (page, code) =>
        page.evaluate(
            ([g, c]) => new Function('gi', `return (${c})`)(document.querySelector(g).grid.gridInterface),
            [grid, code]
        );
    /** the footer: the views button, the filter's row and where they are */
    const footer = (page) =>
        page.evaluate((g) => {
            const f = document.querySelector(`${g} .simple-html-grid-footer`);
            const rect = (s) => {
                const r = f.querySelector(s)?.getBoundingClientRect();
                return r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width } : null;
            };
            const button = f.querySelector('.footer-views-button');
            return {
                text: button?.textContent.replace(/\s+/g, ' ').trim(),
                label: button?.getAttribute('aria-label'),
                title: button?.title,
                count: f.querySelector('.footer-count')?.textContent.trim(),
                parts: [...f.querySelectorAll('.footer-filter > *')].map((p) => p.textContent.replace(/\s+/g, ' ').trim()),
                footer: (({ left, right, top, bottom }) => ({ left, right, top, bottom }))(f.getBoundingClientRect()),
                views: rect('.footer-views-button'),
                name: rect('.footer-views-name'),
                row: rect('.footer-filter'),
                first: rect('.footer-filter > button'),
                gear: rect('.footer-settings'),
                color: button ? toRgb(getComputedStyle(button).color) : null,
                bg: button ? toRgb(getComputedStyle(button).backgroundColor) : null
            };
        }, grid);
    /** the entries of the open menu: `✓` checked, `-` greyed out, then the text */
    const menu = (page) =>
        page.evaluate(() =>
            [...document.querySelectorAll('.simple-html-grid-menu[role="menu"] [data-menu-id]')].map(
                (e) =>
                    `${e.getAttribute('aria-checked') === 'true' ? '✓' : ''}${e.getAttribute('aria-disabled') === 'true' ? '-' : ''}${e.textContent.replace(/\s+/g, ' ').trim()}`
            )
        );
    const clickButton = (page) => page.click(`${grid} .footer-views-button`);
    const clickEntry = (page, id) => page.click(`[data-menu-id="${id}"]`);
    /** Save as new view… / Rename…: types the name and presses Enter */
    const typeName = async (page, name) => {
        const input = page.locator('.simple-html-grid-view-name-input');
        await input.fill(name);
        await input.press('Enter');
        await page.waitForTimeout(100);
    };
    const noOverlap = (f) => !f.views || !f.row || f.views.right <= f.row.left;
    const sameLine = (f) => Math.abs((f.views.top + f.views.bottom) / 2 - (f.first.top + f.first.bottom) / 2) <= 1.5;
    const shot = async (page, name, clip) => {
        if (shots) {
            // the clip in the window: footerClip scrolls the footer into it
            await page.screenshot({ path: path.join(shots, `${name}.png`), clip });
        }
    };
    const footerClip = async (page, above = 260) => {
        const r = await page.evaluate((g) => {
            // the full grid is taller than the window: its footer scrolled into it first
            document.querySelector(`${g} .simple-html-grid-footer`).scrollIntoView({ block: 'end' });
            const b = document.querySelector(g).getBoundingClientRect();
            return { x: b.left, y: b.top, width: b.width, height: b.height };
        }, grid);
        return { x: r.x, y: Math.max(0, r.y + r.height - above), width: r.width, height: above };
    };

    // ------------------------------------------------------------------ the views sample, light
    let page = await open('views');
    let f = await footer(page);
    check('the button at the left end, Standard', f.text === 'Standard' && f.views.left - f.footer.left < 8, f);
    check('its name and tooltip for a screen reader', f.label === 'View: Standard' && f.title === 'View: Standard', f.label);
    check('on the line of "No filter", clear of it', sameLine(f) && noOverlap(f), { views: f.views, first: f.first });
    check(
        'its text 4.5:1 to its background',
        contrast(f.color, f.bg) >= 4.5,
        `${f.color} on ${f.bg}: ${contrast(f.color, f.bg).toFixed(2)}`
    );

    await clickButton(page);
    let lines = await menu(page);
    check(
        'the menu: Standard first with ✓, the shared views, the commands',
        JSON.stringify(lines) ===
            JSON.stringify([
                '✓Standard (default)',
                'Active in Norway (shared)',
                'By country, compact (shared)',
                '',
                '-Save',
                'Save as new view…',
                '-Revert changes',
                '',
                '-Rename…',
                '-Delete',
                '✓-Default view'
            ]),
        lines
    );
    const menuRect = await page.evaluate(() =>
        document.querySelector('.simple-html-grid-menu[role="menu"]').getBoundingClientRect().toJSON()
    );
    check('the menu opens above the button (the footer is at the bottom)', menuRect.bottom <= f.views.top + 1, menuRect);
    await shot(page, 'views-menu-light', await footerClip(page, 420));

    // one click switches: a shared view - the filter, its sort
    await clickEntry(page, 'views.view.nordic-active');
    f = await footer(page);
    check('a shared view applied: its name, its filter as chips', f.text === 'Active in Norway' && f.parts.length > 1, f.parts);
    check('the chips clear of the button', noOverlap(f), { views: f.views, row: f.row });

    // a change: the *, in words for a screen reader
    await api(
        page,
        "gi.setState({ filter: { group: 'AND', children: [{ field: 'country', operator: 'EQUAL', value: 'Norway' }, { field: 'isActive', operator: 'EQUAL', value: true }, { field: 'age', operator: 'GREATER_THAN', value: 40 }] }, headerFilters: { country: { value: 'Norway' }, isActive: { value: true }, age: { value: 40, operator: 'GREATER_THAN' } } })"
    );
    await page.waitForTimeout(100);
    f = await footer(page);
    check(
        'changed: a * after the name, "(changed)" in its name',
        f.text === 'Active in Norway*' && f.label === 'View: Active in Norway (changed)',
        f
    );
    await clickButton(page);
    lines = await menu(page);
    check(
        'a shared view changed: Save, Rename… and Delete greyed out, Revert changes not',
        lines[4] === '-Save' && lines[6] === 'Revert changes' && lines[8] === '-Rename…',
        lines
    );
    await shot(page, 'views-changed-light', await footerClip(page, 420));

    // view 1: Save as new view…, the name asked for
    await clickEntry(page, 'views.saveAs');
    const focusInInput = await page.evaluate(() =>
        document.activeElement?.classList.contains('simple-html-grid-view-name-input')
    );
    check('Save as new view…: the focus in the name', focusInInput);
    const problem = await page.evaluate(() => document.querySelector('.simple-html-grid-view-name-problem')?.textContent.trim());
    check('no name yet: said under the input', problem === 'Give the view a name', problem);
    await page.locator('.simple-html-grid-view-name-input').fill('active in norway');
    const taken = await page.evaluate(() => [
        document.querySelector('.simple-html-grid-view-name-problem')?.textContent.trim(),
        document.querySelector('.simple-html-grid-view-name .simple-html-grid-button-primary').getAttribute('aria-disabled')
    ]);
    check(
        'a name another view has: said, Save greyed out',
        taken[0] === 'Another view has this name' && taken[1] === 'true',
        taken
    );
    await shot(page, 'views-name-light', await footerClip(page, 420));
    await typeName(page, 'Over 40 in Norway');
    f = await footer(page);
    check('saved: the new view shown, not changed', f.text === 'Over 40 in Norway', f.text);
    const focusBack = await page.evaluate(() => document.activeElement?.classList.contains('footer-views-button'));
    check('the focus back on the button', focusBack);

    // view 2: other columns - Standard, a column resized with the mouse, saved
    await clickButton(page);
    await clickEntry(page, 'views.standard');
    const handle = await page.evaluate((g) => {
        // the handle at the right edge of the first center column's label: company
        const h = document.querySelector(
            `${g} .simple-html-grid-header-row-container-pinned-middle > .simple-html-grid-col[refID="0"] > .simple-html-grid-col-resize`
        );
        const r = h.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + 4 };
    }, grid);
    await page.mouse.move(handle.x, handle.y);
    await page.mouse.down();
    await page.mouse.move(handle.x + 80, handle.y, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(100);
    f = await footer(page);
    check('a column resized marks Standard changed', f.text === 'Standard*', f.text);
    await clickButton(page);
    await clickEntry(page, 'views.saveAs');
    await typeName(page, 'Wide company');
    const width = () => api(page, 'gi.getState().layout.center[0].width');
    const wide = await width();
    check('view 2 saved with the column wider', wide >= 240, wide);

    // switching between them
    await clickButton(page);
    lines = await menu(page);
    const over40 = (await api(page, 'gi.getViews()')).find((v) => v.name === 'Over 40 in Norway');
    await clickEntry(page, `views.view.${over40.id}`);
    f = await footer(page);
    check(
        'view 1 again: its filter, the config width',
        f.text === 'Over 40 in Norway' && f.parts.length > 1 && (await width()) === 170,
        [f.parts, await width()]
    );
    const wideView = (await api(page, 'gi.getViews()')).find((v) => v.name === 'Wide company');
    await clickButton(page);
    await clickEntry(page, `views.view.${wideView.id}`);
    f = await footer(page);
    check(
        'view 2 again: no filter, its width',
        f.text === 'Wide company' && f.parts.join() === 'No filter' && (await width()) === wide,
        [f.parts, await width()]
    );

    // Save over it, Revert changes
    await api(page, "gi.setState({ sorting: [{ attribute: 'company', ascending: true }] })");
    await clickButton(page);
    await clickEntry(page, 'views.save');
    f = await footer(page);
    check(
        'Save: not changed any more, the sort saved',
        f.text === 'Wide company' && (await api(page, 'gi.getCurrentView().state.sorting.length')) === 1
    );
    await api(page, "gi.setState({ sorting: [{ attribute: 'age', ascending: false }] })");
    await clickButton(page);
    await clickEntry(page, 'views.revert');
    f = await footer(page);
    const sorting = await api(page, 'gi.getState().sorting');
    check('Revert changes: the saved sort back', f.text === 'Wide company' && sorting[0]?.attribute === 'company', sorting);

    // Rename…
    await clickButton(page);
    await clickEntry(page, 'views.rename');
    const prefilled = await page.locator('.simple-html-grid-view-name-input').inputValue();
    check('Rename…: the name in the input', prefilled === 'Wide company', prefilled);
    await typeName(page, 'Company wide');
    f = await footer(page);
    check('renamed', f.text === 'Company wide', f.text);

    // Default view, a reload keeps the views and opens in the default
    await clickButton(page);
    await clickEntry(page, 'views.setDefault');
    const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), STORAGE);
    check(
        'stored: the two views of the user, not the shared ones, the default',
        stored.views.length === 2 && stored.defaultView === wideView.id,
        stored.views.map((v) => v.name)
    );
    await page.reload();
    await page.waitForSelector(`${grid} .simple-html-grid-col-cell`);
    await page.waitForTimeout(300);
    f = await footer(page);
    const names = await api(page, 'gi.getViews().map((v) => v.name)');
    check(
        'after a reload: the views kept, the default shown',
        f.text === 'Company wide' &&
            JSON.stringify(names) ===
                JSON.stringify(['Active in Norway', 'By country, compact', 'Over 40 in Norway', 'Company wide']),
        [f.text, names]
    );
    check(
        'after a reload: its width and sort',
        (await width()) === wide && (await api(page, 'gi.getState().sorting[0].attribute')) === 'company'
    );

    // Delete: the state stays, Standard*
    await clickButton(page);
    await clickEntry(page, 'views.delete');
    f = await footer(page);
    check(
        'Delete: gone, Standard*, the state kept',
        f.text === 'Standard*' && (await width()) === wide && (await api(page, 'gi.getViews().length')) === 3,
        f.text
    );

    // the keyboard: Enter on the button, the arrows, Enter applies, Esc closes, the focus back
    await page.focus(`${grid} .footer-views-button`);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    let focused = await page.evaluate(() => document.activeElement?.getAttribute('data-menu-id'));
    check('Enter on the button: the menu, the focus on its first entry', focused === 'views.standard', focused);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    f = await footer(page);
    focused = await page.evaluate(() => document.activeElement?.className);
    check(
        'ArrowDown, Enter: the second entry applied, the focus back on the button',
        f.text === 'Active in Norway' && focused === 'footer-views-button',
        [f.text, focused]
    );
    await page.keyboard.press(' ');
    await page.waitForTimeout(100);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    focused = await page.evaluate(() => [
        document.querySelectorAll('.simple-html-grid-menu').length,
        document.activeElement?.className
    ]);
    check(
        'Space opens it, Esc closes it, the focus back on the button',
        focused[0] === 0 && focused[1] === 'footer-views-button',
        focused
    );
    // the letter S: the first entry with it (Save, greyed out on a shared view - the keyboard still gets there)
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    await page.keyboard.press('s');
    focused = await page.evaluate(() => document.activeElement?.getAttribute('data-menu-id'));
    check('a letter: the next entry that starts with it', focused === 'views.standard' || focused === 'views.save', focused);
    await page.keyboard.press('Escape');
    // Tab: the button is the first stop of the footer
    const order = await page.evaluate(
        (g) =>
            [
                ...document.querySelectorAll(`${g} .simple-html-grid-footer button, ${g} .simple-html-grid-footer [tabindex="0"]`)
            ].map((e) => e.className),
        grid
    );
    check(
        'Tab: the button first in the footer, the gear last',
        order[0] === 'footer-views-button' && order[order.length - 1] === 'footer-settings',
        order
    );
    await page.click(`${grid} .simple-html-grid-col-cell[data-attribute="company"] input`).catch(() => {});
    await shot(page, 'views-light', await footerClip(page, 300));
    await page.context().close();

    // ------------------------------------------------------------------ dark and TreDeSpace
    for (const [name, options] of [
        ['dark', { dark: true }],
        ['tredespace', { tredespace: true }],
        ['tredespace-dark', { tredespace: true, dark: true }]
    ]) {
        page = await open('views', options);
        await clickButton(page);
        await clickEntry(page, 'views.view.nordic-active');
        await api(page, "gi.setState({ sorting: [{ attribute: 'age', ascending: true }] })");
        f = await footer(page);
        check(
            `${name}: the button, the *, its contrast`,
            f.text === 'Active in Norway*' && contrast(f.color, f.bg) >= 4.5,
            `${f.color} on ${f.bg}: ${contrast(f.color, f.bg).toFixed(2)}`
        );
        const star = await page.evaluate((g) => {
            const s = document.querySelector(`${g} .footer-views-modified`);
            return [toRgb(getComputedStyle(s).color), toRgb(getComputedStyle(s.parentElement).backgroundColor)];
        }, grid);
        check(
            `${name}: the * 3:1 to the button`,
            contrast(star[0], star[1]) >= 3,
            `${star[0]} on ${star[1]}: ${contrast(star[0], star[1]).toFixed(2)}`
        );
        await clickButton(page);
        await shot(page, `views-menu-${name}`, await footerClip(page, 420));
        await page.keyboard.press('Escape');
        await clickButton(page);
        await clickEntry(page, 'views.saveAs');
        await shot(page, `views-name-${name}`, await footerClip(page, 420));
        await page.context().close();
    }

    // ------------------------------------------------------------------ a phone
    const phone = await browser.newContext({ ...devices['Pixel 7'] });
    page = await open('views', { context: phone });
    f = await footer(page);
    check('phone: the button and "No filter" clear of each other', noOverlap(f) && sameLine(f), {
        views: f.views,
        first: f.first
    });
    await page.tap(`${grid} .footer-views-button`);
    await page.waitForTimeout(150);
    lines = await menu(page);
    check('phone: a tap opens the menu', lines.length === 11, lines.length);
    await page.tap('[data-menu-id="views.view.nordic-active"]');
    await page.waitForTimeout(150);
    await api(page, "gi.setState({ sorting: [{ attribute: 'age', ascending: true }] })");
    f = await footer(page);
    check(
        'phone: a filter of two chips, the button cut where the row starts, the * and the chevron seen',
        noOverlap(f) && f.views.width >= 20,
        { views: f.views, row: f.row, name: f.name }
    );
    await shot(page, 'views-phone');
    await page.tap(`${grid} .footer-views-button`);
    await page.waitForTimeout(150);
    await shot(page, 'views-phone-menu');
    const menuBox = await page.evaluate(() =>
        document.querySelector('.simple-html-grid-menu[role="menu"]').getBoundingClientRect().toJSON()
    );
    check('phone: the menu in the window', menuBox.left >= 0 && menuBox.right <= 412 && menuBox.top >= 0, menuBox);
    await page.tap('[data-menu-id="views.saveAs"]');
    await page.waitForTimeout(150);
    const nameBox = await page.evaluate(() =>
        document.querySelector('.simple-html-grid-view-name').getBoundingClientRect().toJSON()
    );
    check('phone: the name in the window', nameBox.left >= 0 && nameBox.right <= 412, nameBox);
    await shot(page, 'views-phone-name');
    await phone.close();

    // ------------------------------------------------------------------ the full grid sample
    page = await open('full-grid');
    f = await footer(page);
    check(
        'full grid: the views button, clear of "No filter" and the gear',
        f.text === 'Standard' && noOverlap(f) && f.views.right < f.gear.left,
        f
    );
    await api(
        page,
        "gi.getDatasource().filter({ group: 'AND', children: [{ field: 'company', operator: 'CONTAINS', value: 'a' }, { field: 'age', operator: 'GREATER_THAN', value: 30 }, { field: 'status', operator: 'EQUAL', value: 'open' }] })"
    );
    await page.waitForTimeout(100);
    f = await footer(page);
    check('full grid: three chips clear of the button', noOverlap(f) && f.text === 'Standard*', {
        views: f.views,
        row: f.row,
        text: f.text
    });
    await shot(page, 'views-full-grid', await footerClip(page, 200));
    await page.context().close();

    check('no page errors', errors.length === 0, errors);
    await browser.close();
    console.log(results.join('\n'));
    const failed = results.filter((line) => line.startsWith('FAIL')).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})();
