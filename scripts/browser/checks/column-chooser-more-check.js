// Real browser check of the column chooser (contextMenuColumnChooser.ts) on the "Full grid" sample
// (#sample/full-grid), in the looks default and TreDeSpace, light and dark:
// - the search framed as an input: the controls' frame, the inputs' background, a magnifying glass, the
//   placeholder Search, the focus outline on its frame; square
// - it finds a column by its label (a label of the user's too) and by its field name (countryCode ->
//   Country); the list in the order of the labels
// - a drag handle at the left of every field (the six dots of the Detail form tab's handles); a field
//   dragged with the mouse into the header is a new column there; the handle's tooltip gone after it
// - the ✎ of a field: shown under the pointer, a click turns the label into an input with the label and
//   the focus; typed + Enter: the header shows the label (state formats.<field>.label), the focus back on
//   the ✎; Esc leaves it; empty gives the column its own label; the keyboard: Tab from the search to a ✎,
//   Enter opens the input
// - a phone (390x844, touch): the ✎ always shown, 24px; a tap on it, a label typed, Enter
// Screenshots of each look.
//
// Usage: node column-chooser-more-check.js <site url> [screenshot dir]
const path = require('node:path');
const fs = require('node:fs');
const [, , base, shots] = process.argv;
if (!base) {
    console.log('usage: node column-chooser-more-check.js <site url> [screenshot dir]');
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
const CHOOSER = '.simple-html-grid-column-chooser';

/** in the page: the colour a variable gives, read from a probe in the element */
const PROBE_FN = `
    window.__varColour = (element, variable, property = 'borderTopColor') => {
        const probe = document.createElement('div');
        probe.style.cssText = 'position:absolute;width:0;height:0;border:1px solid var(' + variable + ');background-color:var(' + variable + ')';
        element.appendChild(probe);
        const colour = getComputedStyle(probe)[property];
        probe.remove();
        return colour;
    };
`;

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];
    const looks = [
        { theme: 'light', grid: 'default' },
        { theme: 'dark', grid: 'default' },
        { theme: 'light', grid: 'tredespace' },
        { theme: 'dark', grid: 'tredespace' }
    ];

    /** the header menu of a label opened by a contextmenu event, then Column chooser… */
    const openChooser = async (page, field, tap = false) => {
        await page.evaluate(
            ([g, f]) => {
                const label = document.querySelector(`${g} [data-attribute-header="${f}"]`);
                const r = label.getBoundingClientRect();
                label.dispatchEvent(
                    new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 20, clientY: r.top + 5 })
                );
            },
            [GRID, field]
        );
        const entry = page.locator('[data-menu-id="header.column.chooser"]');
        if (tap) {
            const box = await entry.boundingBox();
            await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        } else {
            await entry.click();
        }
        await page.waitForSelector(CHOOSER);
        await page.waitForTimeout(100);
    };
    const chooserLabels = (page) =>
        page.evaluate(
            (c) =>
                [...document.querySelectorAll(`${c} .simple-html-grid-menu-sub .simple-html-grid-menu-item`)].map((r) =>
                    r.textContent.trim()
                ),
            CHOOSER
        );

    for (const look of looks) {
        const name = `${look.grid}-${look.theme}`;
        const context = await browser.newContext({ viewport: { width: 1300, height: 1000 } });
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
        page.on('console', (m) => m.type() === 'error' && errors.push(`${name} console: ${m.text()}`));
        await page.addInitScript((l) => {
            localStorage.setItem('simple-html-demo-theme', l.theme);
            localStorage.setItem('simple-html-demo-grid-theme', l.grid);
        }, look);
        await page.addInitScript(PROBE_FN);
        await page.goto(`${base}#sample/full-grid`);
        await page.waitForSelector(`${GRID} .simple-html-grid-col-cell`);
        await page.waitForTimeout(400);
        await page.evaluate(() => document.querySelector('.stage simple-html-grid').scrollIntoView());
        await page.waitForTimeout(100);
        const api = (fn, arg) => page.evaluate(fn, arg);
        const formats = () => api(() => document.querySelector('.stage simple-html-grid').grid.gridInterface.getState().formats);
        const headerLabel = (field) =>
            page.evaluate(
                ([g, f]) => document.querySelector(`${g} [data-attribute-header="${f}"]`)?.textContent.trim() ?? null,
                [GRID, field]
            );
        /** the row of a field in the chooser, by its $attribute */
        const fieldBox = (field, part = '') =>
            page.evaluate(
                ([c, f, p]) => {
                    const row = [
                        ...document.querySelectorAll(`${c} .simple-html-grid-menu-sub .simple-html-grid-menu-item`)
                    ].find((r) => r.$attribute === f);
                    if (!row) {
                        return null;
                    }
                    row.scrollIntoView({ block: 'nearest' });
                    const el = p ? row.querySelector(p) : row;
                    const r = el.getBoundingClientRect();
                    return {
                        x: r.left + r.width / 2,
                        y: r.top + r.height / 2,
                        left: r.left,
                        right: r.right,
                        width: r.width,
                        height: r.height
                    };
                },
                [CHOOSER, field, part]
            );

        await openChooser(page, 'city');

        // ---- the search: framed as an input
        const search = await page.evaluate((c) => {
            const frame = document.querySelector(`${c} .simple-html-grid-chooser-search`);
            const input = frame.querySelector('input');
            const s = getComputedStyle(frame);
            return {
                border: s.borderTopColor,
                borderWidth: s.borderTopWidth,
                background: s.backgroundColor,
                control: __varColour(frame, '--simple-html-grid-control-border-color'),
                inputBg: __varColour(frame, '--simple-html-grid-sec-bg-color', 'backgroundColor'),
                icon: !!frame.querySelector('svg.simple-html-grid-search-icon'),
                placeholder: input.placeholder,
                name: input.getAttribute('aria-label'),
                height: Math.round(frame.getBoundingClientRect().height),
                radius: s.borderTopLeftRadius
            };
        }, CHOOSER);
        check(
            `${name}: the search framed as an input - the controls' frame, the inputs' background, a magnifying glass, Search`,
            search.border === search.control &&
                search.borderWidth === '1px' &&
                search.background === search.inputBg &&
                search.icon &&
                search.placeholder === 'Search' &&
                search.name === 'Search' &&
                search.height === 24 &&
                search.radius === '0px',
            search
        );
        await page.click(`${CHOOSER} .simple-html-grid-chooser-search input`);
        const outline = await page.evaluate((c) => {
            const s = getComputedStyle(document.querySelector(`${c} .simple-html-grid-chooser-search`));
            return { width: s.outlineWidth, style: s.outlineStyle };
        }, CHOOSER);
        check(
            `${name}: the search with the focus: the outline on its frame`,
            outline.width === '2px' && outline.style === 'solid',
            outline
        );
        if (shots) {
            await page.screenshot({ path: `${shots}/chooser-${name}.png` });
            await page.locator(CHOOSER).screenshot({ path: `${shots}/chooser-zoom-${name}.png` });
        }

        // ---- labels: sorted; found by label and by field name
        const all = await chooserLabels(page);
        const sorted = [...all].sort((a, b) => a.localeCompare(b));
        check(
            `${name}: the list in the order of the labels`,
            all.join('|') === sorted.join('|') && all.length >= 50,
            all.slice(0, 6)
        );
        await page.fill(`${CHOOSER} .simple-html-grid-chooser-search input`, 'countrycode');
        const byName = await chooserLabels(page);
        check(`${name}: the search finds countryCode by its name: Country`, byName.join() === 'Country', byName);
        await api(() =>
            document
                .querySelector('.stage simple-html-grid')
                .grid.gridInterface.setState({ formats: { city: { label: 'Town' } } })
        );
        await page.fill(`${CHOOSER} .simple-html-grid-chooser-search input`, 'tow');
        const byLabel = await chooserLabels(page);
        check(`${name}: the search finds a label of the user: Town (city)`, byLabel.join() === 'Town', byLabel);
        await page.fill(`${CHOOSER} .simple-html-grid-chooser-search input`, '');

        // ---- the handle at the left of every field, the same as the Detail form tab's
        const handles = await page.evaluate((c) => {
            const rows = [...document.querySelectorAll(`${c} .simple-html-grid-menu-sub .simple-html-grid-menu-item`)].slice(
                0,
                8
            );
            return rows.map((row) => {
                const h = row.querySelector('.simple-html-grid-drag-handle');
                const l = row.querySelector('.simple-html-grid-chooser-label');
                return {
                    first: row.firstElementChild === h,
                    leftOfLabel: h && l ? h.getBoundingClientRect().right <= l.getBoundingClientRect().left : false,
                    icon: !!h?.querySelector('svg.simple-html-grid-drag-handle-icon'),
                    cursor: h ? getComputedStyle(h).cursor : null
                };
            });
        }, CHOOSER);
        check(
            `${name}: a drag handle at the left of every field, before the label, the grab cursor`,
            handles.every((h) => h.first && h.leftOfLabel && h.icon && h.cursor === 'grab'),
            handles.slice(0, 2)
        );

        // ---- a field dragged with the mouse into the header, by its handle
        const centerOf = () =>
            api(() =>
                document
                    .querySelector('.stage simple-html-grid')
                    .grid.gridInterface.getState()
                    .layout.center.map((c) => c.fields.join('+'))
            );
        const centerBefore = await centerOf();
        await page.fill(`${CHOOSER} .simple-html-grid-chooser-search input`, 'notes');
        const notes = await fieldBox('notes', '.simple-html-grid-drag-handle');
        await page.mouse.move(notes.x, notes.y);
        await page.waitForTimeout(600);
        const tipShown = await page.evaluate(() => {
            const tip = document.querySelector('.simple-html-grid-tooltip');
            return tip ? tip.textContent : null;
        });
        const target = await page.evaluate((g) => {
            const label = document.querySelector(`${g} [data-attribute-header="age"]`);
            const r = label.getBoundingClientRect();
            return { x: r.left + 8, y: r.top + r.height / 2 };
        }, GRID);
        await page.mouse.down();
        for (let i = 1; i <= 12; i++) {
            await page.mouse.move(notes.x + ((target.x - notes.x) * i) / 12, notes.y + ((target.y - notes.y) * i) / 12);
            await page.waitForTimeout(16);
        }
        await page.waitForTimeout(100);
        if (shots) {
            await page.screenshot({ path: `${shots}/chooser-drag-${name}.png` });
        }
        await page.mouse.up();
        await page.waitForTimeout(300);
        const center = await centerOf();
        const ageAt = centerBefore.indexOf('age');
        const tipAfter = await page.evaluate(() => {
            const tip = document.querySelector('.simple-html-grid-tooltip');
            return tip && getComputedStyle(tip).display !== 'none' && getComputedStyle(tip).visibility !== 'hidden'
                ? tip.textContent
                : null;
        });
        // dropped on Age's label: Notes is there now, where Age was (its center) or beside it (its edge)
        check(
            `${name}: a field dragged by its handle into the header: Notes at Age's place, the chooser still open`,
            center.join() !== centerBefore.join() &&
                center.slice(ageAt - 1, ageAt + 2).some((c) => c.split('+').includes('notes')) &&
                (await page.evaluate((c) => !!document.querySelector(c), CHOOSER)),
            { before: centerBefore.slice(ageAt - 1, ageAt + 2), after: center.slice(ageAt - 1, ageAt + 2) }
        );
        check(
            `${name}: the handle's tooltip under the pointer, none left after the drop`,
            tipShown === 'Drag it into the header to add the column' && !tipAfter,
            [tipShown, tipAfter]
        );
        await page.fill(`${CHOOSER} .simple-html-grid-chooser-search input`, '');

        // ---- the ✎ of City (Town): shown under the pointer; a label typed and Enter
        const FIELD = 'city';
        await page.fill(`${CHOOSER} .simple-html-grid-chooser-search input`, 'city');
        const pencilOf = (f) =>
            page.evaluate(
                ([c, field]) => {
                    const row = [
                        ...document.querySelectorAll(`${c} .simple-html-grid-menu-sub .simple-html-grid-menu-item`)
                    ].find((r) => r.$attribute === field);
                    const button = row.querySelector('.simple-html-grid-chooser-rename');
                    const r = button.getBoundingClientRect();
                    return { x: r.left + r.width / 2, y: r.top + r.height / 2, opacity: getComputedStyle(button).opacity };
                },
                [CHOOSER, f]
            );
        const cityRow = await fieldBox(FIELD);
        const hidden = (await pencilOf(FIELD)).opacity;
        await page.mouse.move(cityRow.x, cityRow.y);
        await page.waitForTimeout(100);
        const pencil = await pencilOf(FIELD);
        check(`${name}: the ✎ hidden at rest, shown under the pointer`, hidden === '0' && pencil.opacity === '1', [
            hidden,
            pencil.opacity
        ]);
        if (shots) {
            await page.locator(CHOOSER).screenshot({ path: `${shots}/chooser-hover-zoom-${name}.png` });
        }
        await page.mouse.move(pencil.x, pencil.y);
        await page.waitForTimeout(600);
        const pencilTip = await page.evaluate(() => document.querySelector('.simple-html-grid-tooltip')?.textContent ?? null);
        check(`${name}: the ✎'s tooltip: Rename Town`, pencilTip === 'Rename Town', pencilTip);
        const before = await headerLabel(FIELD);
        await page.mouse.click(pencil.x, pencil.y);
        const editing = await page.evaluate((c) => {
            const input = document.querySelector(`${c} .simple-html-grid-chooser-label-input`);
            return {
                value: input?.value,
                focused: document.activeElement === input,
                selected: input ? input.selectionEnd - input.selectionStart === input.value.length : false,
                placeholder: input?.placeholder,
                name: input?.getAttribute('aria-label')
            };
        }, CHOOSER);
        check(
            `${name}: a click on the ✎: an input with the label (Town), the focus in it, all of it selected; its own label City the placeholder`,
            before === 'Town' &&
                editing.value === before &&
                editing.focused &&
                editing.selected &&
                editing.name === 'Label of City' &&
                editing.placeholder === 'City',
            { before, editing }
        );
        if (shots) {
            await page.screenshot({ path: `${shots}/chooser-rename-${name}.png` });
            await page.locator(CHOOSER).screenshot({ path: `${shots}/chooser-rename-zoom-${name}.png` });
        }
        await page.keyboard.type('Place');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
        const afterEnter = {
            header: await headerLabel(FIELD),
            format: (await formats())[FIELD],
            list: await chooserLabels(page),
            focus: await page.evaluate(
                (c) =>
                    document.activeElement?.className === 'simple-html-grid-chooser-rename' &&
                    !!document.activeElement.closest(c),
                CHOOSER
            ),
            open: await page.evaluate((c) => !!document.querySelector(c), CHOOSER)
        };
        check(
            `${name}: Enter: the header and the list show the label, the state has it, the focus on the ✎`,
            afterEnter.header === 'Place' &&
                afterEnter.format?.label === 'Place' &&
                afterEnter.list.join() === 'Place' &&
                afterEnter.focus &&
                afterEnter.open,
            afterEnter
        );
        // Esc: nothing changes, the chooser stays
        await page.keyboard.press('Enter');
        await page.keyboard.type('Nope');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
        check(
            `${name}: Esc in the input: the label as it was, the chooser open`,
            (await headerLabel(FIELD)) === 'Place' && (await page.evaluate((c) => !!document.querySelector(c), CHOOSER)),
            await headerLabel(FIELD)
        );
        // empty: the column's own label again
        await page.keyboard.press('Enter');
        await page.keyboard.press('Control+a');
        await page.keyboard.press('Backspace');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
        check(
            `${name}: an empty label: the column's own again (City)`,
            (await headerLabel(FIELD)) === 'City' && !(await formats())[FIELD]?.label,
            [await headerLabel(FIELD), (await formats())[FIELD]]
        );
        // the keyboard: Tab from the search to the ✎, Enter
        await page.focus(`${CHOOSER} .simple-html-grid-chooser-search input`);
        await page.keyboard.press('Tab');
        const tabbed = await page.evaluate(() => ({
            cls: document.activeElement?.className,
            opacity: getComputedStyle(document.activeElement).opacity,
            name: document.activeElement?.getAttribute('aria-label')
        }));
        check(
            `${name}: Tab from the search: the ✎, shown, named Rename …`,
            tabbed.cls === 'simple-html-grid-chooser-rename' && tabbed.opacity === '1' && tabbed.name?.startsWith('Rename '),
            tabbed
        );
        await page.keyboard.press('Enter');
        const keyInput = await page.evaluate(() => document.activeElement?.className);
        check(`${name}: Enter on the ✎ opens the input`, keyInput === 'simple-html-grid-chooser-label-input', keyInput);
        await page.keyboard.press('Escape');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
        check(`${name}: Esc on the ✎ closes the chooser`, !(await page.evaluate((c) => !!document.querySelector(c), CHOOSER)));
        await context.close();

        // ---- a phone: the ✎ always shown, 24px; a tap, a label, Enter
        const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
        const p2 = await phone.newPage();
        p2.on('pageerror', (e) => errors.push(`${name} phone: ${e}`));
        await p2.addInitScript((l) => {
            localStorage.setItem('simple-html-demo-theme', l.theme);
            localStorage.setItem('simple-html-demo-grid-theme', l.grid);
        }, look);
        await p2.goto(`${base}#sample/full-grid`);
        await p2.waitForSelector(`${GRID} .simple-html-grid-col-cell`);
        await p2.waitForTimeout(500);
        await p2.evaluate(() => document.querySelector('.stage simple-html-grid').scrollIntoView());
        await p2.waitForTimeout(150);
        await openChooser(p2, 'company', true);
        const touchPencil = await p2.evaluate((c) => {
            const button = document.querySelector(`${c} .simple-html-grid-chooser-rename`);
            const r = button.getBoundingClientRect();
            const row = button.closest('.simple-html-grid-menu-item').getBoundingClientRect();
            const search = document.querySelector(`${c} .simple-html-grid-chooser-search`).getBoundingClientRect();
            return {
                opacity: getComputedStyle(button).opacity,
                width: r.width,
                height: r.height,
                row: row.height,
                search: search.height
            };
        }, CHOOSER);
        check(
            `${name}: a phone: the ✎ always shown, 24px; the rows 28px, the search 24px`,
            touchPencil.opacity === '1' &&
                touchPencil.width === 24 &&
                touchPencil.height === 24 &&
                touchPencil.row === 28 &&
                touchPencil.search === 24,
            touchPencil
        );
        if (shots) {
            await p2.screenshot({ path: `${shots}/phone-chooser-${name}.png` });
            await p2.locator(CHOOSER).screenshot({ path: `${shots}/phone-chooser-zoom-${name}.png` });
        }
        await p2.fill(`${CHOOSER} .simple-html-grid-chooser-search input`, 'vip');
        const vipPencil = await p2.evaluate((c) => {
            const r = document.querySelector(`${c} .simple-html-grid-chooser-rename`).getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }, CHOOSER);
        await p2.touchscreen.tap(vipPencil.x, vipPencil.y);
        await p2.waitForTimeout(150);
        const phoneEditing = await p2.evaluate(
            (c) => document.activeElement === document.querySelector(`${c} .simple-html-grid-chooser-label-input`),
            CHOOSER
        );
        await p2.keyboard.press('Control+a');
        await p2.keyboard.type('Gold');
        await p2.keyboard.press('Enter');
        await p2.waitForTimeout(150);
        const phoneLabel = await p2.evaluate(
            (g) => document.querySelector('.stage simple-html-grid').grid.gridInterface.getState().formats.vip?.label,
            GRID
        );
        check(
            `${name}: a phone: a tap on the ✎, a label typed, Enter: the column's label`,
            phoneEditing && phoneLabel === 'Gold',
            [phoneEditing, phoneLabel]
        );
        if (shots) {
            await p2.screenshot({ path: `${shots}/phone-chooser-renamed-${name}.png` });
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
