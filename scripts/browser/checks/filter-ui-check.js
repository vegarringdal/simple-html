// Real browser check of the filter menu's value list and the filter editor (#sample/filtering), light
// and dark: the look (frames, no rounded corners, the counts on the right, the list scrolls, nothing of
// the editor outside its dialog - at its default width and at its smallest), "Select all" checked /
// mixed / unchecked (the accessibility tree), the keyboard through both, and screenshots.
// Usage: node filter-ui-check.js <site url> <shots dir>
const path = require('node:path');
const fs = require('node:fs');
const [, , base, shots] = process.argv;
if (!base || !shots) {
    console.log('usage: node filter-ui-check.js <site url> <shots dir>');
    process.exit(2);
}
const { chromium } = require('playwright');
fs.mkdirSync(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);

/** three nested groups under the root, a few conditions, one compares with another column, one IN */
const NESTED = {
    group: 'AND',
    children: [
        { field: 'country', operator: 'EQUAL', value: 'Norway' },
        { field: 'age', operator: 'LESS_THAN', value: 30 },
        {
            group: 'OR',
            children: [
                { field: 'balance', operator: 'GREATER_THAN', value: 2500 },
                { field: 'company', operator: 'NOT_EQUAL_TO', valueField: 'country' },
                {
                    group: 'AND',
                    children: [
                        { field: 'favoriteFruit', operator: 'IN', value: ['apple', 'banana'] },
                        {
                            group: 'OR',
                            children: [
                                { field: 'isActive', operator: 'EQUAL', value: true },
                                { field: 'company', operator: 'CONTAINS', value: 'a' }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
};

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];
    for (const dark of [false, true]) {
        const theme = dark ? 'dark' : 'light';
        const page = await browser.newPage({ viewport: { width: 1300, height: 1400 }, deviceScaleFactor: 2 });
        page.on('pageerror', (e) => errors.push(String(e)));
        page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
        await page.addInitScript((d) => localStorage.setItem('simple-html-demo-theme', d ? 'dark' : 'light'), dark);
        await page.goto(`${base}#sample/filtering`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
        await page.waitForTimeout(300);

        const active = () =>
            page.evaluate(() => {
                const a = document.activeElement;
                if (!a) return null;
                if (a.matches('.simple-html-grid-value-row input')) {
                    return `checkbox:${a.closest('label').querySelector('.simple-html-grid-value-text').textContent.trim()}`;
                }
                return `${a.tagName.toLowerCase()}:${a.getAttribute('aria-label') ?? a.getAttribute('data-menu-id') ?? a.textContent.trim()}`;
            });
        const menuOpen = () => page.evaluate(() => !!document.querySelector('.simple-html-grid-menu'));
        const footer = () =>
            page.evaluate(() =>
                document
                    .querySelector('.stage simple-html-grid .simple-html-grid-footer, .stage simple-html-grid [class*="footer"]')
                    ?.textContent.replace(/\s+/g, ' ')
                    .trim()
            );
        const filterOf = () =>
            page.evaluate(() =>
                JSON.stringify(document.querySelector('.stage simple-html-grid').grid.gridInterface.getDatasource().getFilter())
            );
        const clearFilter = () =>
            page.evaluate(() =>
                document.querySelector('.stage simple-html-grid').grid.gridInterface.getDatasource().filter(null)
            );
        const countryFilter = page.locator('.stage input[aria-label="Filter Country"]').first();

        // ---- 1. the value list, opened with the mouse
        await countryFilter.click({ button: 'right' });
        await page.waitForTimeout(200);
        await page.mouse.move(5, 1390);
        await page.waitForTimeout(100);
        const look = await page.evaluate(() => {
            const list = document.querySelector('[data-menu-id="filter.values"]');
            const menu = list.closest('.simple-html-grid-popover');
            const search = list.querySelector('.simple-html-grid-value-search');
            const all = list.querySelector('.simple-html-grid-value-all');
            const box = list.querySelector('.simple-html-grid-value-box');
            const rows = Array.from(list.querySelectorAll('.simple-html-grid-value-scroll .simple-html-grid-value-row'));
            const s = getComputedStyle(search);
            const rowRect = rows[0].getBoundingClientRect();
            const countRect = rows[0].querySelector('.simple-html-grid-value-count').getBoundingClientRect();
            const textRect = rows[0].querySelector('.simple-html-grid-value-text').getBoundingClientRect();
            const radii = Array.from(menu.querySelectorAll('*'))
                .filter((el) => !(el instanceof HTMLInputElement && el.type === 'checkbox'))
                .map((el) => getComputedStyle(el).borderRadius)
                .filter((r) => r !== '0px');
            return {
                menuWidth: Math.round(menu.getBoundingClientRect().width),
                searchFrame: `${s.borderTopWidth} ${s.borderTopStyle}`,
                searchAlign: s.textAlign,
                searchFill:
                    Math.round(search.getBoundingClientRect().width) === Math.round(list.getBoundingClientRect().width - 16),
                info: list.querySelector('.simple-html-grid-value-info').textContent.trim(),
                allBg: getComputedStyle(all).backgroundColor,
                boxBg: getComputedStyle(box).backgroundColor,
                countRightGap: Math.round(rowRect.right - countRect.right),
                countLeftOfText: countRect.left > textRect.right - 1,
                countOpacity: getComputedStyle(rows[0].querySelector('.simple-html-grid-value-count')).opacity,
                countText: rows[0].querySelector('.simple-html-grid-value-count').textContent.trim(),
                accent: getComputedStyle(rows[0].querySelector('input')).accentColor,
                radii,
                menuInnerWidth: Math.round(menu.querySelector('.simple-html-grid-menu').clientWidth)
            };
        });
        check(`${theme} value list: the menu at least 220px wide`, look.menuWidth >= 220, `${look.menuWidth}px`);
        check(
            `${theme} value list: the search box framed, text from the left, full width`,
            look.searchFrame === '1px solid' && look.searchAlign === 'left' && look.searchFill,
            `${look.searchFrame} ${look.searchAlign} ${look.searchFill}`
        );
        check(`${theme} value list: "10 values" (the values, not the rows)`, look.info === '10 values', look.info);
        check(
            `${theme} value list: Select all not lit without the pointer`,
            look.allBg === 'rgba(0, 0, 0, 0)' || look.allBg === look.boxBg,
            `${look.allBg} / box ${look.boxBg}`
        );
        check(
            `${theme} value list: the count on the right, quiet, no parentheses`,
            look.countRightGap <= 8 && look.countLeftOfText && look.countOpacity === '0.7' && /^\d+$/.test(look.countText),
            JSON.stringify(look)
        );
        check(
            `${theme} value list: checkboxes in the accent colour`,
            look.accent === (dark ? 'rgb(147, 197, 253)' : 'rgb(37, 99, 235)'),
            look.accent
        );
        check(
            `${theme} value list: no rounded corners in the menu (checkboxes are the browser's)`,
            look.radii.length === 0,
            look.radii.join(' ')
        );
        // the line over Advanced Filter… in the Filter submenu: across it, not a dot
        await page.locator('[data-menu-id="filter.filter"]').click();
        await page.waitForTimeout(100);
        const line = await page.evaluate(() => {
            const sub = document.querySelectorAll('.simple-html-grid-menu[role="menu"]')[1];
            return {
                hrs: Array.from(sub.querySelectorAll('hr.hr-dashed'), (hr) => Math.round(hr.getBoundingClientRect().width)),
                width: sub.clientWidth
            };
        });
        check(
            `${theme} the menus' separators are lines across the menu, not dots`,
            line.hrs.length === 1 && line.hrs[0] === line.width,
            `${line.hrs} / ${line.width}`
        );
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
        await countryFilter.click({ button: 'right' });
        await page.waitForTimeout(200);

        // hover: Select all lit like a menu item
        await page.locator('.simple-html-grid-value-all').hover();
        await page.waitForTimeout(50);
        const hoverBg = await page.evaluate(
            () => getComputedStyle(document.querySelector('.simple-html-grid-value-all')).backgroundColor
        );
        check(
            `${theme} value list: Select all lit under the pointer`,
            hoverBg === (dark ? 'rgb(39, 78, 143)' : 'rgb(175, 199, 219)'),
            hoverBg
        );
        await page.mouse.move(5, 1390);

        // tri-state, in the accessibility tree too
        const selectAllState = async () => {
            const snap = await page.accessibility.snapshot({ interestingOnly: true });
            let found = null;
            const walk = (n) => {
                if (n.role === 'checkbox' && n.name === 'Select all') found = String(n.checked);
                for (const c of n.children ?? []) walk(c);
            };
            walk(snap);
            const dom = await page.evaluate(() => {
                const i = document.querySelector('.simple-html-grid-value-all input');
                return `${i.checked}/${i.indeterminate}`;
            });
            return `${dom} a11y:${found}`;
        };
        check(`${theme} Select all: all checked`, (await selectAllState()) === 'true/false a11y:true', await selectAllState());
        await page.locator('.simple-html-grid-value-row', { hasText: 'DENMARK' }).click();
        await page.waitForTimeout(50);
        check(
            `${theme} Select all: one unchecked - mixed`,
            (await selectAllState()) === 'false/true a11y:mixed',
            await selectAllState()
        );
        await page.mouse.move(5, 1390);
        await page.screenshot({
            path: `${shots}/after-value-list-mixed-${theme}.png`,
            clip: await clip(page, '.simple-html-grid-popover')
        });
        await page.locator('.simple-html-grid-value-all').click();
        check(
            `${theme} Select all: a click on mixed checks all`,
            (await selectAllState()) === 'true/false a11y:true',
            await selectAllState()
        );
        await page.locator('.simple-html-grid-value-all').click();
        check(
            `${theme} Select all: a click on checked unchecks all`,
            (await selectAllState()) === 'false/false a11y:false',
            await selectAllState()
        );
        // the value checkboxes are named by their row
        const names = await page.evaluate(
            async () => Array.from(document.querySelectorAll('.simple-html-grid-value-scroll input')).length
        );
        const snap = await page.accessibility.snapshot({ interestingOnly: true });
        const boxes = [];
        const walk = (n) => {
            if (n.role === 'checkbox') boxes.push(n.name);
            if (n.role === 'textbox') boxes.push(`textbox:${n.name}`);
            if (n.role === 'button') boxes.push(`button:${n.name}`);
            for (const c of n.children ?? []) walk(c);
        };
        walk(snap);
        check(
            `${theme} value list a11y: the search box, every checkbox and the buttons named`,
            boxes.includes('textbox:Search values') &&
                boxes.some((b) => b.toUpperCase() === 'DENMARK 44') &&
                boxes.includes('button:Apply') &&
                boxes.includes('button:Cancel') &&
                boxes.filter((b) => /^[A-Za-z]+ \d+$/.test(b)).length === names,
            boxes.slice(boxes.indexOf('textbox:Search values')).join(' | ')
        );
        await page.locator('.simple-html-grid-value-buttons button', { hasText: 'Cancel' }).click();
        await page.waitForTimeout(100);
        check(`${theme} Cancel closes it, no filter`, !(await menuOpen()) && (await filterOf()) === 'null', await filterOf());

        // a long list: phone has 500 values, 100 shown, the list scrolls inside the menu
        await page.locator('.stage input[aria-label="Filter Phone"]').first().click({ button: 'right' });
        await page.waitForTimeout(200);
        const long = await page.evaluate(() => {
            const scroll = document.querySelector('.simple-html-grid-value-scroll');
            const menu = scroll.closest('.simple-html-grid-popover');
            return {
                h: Math.round(scroll.getBoundingClientRect().height),
                scrolls: scroll.scrollHeight > scroll.clientHeight,
                menuH: Math.round(menu.getBoundingClientRect().height),
                info: document.querySelector('.simple-html-grid-value-info').textContent.trim(),
                warning: getComputedStyle(document.querySelector('.simple-html-grid-value-warning')).color,
                counts: document.querySelectorAll('.simple-html-grid-value-count').length
            };
        });
        check(
            `${theme} a long list scrolls in a box of its own, the menu stays short`,
            long.h <= 244 && long.scrolls && long.menuH < 520,
            JSON.stringify(long)
        );
        check(
            `${theme} cut off: the warning, no counts`,
            long.info === 'Only the first 100 values are shown' &&
                long.counts === 0 &&
                long.warning === (dark ? 'rgb(252, 165, 165)' : 'rgb(255, 0, 0)'),
            JSON.stringify(long)
        );
        await page.screenshot({
            path: `${shots}/after-value-list-long-${theme}.png`,
            clip: await clip(page, '.simple-html-grid-popover')
        });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);

        // ---- 2. the value list from the keyboard
        await countryFilter.focus();
        await page.keyboard.press('Shift+F10');
        await page.waitForTimeout(150);
        check(`${theme} keyboard: Shift+F10, the focus on Filter ›`, (await active()) === 'div:filter.filter', await active());
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(50);
        const inFilter = await page.evaluate(() =>
            Array.from(document.querySelectorAll('.simple-html-grid-menu[role="menu"]')[1]?.children ?? [], (c) =>
                c.getAttribute('data-menu-id')
            ).join(',')
        );
        check(
            `${theme} keyboard: ArrowRight into Filter ›: Operator ›, Match case, Filter as you type, Blank ›, Clear, Clear all, a line, Advanced`,
            (await active()) === 'div:filter.operator' &&
                inFilter ===
                    'filter.operator,filter.matchCase,filter.filterOnType,filter.filter.blank,filter.filter.clear,filter.filter.clearAll,filter.filter.advancedSeparator,filter.filter.advanced',
            `${await active()} ${inFilter}`
        );
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(50);
        check(
            `${theme} keyboard: ArrowRight again: the operator submenu, the focus in it`,
            (await active()).startsWith('div:filter.operator.'),
            await active()
        );
        await page.screenshot({
            path: `${shots}/after-filter-submenu-${theme}.png`,
            clip: await clip(page, '.simple-html-grid-popover', 12)
        });
        const fullShot = await page.evaluate(() => {
            const rects = Array.from(document.querySelectorAll('.simple-html-grid-menu[role="menu"]'), (m) =>
                m.getBoundingClientRect()
            );
            const left = Math.min(...rects.map((r) => r.left));
            const top = Math.min(...rects.map((r) => r.top));
            return {
                x: left - 12,
                y: top - 12,
                width: Math.max(...rects.map((r) => r.right)) - left + 24,
                height: Math.max(...rects.map((r) => r.bottom)) - top + 24
            };
        });
        await page.screenshot({ path: `${shots}/after-filter-submenu-open-${theme}.png`, clip: fullShot });
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');
        check(`${theme} keyboard: ArrowLeft twice: back on Filter ›`, (await active()) === 'div:filter.filter', await active());
        await page.keyboard.press('Tab');
        check(`${theme} keyboard: Tab into the search box`, (await active()) === 'input:Search values', await active());
        await page.keyboard.type('NOR');
        await page.waitForTimeout(50);
        const narrowed = await page.evaluate(() => [
            document.querySelector('.simple-html-grid-value-info').textContent.trim(),
            Array.from(document.querySelectorAll('.simple-html-grid-value-scroll .simple-html-grid-value-text'), (t) =>
                t.textContent.trim()
            ).join(',')
        ]);
        check(
            `${theme} keyboard: typing narrows the list`,
            narrowed[0] === '1 value' && narrowed[1].toUpperCase() === 'NORWAY',
            narrowed.join(' ')
        );
        await page.keyboard.press('Backspace');
        await page.keyboard.press('Backspace');
        await page.keyboard.press('Backspace');
        await page.keyboard.press('ArrowDown');
        check(
            `${theme} keyboard: ArrowDown from the search box to Select all`,
            (await active()) === 'input:' || (await active()).startsWith('checkbox:Select all'),
            await active()
        );
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        check(
            `${theme} keyboard: ArrowDown to the second value`,
            (await active())?.toUpperCase() === 'CHECKBOX:FINLAND',
            await active()
        );
        await page.keyboard.press('Space');
        const finlandOff = await page.evaluate(
            () =>
                Array.from(document.querySelectorAll('.simple-html-grid-value-scroll .simple-html-grid-value-row'))
                    .find((r) => r.textContent.toUpperCase().includes('FINLAND'))
                    .querySelector('input').checked
        );
        const lit = await page.evaluate(() => getComputedStyle(document.activeElement.closest('label')).backgroundColor);
        check(
            `${theme} keyboard: Space unchecks it, its row lit as a menu item`,
            finlandOff === false && lit === (dark ? 'rgb(39, 78, 143)' : 'rgb(175, 199, 219)'),
            `${finlandOff} ${lit}`
        );
        const ring = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
        check(`${theme} keyboard: the checkbox has the focus outline`, ring === 'solid', ring);
        await page.screenshot({
            path: `${shots}/after-value-list-keyboard-${theme}.png`,
            clip: await clip(page, '.simple-html-grid-popover')
        });
        // Tab past the other checkboxes to Cancel, then Apply
        let guard = 0;
        while (!(await active()).startsWith('button:') && guard++ < 20) {
            await page.keyboard.press('Tab');
        }
        check(`${theme} keyboard: Tab from the checkboxes to Cancel`, (await active()) === 'button:Cancel', await active());
        await page.keyboard.press('Tab');
        check(`${theme} keyboard: then Apply`, (await active()) === 'button:Apply', await active());
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
        const applied = await filterOf();
        check(
            `${theme} keyboard: Enter on Apply (the browser's button) filters, the menu closes, the focus back on the filter`,
            !(await menuOpen()) &&
                applied.includes('NOT_IN') &&
                applied.toUpperCase().includes('FINLAND') &&
                (await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))) === 'Filter Country',
            applied
        );
        // Space on Apply, and Enter on a checkbox
        await page.keyboard.press('Shift+F10');
        await page.waitForTimeout(150);
        const opened = await page.evaluate(() => {
            const i = document.querySelector('.simple-html-grid-value-all input');
            return `${i.checked}/${i.indeterminate}`;
        });
        check(`${theme} reopened with FINLAND filtered away: Select all mixed`, opened === 'false/true', opened);
        await page.keyboard.press('Tab');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        check(`${theme} keyboard: on FINLAND, unchecked`, (await active())?.toUpperCase() === 'CHECKBOX:FINLAND', await active());
        await page.keyboard.press('Space');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
        check(
            `${theme} keyboard: Enter on a checkbox applies: every value back`,
            !(await menuOpen()) && !(await filterOf()).toUpperCase().includes('FINLAND'),
            await filterOf()
        );
        await page.keyboard.press('Shift+F10');
        await page.waitForTimeout(150);
        await page.keyboard.press('Tab');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
        check(
            `${theme} keyboard: Esc in the search box closes the menu, the focus back on the filter`,
            !(await menuOpen()) &&
                (await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))) === 'Filter Country'
        );
        await clearFilter();
        await page.waitForTimeout(100);

        // ---- 3. the filter editor, three nested groups
        await page.evaluate((filter) => {
            const gi = document.querySelector('.stage simple-html-grid').grid.gridInterface;
            gi.getDatasource().filter(filter);
            gi.openFilterEditor();
        }, NESTED);
        await page.waitForTimeout(300);
        check(
            `${theme} editor: the focus on the dialog itself when it opens`,
            await page.evaluate(() => document.activeElement?.matches('dialog.filter-editor-content'))
        );

        /** every element of the dialog outside it (its rect past the dialog's), and the dialog's height */
        const overflow = () =>
            page.evaluate(() => {
                const dialog = document.querySelector('dialog.filter-editor-content');
                const body = dialog.querySelector('.filter-editor-body');
                const d = dialog.getBoundingClientRect();
                const b = body.getBoundingClientRect();
                const out = [];
                for (const el of dialog.querySelectorAll('*')) {
                    if (el.closest('.simple-html-resize-handle') || (el.closest('svg') !== null && el.tagName !== 'svg'))
                        continue;
                    const r = el.getBoundingClientRect();
                    if (r.width === 0 && r.height === 0) continue;
                    // left and right: in the dialog. In the body: also in the body (it scrolls up and down)
                    const box = body.contains(el) ? b : d;
                    if (r.left < box.left - 0.5 || r.right > box.right + 0.5) {
                        out.push(
                            `${el.tagName}.${el.className?.baseVal ?? el.className} ${Math.round(r.left)}-${Math.round(r.right)} in ${Math.round(box.left)}-${Math.round(box.right)}`
                        );
                    }
                }
                return {
                    out,
                    height: Math.round(d.height),
                    width: Math.round(d.width),
                    bodyScroll: body.scrollWidth > body.clientWidth
                };
            });
        let o = await overflow();
        check(
            `${theme} editor 650px: nothing outside the dialog, no sideways scroll`,
            o.out.length === 0 && !o.bodyScroll,
            `${o.width}px ${o.out.slice(0, 3).join(' | ')}`
        );
        check(`${theme} editor: as high as what is in it`, o.height < 1400 - 40 && o.height > 300, `${o.height}px`);

        // each condition one line at the default width
        const lines = await page.evaluate(() =>
            Array.from(document.querySelectorAll('.filter-editor-condition')).map(
                (row) => new Set(Array.from(row.children, (c) => Math.round(c.getBoundingClientRect().top))).size
            )
        );
        check(
            `${theme} editor: every condition on one line`,
            lines.every((n) => n === 1),
            lines.join(',')
        );
        const radii = await page.evaluate(() =>
            Array.from(document.querySelectorAll('dialog.filter-editor-content, dialog.filter-editor-content *'))
                .map((el) => getComputedStyle(el).borderRadius)
                .filter((r) => r !== '0px')
        );
        check(`${theme} editor: no rounded corners`, radii.length === 0, radii.join(' '));
        const colours = await page.evaluate(() => {
            const pressed = document.querySelector('.filter-editor-segment-button[aria-pressed="true"]');
            const primary = document.querySelector('.filter-editor-footer .simple-html-grid-button-primary');
            const pick = document.querySelector('.filter-editor-pick');
            return {
                pressed: getComputedStyle(pressed).backgroundColor,
                primary: getComputedStyle(primary).backgroundColor,
                pickBorder: getComputedStyle(pick).borderTopColor,
                pickChevron: getComputedStyle(pick, '::after').borderRightStyle
            };
        });
        const accent = dark ? 'rgb(147, 197, 253)' : 'rgb(37, 99, 235)';
        check(
            `${theme} editor: the AND/OR in use and the primary button in the accent colour, the pickers framed with a chevron`,
            colours.pressed === accent &&
                colours.primary === accent &&
                colours.pickBorder === (dark ? 'rgb(156, 163, 175)' : 'rgb(140, 140, 140)') &&
                colours.pickChevron === 'solid',
            JSON.stringify(colours)
        );

        // the accessibility tree of the editor
        const tree = await page.accessibility.snapshot({ interestingOnly: true });
        const named = [];
        let dialogName = null;
        const walkEditor = (n) => {
            if (n.role === 'dialog') dialogName = n.name;
            if (['button', 'textbox', 'combobox'].includes(n.role))
                named.push(
                    `${n.role}:${n.name}${n.pressed !== undefined ? `:pressed=${n.pressed}` : ''}${n.haspopup ? `:popup=${n.haspopup}` : ''}`
                );
            for (const c of n.children ?? []) walkEditor(c);
        };
        walkEditor(tree);
        const unnamed = named.filter((n) => /:$|::/.test(n) || n.endsWith(':'));
        check(`${theme} editor a11y: the dialog named by its title`, dialogName === 'Filter Editor', dialogName);
        check(
            `${theme} editor a11y: the pickers, the AND/OR toggles, the icons and the value inputs named`,
            unnamed.length === 0 &&
                named.includes('button:Field: Country:popup=menu') &&
                named.includes('button:Operator: Equal:popup=menu') &&
                named.includes('button:Value: Country:popup=menu') &&
                named.includes('button:AND:pressed=true') &&
                named.includes('button:OR:pressed=false') &&
                named.includes('button:Delete this condition') &&
                named.includes('textbox:Value'),
            named.slice(0, 16).join(' | ')
        );

        // narrow: the smallest the dialog can be
        await page.evaluate(() => {
            const dialog = document.querySelector('dialog.filter-editor-content');
            dialog.style.width = '200px';
        });
        await page.waitForTimeout(100);
        o = await overflow();
        check(
            `${theme} editor at its smallest (${o.width}px): nothing outside the dialog, no sideways scroll`,
            o.width === 360 && o.out.length === 0 && !o.bodyScroll,
            o.out.slice(0, 3).join(' | ')
        );
        await page.screenshot({
            path: `${shots}/after-filter-editor-narrow-check-${theme}.png`,
            clip: await clip(page, 'dialog.filter-editor-content', 20)
        });
        await page.evaluate(() => {
            document.querySelector('dialog.filter-editor-content').style.width = '480px';
        });
        await page.waitForTimeout(100);
        o = await overflow();
        check(
            `${theme} editor at 480px: nothing outside the dialog`,
            o.out.length === 0 && !o.bodyScroll,
            o.out.slice(0, 3).join(' | ')
        );
        await page.evaluate(() => {
            document.querySelector('dialog.filter-editor-content').style.width = '';
        });

        // deeper: three more levels, each a condition. Still nothing outside
        await page.evaluate(() => {
            for (let i = 0; i < 3; i++) {
                const groups = document.querySelectorAll('.filter-editor-group');
                const last = groups[groups.length - 1];
                last.querySelector('.filter-editor-group-header .filter-editor-add:nth-of-type(2)').click();
            }
        });
        await page.waitForTimeout(100);
        o = await overflow();
        const depth = await page.evaluate(() => document.querySelectorAll('.filter-editor-group').length);
        check(
            `${theme} editor with ${depth} levels: nothing outside the dialog`,
            depth === 7 && o.out.length === 0 && !o.bodyScroll,
            o.out.slice(0, 3).join(' | ')
        );
        const inWindow = await page.evaluate(
            () => document.querySelector('dialog.filter-editor-content').getBoundingClientRect().bottom <= innerHeight
        );
        check(`${theme} editor: grown, still in the window`, inWindow);

        // ---- 4. the editor from the keyboard: Tab order, the operator picker, the field picker
        await page.evaluate(
            (filter) => {
                const gi = document.querySelector('.stage simple-html-grid').grid.gridInterface;
                gi.getDatasource().filter(filter);
                gi.openFilterEditor();
            },
            { group: 'AND', children: [{ field: 'age', operator: 'EQUAL', value: 30 }] }
        );
        await page.waitForTimeout(200);
        await page.evaluate(() => document.querySelector('dialog.filter-editor-content').focus());
        const order = [];
        for (let i = 0; i < 17; i++) {
            await page.keyboard.press('Tab');
            order.push(await active());
        }
        check(
            `${theme} editor keyboard: the Tab order`,
            order.join(' > ') ===
                [
                    'button:Close without filtering',
                    'button:AND',
                    'button:OR',
                    'button:+ Condition',
                    'button:+ Group',
                    'button:Wrap everything in this group inside a new parent group',
                    'button:Clear all conditions',
                    'button:Field: Age',
                    'button:Operator: Equal',
                    'input:Value',
                    'button:Compare against another column instead of a typed in value',
                    'button:Delete this condition',
                    'button:Undo',
                    'button:Redo',
                    'button:Cancel',
                    'button:Apply',
                    'button:Apply & close'
                ].join(' > '),
            order.join(' > ')
        );
        // Space on OR
        await page.locator('.filter-editor-segment-button', { hasText: 'OR' }).focus();
        await page.keyboard.press('Space');
        const orPressed = await page.evaluate(() =>
            document.querySelector('.filter-editor-segment-button:nth-child(2)').getAttribute('aria-pressed')
        );
        check(
            `${theme} editor keyboard: Space on OR makes the group OR`,
            orPressed === 'true' && (await active()) === 'button:OR',
            `${orPressed} ${await active()}`
        );
        await page.locator('.filter-editor-segment-button', { hasText: 'AND' }).focus();
        await page.keyboard.press('Enter');

        // the operator picker
        await page.locator('.filter-editor-pick-operator').focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
        check(
            `${theme} editor keyboard: Enter on the operator picker opens its menu, the focus on its first item`,
            (await active()) === 'div:filterEditor.operator.EQUAL',
            await active()
        );
        await page.screenshot({
            path: `${shots}/after-operator-picker-${theme}.png`,
            clip: await clip(page, 'dialog.filter-editor-content', 20)
        });
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
        // the operators of a number: Equal, Not Equal To, Less Than ... (operatorsFor)
        check(
            `${theme} editor keyboard: ArrowDown, Enter picks it, the focus back on the picker`,
            (await active()) === 'button:Operator: Less Than' && !(await menuOpen()),
            await active()
        );
        // the field picker: the search
        await page.locator('.filter-editor-pick-field').focus();
        await page.keyboard.press('Space');
        await page.waitForTimeout(150);
        check(
            `${theme} editor keyboard: Space on the field picker, the focus in its search box`,
            (await active()) === 'input:Search fields',
            await active()
        );
        await page.keyboard.type('bal');
        await page.waitForTimeout(50);
        const shownFields = await page.evaluate(() =>
            Array.from(document.querySelectorAll('.simple-html-grid-menu [role^="menuitem"]'))
                .filter((i) => !i.hidden)
                .map((i) => i.textContent.trim())
                .join(',')
        );
        check(`${theme} editor keyboard: the search hides the other fields`, shownFields === 'Balance', shownFields);
        await page.screenshot({
            path: `${shots}/after-field-picker-${theme}.png`,
            clip: await clip(page, 'dialog.filter-editor-content', 20)
        });
        await page.keyboard.press('ArrowDown');
        check(
            `${theme} editor keyboard: ArrowDown to the field`,
            (await active()).startsWith('div:filterEditor.field.balance'),
            await active()
        );
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
        check(`${theme} editor keyboard: Enter picks it`, (await active()) === 'button:Field: Balance', await active());
        // Esc: the picker first, then the editor
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
        const afterEsc = await page.evaluate(() => [
            !!document.querySelector('.simple-html-grid-menu'),
            !!document.querySelector('dialog.filter-editor-content[open]')
        ]);
        check(`${theme} editor keyboard: Esc closes the picker only`, afterEsc.join() === 'false,true', afterEsc.join());
        // the last condition deleted from the keyboard: the focus on the dialog
        await page.locator('.filter-editor-condition .filter-editor-icon').nth(1).focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(100);
        check(
            `${theme} editor keyboard: the condition deleted, the focus on the dialog`,
            await page.evaluate(() => document.activeElement?.matches('dialog.filter-editor-content'))
        );
        const empty = await page.evaluate(() => [
            document.querySelector('.filter-editor-empty')?.textContent.trim(),
            Math.round(document.querySelector('dialog.filter-editor-content').getBoundingClientRect().height)
        ]);
        check(
            `${theme} editor: empty, the hint, a short dialog`,
            empty[0] === 'No conditions: every row is shown' && empty[1] <= 220,
            empty.join(' ')
        );
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
        check(
            `${theme} editor keyboard: Esc closes the editor`,
            !(await page.evaluate(() => !!document.querySelector('dialog.filter-editor-content')))
        );
        await page.close();
    }
    check('no page errors', errors.length === 0, errors.join(' / '));
    await browser.close();
    console.log(results.join('\n'));
    const failed = results.filter((r) => r.startsWith('FAIL')).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch((e) => {
    console.error(e);
    process.exit(1);
});

/** the rect of an element with a margin, for a clipped screenshot */
async function clip(page, selector, margin = 12) {
    const r = await page.evaluate((s) => {
        const el = document.querySelector(s);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { x: b.left, y: b.top, width: b.width, height: b.height };
    }, selector);
    if (!r) return undefined;
    return {
        x: Math.max(0, r.x - margin),
        y: Math.max(0, r.y - margin),
        width: r.width + 2 * margin,
        height: r.height + 2 * margin
    };
}
