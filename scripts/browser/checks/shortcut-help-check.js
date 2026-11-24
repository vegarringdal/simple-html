// Real browser check of the keyboard shortcuts help (shortcutHelp.ts, shortcutList.ts) on the "Basic grid"
// sample (#sample/basic-grid, an editable grid):
//
// - `?` typed in a cell that can be edited is typed (the cell's text ends with it), no help; Ctrl+/ there
//   opens the help: a modal dialog, the focus in its search, Esc closes it and the focus is back in the cell
// - `?` typed in a header filter and in the find bar's input is typed, no help
// - a readonly grid (updateConfig): `?` on a cell opens it - the `?` is not typed into the search - a
//   column header (Alt+ArrowUp from its filter) too; the editing keys are left out
// - the search: `undo` keeps two rows, `zzz` none and the status says so
// - the header menu: Keyboard shortcuts… (Ctrl+/) opens it, the focus on the dialog (a click), Esc back
// - `shortcutHelp: false`: neither key opens it
// - the look: in the window, square (the dialog and the keys), the text and the keys 4.5:1 or more
// - a Mac (its user agent, navigator.platform and userAgentData): ⌘ ⌥ ⇧, ⇧⌘Z, no Alt+C, Cmd+/ opens it,
//   the menu's hint ⌘/
// - a phone (390 x 844, touch): as wide as the window, its list scrolls, nothing sideways; the ✕ closes it
// - screenshots: light, dark, TreDeSpace (light and dark), the search, the Mac, the phone
//
// Usage: node shortcut-help-check.js <site url> [screenshot dir]
const path = require('node:path');
const fs = require('node:fs');
const [, , base, shots] = process.argv;
if (!base) {
    console.log('usage: node shortcut-help-check.js <site url> [screenshot dir]');
    process.exit(2);
}
const { chromium } = require('playwright');
if (shots) {
    fs.mkdirSync(shots, { recursive: true });
}

