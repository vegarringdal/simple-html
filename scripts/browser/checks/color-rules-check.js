// Real browser check of the colour rules (ColumnFormat.rules, colorRules.ts, columnSettingsRules.ts) on
// the "Full grid" sample (#sample/full-grid), in the four looks: default and TreDeSpace, light and dark.
// - the sample's rules: Balance < 0 red text, Status = waiting an orange background (a custom cell) - the
//   computed colours are the palette's variables of the look, their contrasts 4.5:1 or more
// - the dialog by mouse: Add rule on Age (>= 60), a value, swatches clicked, Bold, Apply & close -> the cells
// - the dialog by keyboard: Add rule (Enter) -> the focus on its operator, Enter opens the menu, the arrows
//   and Enter pick Less Than, Tab to the value, typed, Tab to the text colours (one stop), ArrowRight picks
//   the next, Tab to the backgrounds, Tab to Bold, Space; Move down / Move up / Remove by Enter
// - scrolling keeps each cell's colour with its row (cells reused); a selected row and a focused cell keep a
//   readable text; Find's match shows without the rule; no rounded corners; the dialog at a phone's width
// Usage: node color-rules-check.js <site url> [shots dir]
const path = require('node:path');
const fs = require('node:fs');
const [, , base, shots] = process.argv;
if (!base) {
    console.log('usage: node color-rules-check.js <site url> [screenshot dir]');
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

/** in the page: the colours of an element and the contrast of its text, from the computed style */
const COLOUR_TOOLS = `
// any css colour (rgb(), oklch() of TreDeSpace, color(srgb ...)) as drawn: through a canvas
window.__rgb = (text) => {
    window.__canvas = window.__canvas || Object.assign(document.createElement('canvas'), { width: 1, height: 1 });
    const x = window.__canvas.getContext('2d', { willReadFrequently: true });
    x.clearRect(0, 0, 1, 1);
    x.fillStyle = '#000';
    x.fillStyle = text;
    x.fillRect(0, 0, 1, 1);
    const d = x.getImageData(0, 0, 1, 1).data;
    return [d[0] / 255, d[1] / 255, d[2] / 255, d[3] / 255];
};
window.__lum = ([r, g, b]) => {
    const l = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * l(r) + 0.7152 * l(g) + 0.0722 * l(b);
};
window.__contrast = (a, b) => {
    const [x, y] = [window.__lum(a), window.__lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
};
// the colour of a css variable of the grid, as the browser resolves it (light-dark, oklch): a probe
window.__varColour = (name, property = 'color') => {
    const grid = document.querySelector('.stage simple-html-grid');
    const probe = document.createElement('span');
    probe.style[property] = 'var(' + name + ')';
    grid.appendChild(probe);
    const value = getComputedStyle(probe)[property];
    probe.remove();
    return value;
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
        await page.addInitScript(COLOUR_TOOLS);
        await page.goto(`${base}#sample/full-grid`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
        await page.waitForTimeout(400);

        const dialogSel = 'dialog.column-settings';
        const api = (fn, arg) =>
            page.evaluate(
                ([source, a]) => {
                    const gi = document.querySelector('.stage simple-html-grid').grid.gridInterface;
                    // biome-ignore lint/security/noGlobalEval: the check's own function, sent as text
                    return eval(`(${source})`)(gi, a);
                },
                [fn.toString(), arg]
            );
        const shot = async (file, locator) => {
            if (shots) {
                await (locator ?? page).screenshot({ path: `${shots}/${file}-${name}.png` });
            }
        };
        const openDialog = async () => {
            await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
            await page.locator('.stage .footer-settings').click();
            await page.waitForSelector(dialogSel);
            await page.waitForTimeout(100);
        };
        const pickColumn = async (field) => {
            await page.locator(`${dialogSel} [role="option"][data-field="${field}"]`).click();
            await page.waitForTimeout(80);
        };
        const byId = (part) => page.locator(`${dialogSel} [id$="-settings-${part}"]`);
        const button = (text) => page.locator(`${dialogSel} button`, { hasText: new RegExp(`^\\s*${text}\\s*$`) });
        /** the cells of a field on screen: its row's value, the classes and the colours as drawn */
        const cellsOf = (field) =>
            page.evaluate((f) => {
                const grid = document.querySelector('.stage simple-html-grid');
                const datasource = grid.grid.gridInterface.getDatasource();
                return [...grid.querySelectorAll('.simple-html-grid-col-cell[type="row-cell"]')]
                    .filter((c) => c.$attribute === f && c.closest('.simple-html-grid-row').style.display === 'block')
                    .map((cell) => {
                        const text = cell.querySelector('input:not([type="checkbox"]), .simple-html-grid-cell-custom') ?? cell;
                        const styles = getComputedStyle(cell);
                        // what is under the cell: the row's background
                        const rowBg = getComputedStyle(cell.closest('.simple-html-grid-row')).backgroundColor;
                        const bg = window.__rgb(styles.backgroundColor)[3] === 0 ? rowBg : styles.backgroundColor;
                        const colour = getComputedStyle(text).color;
                        return {
                            row: cell.$row,
                            value: datasource.getRow(cell.$row)?.[f],
                            classes: [...cell.classList].filter((n) => n.startsWith('simple-html-grid-cell-')),
                            bg,
                            colour,
                            weight: getComputedStyle(text).fontWeight,
                            contrast: Math.round(window.__contrast(window.__rgb(colour), window.__rgb(bg)) * 100) / 100
                        };
                    });
            }, field);
        const variable = (v, property) => page.evaluate(([n, p]) => window.__varColour(n, p), [v, property]);
        /** the grid renders the columns in view: scrolled sideways until the field's cells are in it */
        const scrollTo = async (field) => {
            await page.evaluate((f) => {
                const g = document.querySelector('.stage simple-html-grid').grid.gridInterface;
                const center = g.__getGridConfig().layout.center;
                const index = center.findIndex((c) => c.fields.includes(f));
                const left = center.slice(0, index).reduce((sum, c) => sum + c.width, 0);
                const scroller = document.querySelector('.stage .simple-html-grid-middle-scroller');
                scroller.scrollLeft = Math.max(0, left - 100);
            }, field);
            await page.waitForTimeout(250);
        };
        const red = await variable('--simple-html-grid-palette-red-color');
        const orangeBg = await variable('--simple-html-grid-palette-orange-bg-color', 'backgroundColor');
        const mainText = await variable('--simple-html-grid-main-font-color');

        // ---- the sample's rules
        await scrollTo('balance');
        const balance = await cellsOf('balance');
        const negative = balance.filter((c) => c.value < 0);
        const positive = balance.filter((c) => c.value >= 0);
        check(
            `${name}: sample: Balance < 0 has red text (the palette's), the others the grid's`,
            negative.length > 0 &&
                negative.every((c) => c.classes.includes('simple-html-grid-cell-text-red') && c.colour === red) &&
                positive.every((c) => !c.classes.includes('simple-html-grid-cell-text') && c.colour === mainText),
            { red, mainText, negative: negative.slice(0, 2), positive: positive.slice(0, 1) }
        );
        check(
            `${name}: sample: the red text 4.5:1 or more on its row`,
            negative.every((c) => c.contrast >= 4.5),
            negative.map((c) => c.contrast)
        );
        const status = await cellsOf('status');
        const waiting = status.filter((c) => c.value === 'waiting');
        check(
            `${name}: sample: Status = waiting an orange background (a custom cell), the others none`,
            waiting.length > 0 &&
                waiting.every((c) => c.bg === orangeBg && c.classes.includes('simple-html-grid-cell-bg-orange')) &&
                status.filter((c) => c.value !== 'waiting').every((c) => !c.classes.includes('simple-html-grid-cell-bg')),
            { orangeBg, waiting: waiting.slice(0, 1) }
        );
        // the badge's text on the orange background
        const badge = await page.evaluate(() => {
            const cell = [...document.querySelectorAll('.stage .simple-html-grid-cell-bg-orange')].find((c) =>
                c.querySelector('.demo-full-badge')
            );
            if (!cell) return null;
            const t = window.__rgb(getComputedStyle(cell.querySelector('.demo-full-badge')).color);
            return Math.round(window.__contrast(t, window.__rgb(getComputedStyle(cell).backgroundColor)) * 100) / 100;
        });
        check(`${name}: sample: the badge's own colour on the orange background, 3:1 or more`, badge >= 3, badge);
        await shot('color-rules-grid');

        // ---- a rule by mouse: Age >= 60, green background, bold
        await openDialog();
        await pickColumn('age');
        await button('Add rule').click();
        await page.waitForTimeout(80);
        const added = await page.evaluate(() => ({
            focused: document.activeElement?.getAttribute('aria-label'),
            problem: [...document.querySelectorAll('dialog.column-settings .column-settings-problem')].map((p) =>
                p.textContent.trim()
            )
        }));
        check(
            `${name}: Add rule: the focus on its operator (the column's >=), no value yet a problem`,
            added.focused === 'Operator: Greater than or equal' && added.problem.includes('Write the value to compare with'),
            added
        );
        await byId('rule-0-value').fill('60');
        await byId('rule-0-value').press('Tab');
        await page.locator(`${dialogSel} input[name$="-rule-0-color"][aria-label="None"]`).click();
        await page.locator(`${dialogSel} input[name$="-rule-0-background"][aria-label="Green"]`).click();
        await page.locator(`${dialogSel} .column-settings-check`, { hasText: 'Bold' }).click();
        await page.waitForTimeout(80);
        const badges = await page.evaluate(() =>
            [...document.querySelectorAll('dialog.column-settings [role="option"][data-field="age"] .column-settings-badge')].map(
                (b) => b.textContent.trim()
            )
        );
        check(`${name}: the column's badge Colours`, badges.includes('Colours'), badges);
        const radius = await page.evaluate(() =>
            [...document.querySelectorAll('dialog.column-settings, dialog.column-settings *')]
                .filter((e) => !(e instanceof HTMLInputElement && e.type === 'checkbox'))
                .map((e) => getComputedStyle(e).borderRadius)
                .filter((r) => r !== '0px')
        );
        check(`${name}: no rounded corners in the dialog, the swatches square`, radius.length === 0, radius.slice(0, 3));
        const swatch = await page.evaluate(() => {
            const s = document.querySelector('dialog.column-settings input.column-settings-swatch-bg-green');
            const r = s.getBoundingClientRect();
            return { w: r.width, h: r.height, checked: s.checked, bg: getComputedStyle(s).backgroundColor };
        });
        check(
            `${name}: a swatch: 20px square, its colour the palette's, the one picked checked`,
            swatch.w === 20 &&
                swatch.h === 20 &&
                swatch.checked &&
                swatch.bg === (await variable('--simple-html-grid-palette-green-bg-color', 'backgroundColor')),
            swatch
        );
        await page.locator(`${dialogSel} .column-settings-rules`).scrollIntoViewIfNeeded();
        await shot('color-rules-dialog', page.locator(dialogSel));
        await button('Apply & close').click();
        await page.waitForTimeout(250);
        await scrollTo('age');
        const age = await cellsOf('age');
        const greenBg = await variable('--simple-html-grid-palette-green-bg-color', 'backgroundColor');
        check(
            `${name}: Apply: Age >= 60 on a green background, bold; the others not`,
            age.some((c) => c.value >= 60) &&
                age.filter((c) => c.value >= 60).every((c) => c.bg === greenBg && Number(c.weight) >= 700 && c.contrast >= 4.5) &&
                age.filter((c) => c.value < 60).every((c) => c.bg !== greenBg && Number(c.weight) < 700),
            { greenBg, age: age.slice(0, 3) }
        );
        // the rule, next to the template the sample gives age (`{value} yrs`)
        const state = await api((gi) => JSON.stringify(gi.getState().formats.age.rules));
        check(
            `${name}: the state has the rule`,
            state === JSON.stringify([{ operator: 'GREATER_THAN_OR_EQUAL_TO', value: '60', background: 'green', bold: true }]),
            state
        );

        // ---- a rule by keyboard: on Credit, Less Than 1000, orange text, then moved and removed
        await openDialog();
        await pickColumn('credit');
        await button('Add rule').focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(80);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(120);
        // the menu: its section heading, then the operators - the focus on the first
        const menu = await page.evaluate(() =>
            [...document.querySelectorAll('.simple-html-grid-menu [data-menu-id]')].map((e) => e.getAttribute('data-menu-id'))
        );
        check(
            `${name}: keys: Enter on the operator opens the operators of a number, no In / Not In`,
            menu.includes('filter.operator.lessThan') &&
                menu.includes('filter.operator.between') &&
                menu.includes('filter.filter.isBlank') &&
                !menu.some((id) => /\.(IN|in)$/.test(id)),
            menu
        );
        for (let i = 0; i < 8; i++) {
            const at = await page.evaluate(() => document.activeElement?.getAttribute('data-menu-id'));
            if (at === 'filter.operator.lessThan') break;
            await page.keyboard.press('ArrowDown');
        }
        await page.keyboard.press('Enter');
        await page.waitForTimeout(120);
        const operator = await byId('rule-0-operator').getAttribute('aria-label');
        check(
            `${name}: keys: the arrows and Enter pick Less Than, the focus back on the picker`,
            operator === 'Operator: Less than' &&
                (await page.evaluate(() => document.activeElement?.id?.endsWith('-settings-rule-0-operator'))),
            operator
        );
        await page.keyboard.press('Tab');
        await page.keyboard.type('1000');
        // Tab: the text colours - one stop, the colour picked (Red). Move up, Move down and Remove rule are
        // on the rule's first line now, with the kind of its condition (calculated columns: the kinds of a
        // rule), before the operator: Shift+Tab from the operator reaches Remove rule
        const stops = [];
        await page.keyboard.press('Tab');
        stops.push(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')));
        check(`${name}: keys: Tab from the value: the text colours`, stops.join() === 'Red', stops);
        const back = await page.evaluate(() => {
            const operator = document.querySelector('dialog.column-settings [id$="-settings-rule-0-operator"]');
            const focusable = [...document.querySelectorAll('dialog.column-settings button, dialog.column-settings input')];
            return focusable[focusable.indexOf(operator) - 1]?.getAttribute('aria-label');
        });
        check(`${name}: keys: before the operator, the rule's buttons: Remove rule`, back === 'Remove rule', back);
        const colourStop = await page.evaluate(() => ({
            label: document.activeElement?.getAttribute('aria-label'),
            name: document.activeElement?.name
        }));
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(60);
        const afterArrow = await page.evaluate(() => {
            const checked = document.querySelector('dialog.column-settings input[name$="-rule-0-color"]:checked');
            return {
                focus: document.activeElement?.getAttribute('aria-label'),
                checked: checked?.getAttribute('aria-label'),
                outline: getComputedStyle(document.activeElement).outlineStyle
            };
        });
        check(
            `${name}: keys: Tab to the text colours on Red, ArrowRight picks Orange, the focus on it with its outline`,
            colourStop.label === 'Red' &&
                colourStop.name.endsWith('-rule-0-color') &&
                afterArrow.focus === 'Orange' &&
                afterArrow.checked === 'Orange' &&
                afterArrow.outline !== 'none',
            { colourStop, afterArrow }
        );
        await shot('color-rules-keyboard', page.locator(dialogSel));
        // Tab: the colour picker of a custom colour after the swatches, then the backgrounds
        await page.keyboard.press('Tab');
        const customStop = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
        await page.keyboard.press('Tab');
        const bgStop = await page.evaluate(() => document.activeElement?.name);
        check(
            `${name}: keys: Tab from the text colours: the custom colour picker, one stop`,
            customStop === 'Custom colour',
            customStop
        );
        // None: the first, ArrowLeft from Red
        await page.keyboard.press('ArrowLeft');
        // past the custom colour picker to Bold
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Space');
        await page.waitForTimeout(60);
        const keyed = await page.evaluate(() => ({
            bg: document
                .querySelector('dialog.column-settings input[name$="-rule-0-background"]:checked')
                ?.getAttribute('aria-label'),
            bold: document.querySelector('dialog.column-settings input[id$="-settings-rule-0-bold"]').checked
        }));
        check(
            `${name}: keys: Tab to the backgrounds, ArrowLeft to None, Tab (past the picker) to Bold, Space`,
            bgStop.endsWith('-rule-0-background') && keyed.bg === 'None' && keyed.bold,
            { bgStop, keyed }
        );
        // a second rule, moved up by Enter, then removed
        await button('Add rule').focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(80);
        await byId('rule-1-value').fill('5000');
        await byId('rule-1-up').focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(80);
        const moved = await page.evaluate(() => ({
            first: document.querySelector('dialog.column-settings input[id$="-settings-rule-0-value"]').value,
            focus: document.activeElement?.id?.replace(/^.*-settings-/, '')
        }));
        check(
            `${name}: keys: Enter on Move up moves the rule, the focus on its Move up`,
            moved.first === '5000' && moved.focus === 'rule-0-up',
            moved
        );
        // Move down, Remove rule: the rule moved up taken out
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(80);
        const removed = await page.evaluate(() => ({
            rules: document.querySelectorAll('dialog.column-settings .column-settings-rule').length,
            first: document.querySelector('dialog.column-settings input[id$="-settings-rule-0-value"]').value,
            focus: document.activeElement?.id?.replace(/^.*-settings-/, '')
        }));
        check(
            `${name}: keys: Enter on Remove rule takes it out, the focus on the next one's`,
            removed.rules === 1 && removed.first === '1000' && removed.focus === 'rule-0-remove',
            removed
        );
        await button('Apply & close').focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(250);
        await scrollTo('credit');
        const credit = await cellsOf('credit');
        const orange = await variable('--simple-html-grid-palette-orange-color');
        check(
            `${name}: keys: Apply -> Credit < 1000 orange and bold`,
            credit.filter((c) => c.value < 1000).every((c) => c.colour === orange && Number(c.weight) >= 700) &&
                credit.filter((c) => c.value >= 1000).every((c) => c.colour === mainText),
            { orange, credit: credit.slice(0, 3) }
        );

        // ---- scrolling: the cells reused for other rows keep their row's colour
        await scrollTo('balance');
        let wrong = [];
        for (const top of [300, 900, 1500, 3000, 200]) {
            await page.evaluate((t) => {
                const s = document.querySelector('.stage .simple-html-grid-body-scroller');
                s.scrollTop = t;
                s.dispatchEvent(new Event('scroll'));
            }, top);
            await page.waitForTimeout(250);
            const cells = await cellsOf('balance');
            wrong = wrong.concat(
                cells.filter(
                    (c) =>
                        c.value < 0 !== c.classes.includes('simple-html-grid-cell-text-red') || (c.value < 0 && c.colour !== red)
                )
            );
        }
        check(`${name}: scrolling: every Balance cell on screen has its row's colour`, wrong.length === 0, wrong.slice(0, 2));

        // ---- a selected row and a focused cell with a rule: readable
        const target = (await cellsOf('balance')).find((c) => c.value < 0);
        // the row selected (select() counts from 1), then a click in the cell
        await api((gi, row) => {
            gi.getDatasource().select(row + 1);
            gi.refresh();
        }, target.row);
        await page.waitForTimeout(150);
        const box = await page.evaluate((row) => {
            const cell = [...document.querySelectorAll('.stage .simple-html-grid-col-cell[type="row-cell"]')].find(
                (c) =>
                    c.$attribute === 'balance' && c.$row === row && c.closest('.simple-html-grid-row').style.display === 'block'
            );
            const r = cell.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }, target.row);
        // the keys move the focus away and back: the outline of the keyboard
        await page.mouse.click(box.x, box.y);
        await page.waitForTimeout(150);
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(150);
        await page.keyboard.press('ArrowLeft');
        await page.waitForTimeout(250);
        const selected = (await cellsOf('balance')).find((c) => c.row === target.row);
        const focus = await page.evaluate(() => {
            const input = document.activeElement;
            const cell = input.closest('.simple-html-grid-col-cell');
            const row = cell.closest('.simple-html-grid-row');
            const outline = window.__rgb(getComputedStyle(input).outlineColor);
            return {
                selectedRow: [...row.classList].some((n) => n.startsWith('simple-html-grid-selected-row')),
                outline: getComputedStyle(input).outlineStyle,
                outlineContrast:
                    Math.round(window.__contrast(outline, window.__rgb(getComputedStyle(row).backgroundColor)) * 100) / 100
            };
        });
        check(
            `${name}: a selected row and the focused cell: the red text 4.5:1 on the selected row, the focus outline`,
            selected.colour === red &&
                selected.contrast >= 4.5 &&
                focus.selectedRow &&
                focus.outline !== 'none' &&
                focus.outlineContrast >= 3,
            { selected, focus }
        );
        await shot('color-rules-selected');

        // ---- the detail form: the current row's Balance in the rule's red, on the input's background
        await api((gi) => gi.setState({ detailForm: { show: true, fields: ['balance', 'company'] } }));
        await page.waitForTimeout(300);
        const form = await page.evaluate(() => {
            const input = document.querySelector('.stage .simple-html-grid-detail-form-field[data-field="balance"] input');
            const other = document.querySelector('.stage .simple-html-grid-detail-form-field[data-field="company"] input');
            const styles = getComputedStyle(input);
            return {
                value: input.value,
                colour: styles.color,
                other: getComputedStyle(other).color,
                contrast:
                    Math.round(window.__contrast(window.__rgb(styles.color), window.__rgb(styles.backgroundColor)) * 100) / 100
            };
        });
        check(
            `${name}: the detail form: the value in the rule's red, 4.5:1 on the input; another field the grid's text`,
            form.colour === red && form.contrast >= 4.5 && form.other === mainText,
            form
        );
        await shot('color-rules-detail-form');
        await api((gi) => gi.setState({ detailForm: { show: false, fields: [] } }));
        await page.waitForTimeout(200);

        // ---- Find: a match shows without the rule (its tint, the grid's text)
        await api((gi) => gi.find('waiting'));
        await page.waitForTimeout(300);
        await scrollTo('status');
        const found = await page.evaluate(() => {
            const cell = document.querySelector('.stage .simple-html-cell-find-match.simple-html-grid-cell-bg-orange');
            return cell
                ? { bg: getComputedStyle(cell).backgroundColor, image: getComputedStyle(cell).backgroundImage !== 'none' }
                : null;
        });
        check(
            `${name}: Find: a match keeps the class but not the orange, Find's tint shows`,
            found && found.bg !== orangeBg && found.image,
            { found, orangeBg }
        );
        await shot('color-rules-find');
        await api((gi) => gi.closeFind());
        await page.waitForTimeout(150);
        await page.close();
        await context.close();
    }

    // ---- a phone: the dialog's rules wrap, nothing wider than the screen
    {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push(`phone: ${e}`));
        await page.addInitScript(() => localStorage.setItem('simple-html-demo-theme', 'light'));
        await page.goto(`${base}#sample/full-grid`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
        await page.waitForTimeout(400);
        await page.evaluate(() =>
            document.querySelector('.stage simple-html-grid').grid.gridInterface.openColumnSettings('balance')
        );
        await page.waitForTimeout(200);
        await page.locator('dialog.column-settings [id$="-settings-rules-add"]').click();
        await page.waitForTimeout(100);
        await page.locator('dialog.column-settings .column-settings-rules').scrollIntoViewIfNeeded();
        const phone = await page.evaluate(() => {
            const dialog = document.querySelector('dialog.column-settings').getBoundingClientRect();
            const wide = [...document.querySelectorAll('dialog.column-settings .column-settings-rule *')].filter(
                (e) => e.getBoundingClientRect().right > dialog.right + 1
            );
            const swatch = document.querySelector('dialog.column-settings .column-settings-swatch').getBoundingClientRect();
            return {
                dialogRight: Math.round(dialog.right),
                width: innerWidth,
                wide: wide.length,
                swatch: [swatch.width, swatch.height]
            };
        });
        check(
            'phone: the dialog in the screen, the rules inside it, the swatches 20px',
            phone.dialogRight <= phone.width && phone.wide === 0 && phone.swatch[0] === 20,
            phone
        );
        if (shots) {
            await page.screenshot({ path: `${shots}/color-rules-phone.png` });
        }
        await context.close();
    }

    check('no page errors', errors.length === 0, errors.slice(0, 3));
    await browser.close();
    console.log(results.join('\n'));
    console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
})();
