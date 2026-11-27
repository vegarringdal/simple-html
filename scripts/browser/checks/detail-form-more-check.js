// Real browser check of the detail form's more (detailForm.ts, detailFormResize.ts, detailFormSettings.ts)
// on the "Detail form" sample (#sample/detail-form) and the "Full grid" sample (#sample/full-grid), in
// the looks default and TreDeSpace, light and dark:
// - the fields: a quiet frame at rest (1.25:1 or more to the form, less than the controls' frame), the
//   controls' frame under the pointer, the focus outline (2px, the focus colour), the error colour and
//   the red bar + message with an error (the full grid's required company)
// - the title's button collapses the form to a strip of 24px at the right - the rows end at it, the title
//   going down - and expands it: by a click, by Enter / Space with the focus on it (Tab from the footer
//   comes to it first); aria-expanded; the state's expanded
// - the left edge: a mouse drag makes the form wider and narrower while it moves - the header and the
//   rows end where the form starts, a column fills the room at its left - stopped at minWidth / maxWidth;
//   the state's width; the keys of the splitter (Tab to it, ArrowLeft / ArrowRight, aria-valuenow)
// - getState() -> JSON -> resetState() -> setState() keeps the width dragged and collapsed
// - the dialog's Detail form tab: Expanded, Min / Max width (the width follows), a field dragged by its
//   handle with the mouse (a line where it goes) - Apply: the form's fields in that order
// - a phone (390x844, touch): the form under the rows, collapsed by a tap to a bar of 24px over the
//   footer and expanded; the splitter not shown there; a field of the dialog's list dragged by a finger
// - no rounded corners on the new parts
// Screenshots of each look.
//
// Usage: node detail-form-more-check.js <site url> [screenshot dir]
const path = require('node:path');
const fs = require('node:fs');
const [, , base, shots] = process.argv;
if (!base) {
    console.log('usage: node detail-form-more-check.js <site url> [screenshot dir]');
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
const FORM = `${GRID} .simple-html-grid-detail-form`;

/** in the page: the contrast of two css colours rgb(a) as the browser gives them */
const CONTRAST_FN = `
    // any css colour (rgb(), oklch() ...) as [r, g, b]: painted on a canvas and read back
    window.__rgb = (css) => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const c = canvas.getContext('2d');
        c.fillStyle = css;
        c.fillRect(0, 0, 1, 1);
        return [...c.getImageData(0, 0, 1, 1).data].slice(0, 3);
    };
    window.__lum = ([r, g, b]) => {
        const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    window.__contrast = (a, b) => {
        const [x, y] = [__lum(__rgb(a)), __lum(__rgb(b))].sort((p, q) => q - p);
        return (x + 0.05) / (y + 0.05);
    };
    // the colour a variable gives a border, read from a probe in the element
    window.__varColour = (element, variable) => {
        const probe = document.createElement('div');
        probe.style.cssText = 'position:absolute;width:0;height:0;border:1px solid var(' + variable + ')';
        element.appendChild(probe);
        const colour = getComputedStyle(probe).borderTopColor;
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
        await page.addInitScript(CONTRAST_FN);
        await page.goto(`${base}#sample/detail-form`);
        await page.waitForSelector(`${GRID} .simple-html-grid-col-cell`);
        await page.waitForTimeout(400);
        await page.evaluate(() => document.querySelector('.stage simple-html-grid').scrollIntoView());
        await page.waitForTimeout(100);

        const api = (fn, arg) => page.evaluate(fn, arg);
        const state = () => api(() => document.querySelector('.stage simple-html-grid').grid.gridInterface.getState().detailForm);
        const rect = (selector) =>
            page.evaluate((s) => {
                const r = document.querySelector(s)?.getBoundingClientRect();
                return r
                    ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }
                    : null;
            }, selector);
        /** where the rows, the header and the form are: the rows and the header end where the form starts */
        const layout = () =>
            page.evaluate((g) => {
                const grid = document.querySelector(g);
                const r = (s) => grid.querySelector(s).getBoundingClientRect();
                const form = r('.simple-html-grid-detail-form');
                const header = r('.simple-html-grid-header');
                const scroller = r('.simple-html-grid-body-scroller');
                // the label at the left of the form, 20px from it: a column fills the room
                const at = document.elementFromPoint(form.left - 20, header.top + 8);
                return {
                    formLeft: Math.round(form.left),
                    formWidth: Math.round(form.width),
                    headerRight: Math.round(header.right),
                    scrollerRight: Math.round(scroller.right),
                    labelBeside: !!at?.closest('.simple-html-grid-col') && !!at.closest('.simple-html-grid-header')
                };
            }, GRID);

        // ---- the fields: a quiet frame, the controls' frame under the pointer, the focus outline
        const fieldSel = `${FORM} [data-field="country"] input`;
        const frames = await page.evaluate((s) => {
            const input = document.querySelector(s);
            const form = input.closest('.simple-html-grid-detail-form');
            const style = getComputedStyle(input);
            return {
                rest: style.borderTopColor,
                formBg: getComputedStyle(form).backgroundColor,
                fieldBg: style.backgroundColor,
                control: __varColour(form, '--simple-html-grid-control-border-color'),
                focus: __varColour(form, '--simple-html-grid-focus-color'),
                radius: style.borderTopLeftRadius
            };
        }, fieldSel);
        const restContrast = await page.evaluate((f) => __contrast(f.rest, f.formBg), frames);
        const controlContrast = await page.evaluate((f) => __contrast(f.control, f.formBg), frames);
        const fieldVsForm = await page.evaluate((f) => __contrast(f.fieldBg, f.formBg), frames);
        check(
            `${name}: a field's frame at rest is quiet but seen (>= 1.25:1 to the form), less than the controls' frame`,
            restContrast >= 1.25 && restContrast < controlContrast && frames.rest !== frames.control,
            { restContrast: restContrast.toFixed(2), controlContrast: controlContrast.toFixed(2), frames }
        );
        check(`${name}: the field has a background of its own`, fieldVsForm > 1.02, fieldVsForm.toFixed(3));
        await page.hover(fieldSel);
        await page.waitForTimeout(100);
        const hovered = await page.evaluate((s) => getComputedStyle(document.querySelector(s)).borderTopColor, fieldSel);
        check(`${name}: under the pointer the controls' frame`, hovered === frames.control, [hovered, frames.control]);
        await page.mouse.move(5, 5);
        await page.click(fieldSel);
        const focused = await page.evaluate((s) => {
            const style = getComputedStyle(document.querySelector(s));
            return { width: style.outlineWidth, style: style.outlineStyle, colour: style.outlineColor };
        }, fieldSel);
        check(
            `${name}: with the focus the 2px focus outline`,
            focused.width === '2px' && focused.style === 'solid' && focused.colour === frames.focus,
            focused
        );
        check(`${name}: square fields`, frames.radius === '0px', frames.radius);
        if (shots) {
            await page.screenshot({ path: `${shots}/form-${name}.png` });
        }
        await page.mouse.click(5, 5);

        // ---- collapsed and expanded: a click
        const toggleSel = `${FORM} .simple-html-grid-detail-form-toggle`;
        const before = await layout();
        check(
            `${name}: the form at the right, 280px, the rows end at it`,
            before.formWidth === 280 && Math.abs(before.headerRight - before.formLeft) <= 1,
            before
        );
        await page.click(toggleSel);
        await page.waitForTimeout(150);
        const collapsed = await layout();
        const strip = await page.evaluate((s) => {
            const toggle = document.querySelector(s);
            const title = toggle.querySelector('.simple-html-grid-detail-form-title');
            const t = title.getBoundingClientRect();
            return {
                expanded: toggle.getAttribute('aria-expanded'),
                writing: getComputedStyle(title).writingMode,
                titleTall: t.height > t.width,
                focus: document.activeElement === toggle,
                fields: document.querySelectorAll('.stage .simple-html-grid-detail-form-field').length
            };
        }, toggleSel);
        check(
            `${name}: a click on the title collapses it to a strip of 24px, the rows to its edge`,
            collapsed.formWidth === 24 &&
                Math.abs(collapsed.headerRight - collapsed.formLeft) <= 1 &&
                Math.abs(collapsed.scrollerRight - collapsed.formLeft) <= 1,
            collapsed
        );
        check(
            `${name}: collapsed: aria-expanded false, the title going down, no fields, the focus on the button`,
            strip.expanded === 'false' && strip.writing === 'vertical-rl' && strip.titleTall && strip.fields === 0 && strip.focus,
            strip
        );
        check(`${name}: collapsed in the state`, (await state()).expanded === false, await state());
        if (shots) {
            await page.screenshot({ path: `${shots}/collapsed-${name}.png` });
        }
        // the keys: Enter expands, Space collapses, the focus stays
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
        const byEnter = await layout();
        check(`${name}: Enter on the button expands it`, byEnter.formWidth === 280 && (await state()).expanded === true, byEnter);
        await page.keyboard.press(' ');
        await page.waitForTimeout(150);
        check(`${name}: Space collapses it`, (await layout()).formWidth === 24, await layout());
        await page.keyboard.press(' ');
        await page.waitForTimeout(150);

        // Tab from the footer's last stop: the button first, then the splitter
        await page.focus(`${GRID} .footer-settings`);
        await page.keyboard.press('Tab');
        const firstStop = await page.evaluate(() => document.activeElement?.className);
        await page.keyboard.press('Tab');
        const secondStop = await page.evaluate(() => ({
            role: document.activeElement?.getAttribute('role'),
            now: document.activeElement?.getAttribute('aria-valuenow')
        }));
        check(
            `${name}: Tab from the footer: the title's button, then the splitter`,
            firstStop === 'simple-html-grid-detail-form-toggle' && secondStop.role === 'separator' && secondStop.now === '280',
            [firstStop, secondStop]
        );
        // the keys of the splitter
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');
        const byKeys = await layout();
        const keysNow = await page.evaluate(() => document.activeElement?.getAttribute('aria-valuenow'));
        check(
            `${name}: ArrowLeft x3 on the splitter: 30px wider, the rows follow, the focus stays`,
            byKeys.formWidth === 310 && keysNow === '310' && Math.abs(byKeys.headerRight - byKeys.formLeft) <= 1,
            [byKeys, keysNow]
        );
        await page.keyboard.press('ArrowRight');
        check(`${name}: ArrowRight 10px narrower`, (await layout()).formWidth === 300, await layout());

        // ---- the edge dragged with the mouse: live, stopped at the min and the max
        const edge = await rect(`${FORM} .simple-html-grid-detail-form-resize`);
        const ex = edge.left + edge.width / 2;
        const ey = edge.top + 200;
        await page.mouse.move(ex, ey);
        await page.mouse.down();
        for (let i = 1; i <= 10; i++) {
            await page.mouse.move(ex - i * 10, ey);
            await page.waitForTimeout(20);
        }
        await page.waitForTimeout(80);
        const dragging = await layout();
        const draggedClass = await page.evaluate(
            (s) => document.querySelector(s).classList.contains('simple-html-grid-detail-form-resize-dragged'),
            `${FORM} .simple-html-grid-detail-form-resize`
        );
        check(
            `${name}: while the edge is dragged 100px left the form is 400px, the header and the rows end at it`,
            dragging.formWidth === 400 &&
                Math.abs(dragging.headerRight - dragging.formLeft) <= 1 &&
                Math.abs(dragging.scrollerRight - dragging.formLeft) <= 1 &&
                draggedClass,
            dragging
        );
        if (shots) {
            await page.screenshot({ path: `${shots}/resize-drag-${name}.png` });
        }
        await page.mouse.up();
        check(`${name}: let go, the state's width is 400`, (await state()).width === 400, await state());
        // far right: the min (200), the columns fill the room
        await page.mouse.move(ex - 100, ey);
        await page.mouse.down();
        for (let i = 1; i <= 8; i++) {
            await page.mouse.move(ex - 100 + i * 60, ey);
            await page.waitForTimeout(20);
        }
        await page.mouse.up();
        await page.waitForTimeout(150);
        const narrow = await layout();
        check(
            `${name}: dragged far right: stopped at minWidth 200, a column fills the room beside it`,
            narrow.formWidth === 200 && (await state()).width === 200 && narrow.labelBeside,
            narrow
        );
        // far left: the max - maxWidth 600, or the room the rows leave (half the grid) when that is less
        const most = await page.evaluate((s) => {
            const form = document.querySelector(s);
            const grid = form.closest('simple-html-grid');
            return {
                valuemax: Number(form.querySelector('[role="separator"]').getAttribute('aria-valuemax')),
                half: Math.floor(grid.grid.element.clientWidth / 2)
            };
        }, FORM);
        const edge2 = await rect(`${FORM} .simple-html-grid-detail-form-resize`);
        await page.mouse.move(edge2.left + 3, ey);
        await page.mouse.down();
        for (let i = 1; i <= 10; i++) {
            await page.mouse.move(edge2.left + 3 - i * 60, ey);
            await page.waitForTimeout(20);
        }
        await page.mouse.up();
        await page.waitForTimeout(150);
        const wide = await layout();
        const widest = Math.min(600, most.half);
        check(
            `${name}: dragged far left: stopped at maxWidth 600 - or half the grid, the rows keep as much room (aria-valuemax)`,
            wide.formWidth === widest &&
                most.valuemax === widest &&
                (await state()).width === widest &&
                !(await page.evaluate(
                    (s) => document.querySelector(s).classList.contains('simple-html-grid-detail-form-below'),
                    FORM
                )),
            { wide, most }
        );
        if (shots) {
            await page.screenshot({ path: `${shots}/resize-wide-${name}.png` });
        }

        // ---- the state round trip: the width dragged and collapsed kept
        await page.click(toggleSel);
        await page.waitForTimeout(100);
        const saved = await api(() =>
            JSON.stringify(document.querySelector('.stage simple-html-grid').grid.gridInterface.getState())
        );
        await api(() => document.querySelector('.stage simple-html-grid').grid.gridInterface.resetState());
        const reset = await state();
        await api((s) => document.querySelector('.stage simple-html-grid').grid.gridInterface.setState(JSON.parse(s)), saved);
        const restored = await state();
        check(
            `${name}: getState() -> JSON -> resetState() -> setState(): the width dragged and collapsed back`,
            reset.width === 280 &&
                reset.expanded === undefined &&
                restored.width === widest &&
                restored.expanded === false &&
                (await layout()).formWidth === 24,
            { reset, restored }
        );
        await page.click(toggleSel);
        await api(() =>
            document.querySelector('.stage simple-html-grid').grid.gridInterface.setState({
                detailForm: {
                    show: true,
                    fields: ['company', 'notes', 'country', 'date1', 'isActive'],
                    width: 280,
                    minWidth: 200,
                    maxWidth: 600
                }
            })
        );
        await page.waitForTimeout(100);

        // ---- the dialog's Detail form tab
        await page.click(`${GRID} .footer-settings`);
        await page.waitForSelector('dialog.column-settings');
        await page.locator('dialog.column-settings [role="tab"]', { hasText: 'Detail form' }).click();
        await page.waitForTimeout(100);
        const tab = await page.evaluate(() => {
            const d = document.querySelector('dialog.column-settings');
            const v = (c) => d.querySelector(c)?.value;
            return {
                expanded: d.querySelector('.detail-form-settings-expanded')?.checked,
                widths: [
                    v('.detail-form-settings-width'),
                    v('.detail-form-settings-minWidth'),
                    v('.detail-form-settings-maxWidth')
                ],
                handles: d.querySelectorAll('.detail-form-settings-option .simple-html-grid-drag-handle svg').length,
                options: d.querySelectorAll('.detail-form-settings-option').length,
                handleRight: [...d.querySelectorAll('.detail-form-settings-option')].every((o) => {
                    const h = o.querySelector('.simple-html-grid-drag-handle').getBoundingClientRect();
                    return o.getBoundingClientRect().right - h.right < 12;
                })
            };
        });
        check(
            `${name}: the tab: Expanded on, Width 280 / Min 200 / Max 600, a handle at the right of every field`,
            tab.expanded === true &&
                tab.widths.join() === '280,200,600' &&
                tab.handles === tab.options &&
                tab.options > 5 &&
                tab.handleRight,
            tab
        );
        // the min over the width: the width follows
        await page.fill('dialog.column-settings .detail-form-settings-minWidth', '320');
        await page.keyboard.press('Tab');
        const followed = await page.evaluate(
            () => document.querySelector('dialog.column-settings .detail-form-settings-width').value
        );
        check(`${name}: Min width 320 over the width: the width follows to 320`, followed === '320', followed);
        if (shots) {
            await page.screenshot({ path: `${shots}/dialog-detail-${name}.png` });
        }
        // a field dragged by its handle: the first one (Company) under the third
        const labelsOf = () =>
            page.evaluate(() =>
                [
                    ...document.querySelectorAll(
                        'dialog.column-settings .detail-form-settings-option .column-settings-option-label'
                    )
                ].map((l) => l.textContent.trim())
            );
        const order = await labelsOf();
        const h0 = await rect('dialog.column-settings .detail-form-settings-option:nth-child(1) .simple-html-grid-drag-handle');
        const o2 = await rect('dialog.column-settings .detail-form-settings-option:nth-child(3)');
        await page.mouse.move(h0.left + h0.width / 2, h0.top + h0.height / 2);
        await page.mouse.down();
        for (let i = 1; i <= 6; i++) {
            const y = h0.top + h0.height / 2 + ((o2.bottom - 3 - (h0.top + h0.height / 2)) * i) / 6;
            await page.mouse.move(h0.left + h0.width / 2, y);
            await page.waitForTimeout(20);
        }
        const line = await page.evaluate(() => {
            const before = document.querySelector('dialog.column-settings .detail-form-settings-drop-before');
            const shadow = before ? getComputedStyle(before).boxShadow : '';
            return {
                at: before ? [...before.parentElement.children].indexOf(before) : -1,
                shadow,
                dragged: !!document.querySelector('.detail-form-settings-dragged')
            };
        });
        check(
            `${name}: dragging: a line before the fourth field, the field dragged quiet`,
            line.at === 3 && line.shadow !== 'none' && line.dragged,
            line
        );
        if (shots) {
            await page.screenshot({ path: `${shots}/dialog-drag-${name}.png` });
        }
        await page.mouse.up();
        const moved = await labelsOf();
        check(
            `${name}: let go: the field is third`,
            moved[2] === order[0] && moved[0] === order[1] && moved[1] === order[2] && moved.length === order.length,
            { order: order.slice(0, 4), moved: moved.slice(0, 4) }
        );
        // the keys still move it: Alt+ArrowUp
        await page.focus('dialog.column-settings .detail-form-settings-list');
        await page.keyboard.press('Alt+ArrowUp');
        const byAlt = await labelsOf();
        check(`${name}: Alt+ArrowUp still moves the field picked`, byAlt[1] === order[0], byAlt.slice(0, 3));
        await page.keyboard.press('Alt+ArrowDown');
        await page.locator('dialog.column-settings button', { hasText: 'Apply & close' }).click();
        await page.waitForTimeout(150);
        const formLabels = await page.evaluate(() =>
            [...document.querySelectorAll('.stage .simple-html-grid-detail-form-label')].map((l) => l.textContent.trim())
        );
        const applied = await state();
        check(
            `${name}: Apply & close: the form's fields in the order dragged, min 320`,
            formLabels[2] === order[0] && applied.minWidth === 320 && applied.width === 320,
            { formLabels, applied }
        );

        // ---- an error in the full grid: the error colour, the bar and the message
        await page.goto(`${base}#sample/full-grid`);
        await page.waitForSelector(`${GRID} .simple-html-grid-col-cell`);
        await page.waitForTimeout(400);
        await api(() => {
            const gi = document.querySelector('.stage simple-html-grid').grid.gridInterface;
            gi.setState({ detailForm: { show: true, fields: ['company', 'notes', 'discount'], width: 320 } });
            gi.getDatasource().setRowAsCurrentEntity(0);
        });
        await page.evaluate(() => document.querySelector('.stage simple-html-grid').scrollIntoView());
        await page.waitForTimeout(150);
        const companySel = `${FORM} [data-field="company"] input`;
        await page.click(companySel);
        await page.fill(companySel, '');
        await page.waitForTimeout(150);
        const error = await page.evaluate((s) => {
            const input = document.querySelector(s);
            const form = input.closest('.simple-html-grid-detail-form');
            const errors = form.querySelector('[data-field="company"] .simple-html-grid-detail-form-errors');
            return {
                invalid: input.getAttribute('aria-invalid'),
                border: getComputedStyle(input).borderTopColor,
                errorColour: __varColour(form, '--simple-html-grid-error-color'),
                bar: errors ? getComputedStyle(errors).borderLeftColor : null,
                text: errors?.textContent.trim(),
                textColour: errors ? getComputedStyle(errors).color : null,
                formBg: getComputedStyle(form).backgroundColor
            };
        }, companySel);
        const errorText = error.textColour ? await page.evaluate((e) => __contrast(e.textColour, e.formBg), error) : 0;
        check(
            `${name}: an error: the error colour on the field with the focus, the red bar and the message readable (4.5:1)`,
            error.invalid === 'true' &&
                error.border === error.errorColour &&
                error.bar === error.errorColour &&
                !!error.text &&
                errorText >= 4.5,
            { ...error, errorText: errorText.toFixed(2) }
        );
        if (shots) {
            await page.screenshot({ path: `${shots}/error-${name}.png` });
        }
        await page.keyboard.press('Control+z');
        await context.close();

        // ---- a phone: under the rows, collapsed by a tap, a field of the dialog dragged by a finger
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
        await p2.evaluate(() => document.querySelector('.stage simple-html-grid').scrollIntoView());
        await p2.waitForTimeout(150);
        const below = () =>
            p2.evaluate((s) => {
                const form = document.querySelector(s);
                const grid = form.closest('simple-html-grid');
                const r = form.getBoundingClientRect();
                const splitter = form.querySelector('.simple-html-grid-detail-form-resize');
                return {
                    below: form.classList.contains('simple-html-grid-detail-form-below'),
                    height: Math.round(r.height),
                    bodyBottom: Math.round(grid.querySelector('.simple-html-grid-body').getBoundingClientRect().bottom),
                    top: Math.round(r.top),
                    footerTop: Math.round(grid.querySelector('.simple-html-grid-footer').getBoundingClientRect().top),
                    bottom: Math.round(r.bottom),
                    splitterShown: !!splitter && getComputedStyle(splitter).display !== 'none',
                    toggleHeight: Math.round(
                        form.querySelector('.simple-html-grid-detail-form-toggle').getBoundingClientRect().height
                    )
                };
            }, FORM);
        const p0 = await below();
        check(`${name}: a phone: the form under the rows, no splitter there`, p0.below && !p0.splitterShown, p0);
        const toggle = await p2.evaluate((s) => {
            const r = document.querySelector(s).getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }, `${FORM} .simple-html-grid-detail-form-toggle`);
        await p2.touchscreen.tap(toggle.x, toggle.y);
        await p2.waitForTimeout(200);
        const p1 = await below();
        check(
            `${name}: a phone: a tap collapses it to a bar of 24px over the footer, the rows down to it`,
            p1.below && p1.height === 24 && Math.abs(p1.bottom - p1.footerTop) <= 1 && Math.abs(p1.bodyBottom - p1.top) <= 2,
            p1
        );
        if (shots) {
            await p2.screenshot({ path: `${shots}/phone-collapsed-${name}.png` });
        }
        const toggle2 = await p2.evaluate((s) => {
            const r = document.querySelector(s).getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }, `${FORM} .simple-html-grid-detail-form-toggle`);
        await p2.touchscreen.tap(toggle2.x, toggle2.y);
        await p2.waitForTimeout(200);
        const p3 = await below();
        check(`${name}: a phone: a tap expands it again`, p3.height > 100, p3);
        if (shots) {
            await p2.screenshot({ path: `${shots}/phone-${name}.png` });
        }
        // the dialog on the phone: a field dragged by a finger on its handle
        await p2.evaluate(() => document.querySelector('.stage simple-html-grid').grid.gridInterface.openDetailFormSettings());
        await p2.waitForSelector('dialog.column-settings .detail-form-settings-list');
        await p2.waitForTimeout(200);
        const labels2 = () =>
            p2.evaluate(() =>
                [
                    ...document.querySelectorAll(
                        'dialog.column-settings .detail-form-settings-option .column-settings-option-label'
                    )
                ].map((l) => l.textContent.trim())
            );
        await p2.evaluate(() =>
            document.querySelector('dialog.column-settings .detail-form-settings-list').scrollIntoView({ block: 'center' })
        );
        await p2.waitForTimeout(100);
        const order2 = await labels2();
        const geo = await p2.evaluate(() => {
            const opts = [...document.querySelectorAll('dialog.column-settings .detail-form-settings-option')];
            const h = opts[0].querySelector('.simple-html-grid-drag-handle').getBoundingClientRect();
            const third = opts[2].getBoundingClientRect();
            const optionHeight = opts[0].getBoundingClientRect().height;
            return { x: h.left + h.width / 2, y: h.top + h.height / 2, to: third.bottom - 3, optionHeight };
        });
        const cdp = await phone.newCDPSession(p2);
        const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
        await touch('touchStart', [{ x: geo.x, y: geo.y }]);
        for (let i = 1; i <= 8; i++) {
            await p2.waitForTimeout(16);
            await touch('touchMove', [{ x: geo.x, y: geo.y + ((geo.to - geo.y) * i) / 8 }]);
        }
        await p2.waitForTimeout(50);
        if (shots) {
            await p2.screenshot({ path: `${shots}/phone-dialog-drag-${name}.png` });
        }
        await touch('touchEnd', []);
        await p2.waitForTimeout(100);
        const moved2 = await labels2();
        check(
            `${name}: a phone: a finger drags a field by its handle - the first is third - the rows compact (<= 30px)`,
            moved2[2] === order2[0] && moved2[0] === order2[1] && geo.optionHeight <= 30,
            { order: order2.slice(0, 3), moved: moved2.slice(0, 3), optionHeight: geo.optionHeight }
        );
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