const results = [];
const check = (name, ok, detail = '') =>
    results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? `  (${JSON.stringify(detail)})` : ''}`);

const GRID = '.stage simple-html-grid';
const DIALOG = 'dialog.shortcut-help';
const MAC_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** in the page: the contrast of two css colours, through a canvas (oklch() of TreDeSpace too) */
const COLOUR_TOOLS = `
window.__rgb = (text) => {
    window.__canvas = window.__canvas || Object.assign(document.createElement('canvas'), { width: 1, height: 1 });
    const x = window.__canvas.getContext('2d', { willReadFrequently: true });
    x.clearRect(0, 0, 1, 1);
    x.fillStyle = '#000';
    x.fillStyle = text;
    x.fillRect(0, 0, 1, 1);
    const d = x.getImageData(0, 0, 1, 1).data;
    return [d[0] / 255, d[1] / 255, d[2] / 255];
};
window.__lum = ([r, g, b]) => {
    const l = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * l(r) + 0.7152 * l(g) + 0.0722 * l(b);
};
window.__contrast = (a, b) => {
    const [x, y] = [window.__lum(window.__rgb(a)), window.__lum(window.__rgb(b))].sort((m, n) => n - m);
    return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
};
`;

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];

    /** a page of the basic grid sample in a look: `theme` light or dark, `gridTheme` default or tredespace */
    const open = async (name, { theme = 'light', gridTheme = 'default', mac = false, phone = false } = {}) => {
        const context = await browser.newContext({
            viewport: phone ? { width: 390, height: 844 } : { width: 1300, height: 900 },
            deviceScaleFactor: 1,
            ...(phone ? { isMobile: true, hasTouch: true } : {}),
            ...(mac ? { userAgent: MAC_UA } : {})
        });
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
        page.on('console', (m) => m.type() === 'error' && errors.push(`${name} console: ${m.text()}`));
        await page.addInitScript(
            ([t, g, m]) => {
                localStorage.setItem('simple-html-demo-theme', t);
                localStorage.setItem('simple-html-demo-grid-theme', g);
                if (m) {
                    Object.defineProperty(Navigator.prototype, 'platform', { configurable: true, get: () => 'MacIntel' });
                    Object.defineProperty(Navigator.prototype, 'userAgentData', {
                        configurable: true,
                        get: () => ({ platform: 'macOS' })
                    });
                }
            },
            [theme, gridTheme, mac]
        );
        await page.addInitScript(COLOUR_TOOLS);
        await page.goto(`${base}#sample/basic-grid`);
        await page.waitForSelector(`${GRID} .simple-html-grid-col-cell`);
        await page.waitForTimeout(300);
        return page;
    };

    const gi = (page, code) => page.evaluate(`document.querySelector('${GRID}').grid.gridInterface.${code}`);
    const helpOpen = (page) => page.evaluate((d) => !!document.querySelector(d)?.open, DIALOG);
    /** a cell's input on screen, by its row and field */
    const cell = (page, row, field) =>
        page.evaluateHandle(
            ([r, f]) =>
                [...document.querySelectorAll(`.stage input[data-attribute="${f}"]`)].find(
                    (i) => i.closest('.simple-html-grid-col-cell').$row === r && i.offsetParent
                ),
            [row, field]
        );
    const filter = (page, field) =>
        page.evaluateHandle(
            (f) =>
                [...document.querySelectorAll('.stage input.simple-html-grid-cell-filter-input')].find(
                    (i) => i.parentElement.$attribute === f
                ),
            field
        );
    /** where the focus is: in the help (its search or the dialog), or the cell / label of the grid */
    const focus = (page) =>
        page.evaluate((d) => {
            const el = document.activeElement;
            const c = el?.closest('.simple-html-grid-col-cell');
            return {
                search: el?.classList.contains('shortcut-help-search') ?? false,
                dialog: el === document.querySelector(d),
                row: c?.$row ?? null,
                field: c?.$attribute ?? null,
                label: el?.getAttribute('type') === 'label'
            };
        }, DIALOG);
    /** the rows of the help: keys and what they do */
    const rows = (page) =>
        page.$$eval(`${DIALOG} tbody tr`, (trs) =>
            trs.map((tr) => ({
                keys: tr.querySelector('th').textContent.replace(/\s+/g, ' ').trim(),
                does: tr.querySelector('td').textContent.trim()
            }))
        );
    const captions = (page) => page.$$eval(`${DIALOG} caption`, (cs) => cs.map((c) => c.textContent.trim()));
    const shot = async (page, file, selector = DIALOG) => {
        if (shots) {
            await page.locator(selector).screenshot({ path: path.join(shots, file) });
        }
    };
    /** the look of the open help: in the window, square, the contrasts */
    const look = (page) =>
        page.evaluate((d) => {
            const dialog = document.querySelector(d);
            const r = dialog.getBoundingClientRect();
            const kbd = dialog.querySelector('.shortcut-help-keys kbd');
            const td = dialog.querySelector('tbody td');
            const body = dialog.querySelector('.shortcut-help-body');
            const bg = (el) => {
                for (let e = el; e; e = e.parentElement) {
                    const c = getComputedStyle(e).backgroundColor;
                    if (c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') {
                        return c;
                    }
                }
                return 'white';
            };
            return {
                inWindow: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5,
                width: Math.round(r.width),
                radius: [getComputedStyle(dialog).borderRadius, getComputedStyle(kbd).borderRadius],
                textContrast: window.__contrast(getComputedStyle(td).color, bg(td)),
                keyContrast: window.__contrast(getComputedStyle(kbd).color, bg(kbd)),
                keyFrame: window.__contrast(getComputedStyle(kbd).borderTopColor, bg(kbd.parentElement)),
                scrolls: body.scrollHeight > body.clientHeight,
                sideways: dialog.scrollWidth > dialog.clientWidth + 1 || body.scrollWidth > body.clientWidth + 1
            };
        }, DIALOG);

    // ---------------------------------------------------------------- light: the keys and the dialog
    {
        const page = await open('light');

        // ? in a cell that can be edited is typed
        await (await cell(page, 0, 'company')).click();
        await page.keyboard.press('End');
        await page.keyboard.type('?');
        const typed = await page.evaluate(() => document.activeElement.value);
        check('? in a cell that can be edited: typed, no help', typed.endsWith('?') && !(await helpOpen(page)), typed);

        // Ctrl+/ there opens it, the focus in its search
        await page.keyboard.press('Control+Slash');
        await page.waitForTimeout(100);
        check('Ctrl+/ while typing in a cell: the help opens', await helpOpen(page));
        check('opened by a key: the focus in its search', (await focus(page)).search, await focus(page));
        const all = await rows(page);
        check(
            'an editable grid: 9 groups, the keys of editing',
            (await captions(page)).length === 9 &&
                all.some((r) => r.does === 'Fill down: the values of the row above, or of the top row of the range'),
            await captions(page)
        );
        check('the keys as kbd: Tab / Shift+Tab first', all[0]?.keys === 'Tab / Shift+Tab', all[0]);
        const l = await look(page);
        check('light: in the window, 560px wide', l.inWindow && l.width === 560, l);
        check(
            'light: square - the dialog and the keys',
            l.radius.every((r) => r === '0px'),
            l.radius
        );
        check(
            'light: text 4.5:1, keys 4.5:1, the frame of a key 3:1',
            l.textContrast >= 4.5 && l.keyContrast >= 4.5 && l.keyFrame >= 3,
            l
        );
        await shot(page, 'help-light.png');

        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
        const back = await focus(page);
        check(
            'Esc closes it, the focus back in the cell',
            !(await helpOpen(page)) && (await page.$(DIALOG)) === null && back.row === 0 && back.field === 'company',
            back
        );

        // ? in a header filter and in the find bar: typed
        await (await filter(page, 'country')).click();
        await page.keyboard.type('?');
        check(
            '? in a header filter: typed, no help',
            !(await helpOpen(page)) && (await page.evaluate(() => document.activeElement.value)) === '?'
        );
        await page.keyboard.press('Backspace');
        await (await cell(page, 1, 'company')).click();
        await page.keyboard.press('Control+f');
        await page.waitForTimeout(100);
        await page.keyboard.type('?');
        check(
            '? in the find bar: typed, no help',
            !(await helpOpen(page)) &&
                (await page.evaluate(() => document.activeElement.className)).includes('simple-html-grid-find-input') &&
                (await page.evaluate(() => document.activeElement.value)) === '?'
        );
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);

        // a readonly grid: ? on a cell
        await gi(page, 'updateConfig({ readonly: true })');
        await page.waitForTimeout(100);
        await (await cell(page, 2, 'company')).click();
        await page.keyboard.type('?');
        await page.waitForTimeout(100);
        check('a readonly grid: ? on a cell opens it', await helpOpen(page));
        check('the ? is not typed into the search', (await page.$eval(`${DIALOG} .shortcut-help-search`, (i) => i.value)) === '');
        const readonlyCaptions = await captions(page);
        check(
            'a readonly grid: no Changing values, fewer keys',
            !readonlyCaptions.includes('Changing values') && (await rows(page)).length < all.length,
            readonlyCaptions
        );

        // the search
        await page.keyboard.type('undo');
        await page.waitForTimeout(100);
        const undo = await rows(page);
        check(
            'the search "undo": the filter editor undo (a readonly grid has no other)',
            undo.length === 1 && undo[0].does === 'In the filter editor: undo / redo',
            undo
        );
        await shot(page, 'help-search.png');
        await page.keyboard.press('Control+a');
        await page.keyboard.type('zzz');
        await page.waitForTimeout(100);
        check(
            'the search "zzz": none, the status says so',
            (await rows(page)).length === 0 &&
                (await page.$eval(`${DIALOG} [role="status"]`, (s) => s.textContent)) === 'No key matches the search'
        );
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
        const back2 = await focus(page);
        check(
            'Esc in the search closes it, the focus back on the cell',
            !(await helpOpen(page)) && back2.row === 2 && back2.field === 'company',
            back2
        );

        // ? on a column header: Alt+ArrowUp from its filter
        await (await filter(page, 'company')).click();
        await page.keyboard.press('Alt+ArrowUp');
        await page.waitForTimeout(50);
        check('the column header has the focus', (await focus(page)).label);
        await page.keyboard.type('?');
        await page.waitForTimeout(100);
        check('? on a column header opens it', await helpOpen(page));
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
        check('Esc: the focus back on the column header', (await focus(page)).label && !(await helpOpen(page)));

        // the header menu, with the mouse: the focus on the dialog
        await page.click(`${GRID} [data-attribute-header="company"]`, { button: 'right' });
        await page.waitForSelector('[data-menu-id="header.shortcuts"]');
        const entry = await page.$eval('[data-menu-id="header.shortcuts"]', (e) => e.textContent.replace(/\s+/g, ' ').trim());
        check('the header menu: Keyboard shortcuts… (Ctrl+/)', entry === 'Keyboard shortcuts… (Ctrl+/)', entry);
        await page.click('[data-menu-id="header.shortcuts"]');
        await page.waitForTimeout(100);
        check(
            'its click opens it, the focus on the dialog',
            (await helpOpen(page)) && (await focus(page)).dialog,
            await focus(page)
        );
        await page.click(`${DIALOG} .filter-editor-close`);
        await page.waitForTimeout(100);
        check('the ✕ closes it', !(await helpOpen(page)));

        // shortcutHelp: false
        await gi(page, 'updateConfig({ readonly: true, shortcutHelp: false })');
        await (await cell(page, 2, 'company')).click();
        await page.keyboard.type('?');
        await page.keyboard.press('Control+Slash');
        await page.waitForTimeout(100);
        check('shortcutHelp: false: neither ? nor Ctrl+/ opens it', !(await helpOpen(page)));
        await page.context().close();
    }

    // ---------------------------------------------------------------- the looks
    for (const [name, options] of [
        ['dark', { theme: 'dark' }],
        ['tredespace-light', { theme: 'light', gridTheme: 'tredespace' }],
        ['tredespace-dark', { theme: 'dark', gridTheme: 'tredespace' }]
    ]) {
        const page = await open(name, options);
        await (await cell(page, 0, 'company')).click();
        await page.keyboard.press('Control+Slash');
        await page.waitForTimeout(150);
        const l = await look(page);
        check(
            `${name}: open, in the window, square`,
            (await helpOpen(page)) && l.inWindow && l.radius.every((r) => r === '0px'),
            l
        );
        check(
            `${name}: text 4.5:1, keys 4.5:1, the frame of a key 3:1`,
            l.textContrast >= 4.5 && l.keyContrast >= 4.5 && l.keyFrame >= 3,
            l
        );
        await shot(page, `help-${name}.png`);
        await page.context().close();
    }

    // ---------------------------------------------------------------- a Mac
    {
        const page = await open('mac', { mac: true });
        await (await cell(page, 0, 'company')).click();
        await page.keyboard.press('Meta+Slash');
        await page.waitForTimeout(150);
        check('a Mac: Cmd+/ opens it', await helpOpen(page));
        const mac = await rows(page);
        const keysOf = (does) => mac.find((r) => r.does === does)?.keys;
        check('a Mac: Redo ⌘Y / ⇧⌘Z', keysOf('Redo') === '⌘Y / ⇧⌘Z', keysOf('Redo'));
        check(
            'a Mac: ⌥⇧Home / ⌥⇧End, ⌘Home',
            keysOf('The range to the first / last cell of the row') === '⌥⇧Home / ⌥⇧End' &&
                keysOf('The first / last cell of the grid') === '⌘Home / ⌘End'
        );
        check('a Mac: no Alt+C', !keysOf('Match case on or off'));
        check(
            'a Mac: the hint says ⌥',
            (await page.$eval(`${DIALOG} .shortcut-help-hint`, (h) => h.textContent)).includes('With ⌥')
        );
        await shot(page, 'help-mac.png');
        await page.keyboard.press('Escape');
        await page.click(`${GRID} [data-attribute-header="company"]`, { button: 'right' });
        await page.waitForSelector('[data-menu-id="header.shortcuts"]');
        const entry = await page.$eval('[data-menu-id="header.shortcuts"]', (e) => e.textContent.replace(/\s+/g, ' ').trim());
        check('a Mac: the menu hint (⌘/)', entry.endsWith('(⌘/)'), entry);
        await page.context().close();
    }

    // ---------------------------------------------------------------- a phone
    {
        const page = await open('phone', { phone: true });
        await page.tap(`${GRID} .simple-html-grid-col-cell input`);
        await gi(page, 'openShortcutHelp()');
        await page.waitForTimeout(200);
        const l = await look(page);
        check('a phone: open, as wide as the window', (await helpOpen(page)) && l.inWindow && l.width === 390, l);
        check('a phone: its list scrolls, nothing sideways', l.scrolls && !l.sideways, l);
        check('a phone: the focus on the dialog, no keyboard', (await focus(page)).dialog, await focus(page));
        await shot(page, 'help-phone.png');
        if (shots) {
            await page.screenshot({ path: path.join(shots, 'help-phone-page.png') });
        }
        await page.tap(`${DIALOG} .filter-editor-close`);
        await page.waitForTimeout(150);
        check('a phone: a tap on the ✕ closes it', !(await helpOpen(page)));
        await page.context().close();
    }

    await browser.close();
    check('no page errors', errors.length === 0, errors);
    console.log(results.join('\n'));
    const failed = results.filter((r) => r.startsWith('FAIL')).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})();
