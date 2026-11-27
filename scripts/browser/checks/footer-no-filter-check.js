// (a copy of the shared script: the settings button is a stop of Tab after "No filter")
// Real browser check of the footer's button "No filter" (#sample/filtering, #sample/ranges,
// #sample/translation), light and dark: shown without a filter under the count, a click / Enter / Space
// opens the filter editor and its Cancel gives the focus back to it, a filter built in the editor and
// applied puts Clear and the chips in its place - the same button, the focus on it - Clear brings it
// back, the count does not move, the summary of the selected cells stays clear of it on a wide and a
// narrow grid, Tab gets to it from the last cell and leaves the grid after it, none with footerHeight 0,
// the contrast of its text, and screenshots.
// Usage: node footer-no-filter-check.js <site url> [screenshot dir]
const path = require('node:path');
const fs = require('node:fs');
const [, , base, shots] = process.argv;
if (!base) {
    console.log('usage: node footer-no-filter-check.js <site url> [screenshot dir]');
    process.exit(2);
}
const { chromium } = require('playwright');
if (shots) {
    fs.mkdirSync(shots, { recursive: true });
}

const results = [];
const check = (name, ok, detail = '') =>
    results.push(
        `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : ''}`
    );
const grid = '.stage simple-html-grid';

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

    const open = async (sample, dark) => {
        const page = await browser.newPage({ viewport: { width: 1300, height: 1400 }, deviceScaleFactor: 2 });
        page.on('pageerror', (e) => errors.push(`${sample}: ${e}`));
        page.on('console', (m) => m.type() === 'error' && errors.push(`${sample} console: ${m.text()}`));
        await page.addInitScript((d) => localStorage.setItem('simple-html-demo-theme', d ? 'dark' : 'light'), dark);
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
    /** the footer: its parts as text, and where they are */
    const footer = (page) =>
        page.evaluate((g) => {
            const f = document.querySelector(`${g} .simple-html-grid-footer`);
            const rect = (s) => {
                const r = f.querySelector(s)?.getBoundingClientRect();
                return r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom } : null;
            };
            const own = f.getBoundingClientRect();
            return {
                parts: [...f.querySelectorAll('.footer-filter > *')].map((p) => p.textContent.replace(/\s+/g, ' ').trim()),
                count: f.querySelector('.footer-count')?.textContent.trim(),
                countRole: f.querySelector('.footer-count')?.getAttribute('role'),
                footer: { left: own.left, right: own.right, top: own.top, bottom: own.bottom },
                countRect: rect('.footer-count'),
                button: rect('.footer-filter-none'),
                clear: rect('.footer-filter-clear'),
                row: rect('.footer-filter'),
                summary: rect('.footer-summary')
            };
        }, grid);
    const active = (page) =>
        page.evaluate((g) => {
            const el = document.activeElement;
            return {
                className: typeof el?.className === 'string' ? el.className : '',
                text: el?.textContent?.trim().slice(0, 40),
                inGrid: !!el && document.querySelector(g).contains(el),
                dialog: !!el?.closest('dialog.filter-editor-content'),
                row: el?.closest('.simple-html-grid-col-cell')?.$row,
                field: el?.closest('.simple-html-grid-col-cell')?.$attribute ?? null
            };
        }, grid);
    const editorOpen = (page) => page.evaluate(() => !!document.querySelector('dialog.filter-editor-content[open]'));
    const shot = async (page, name, margin = 0) => {
        if (!shots) return;
        const footerLocator = page.locator(`${grid} .simple-html-grid-footer`);
        await footerLocator.scrollIntoViewIfNeeded();
        const box = await footerLocator.boundingBox();
        await page.screenshot({
            path: `${shots}/${name}.png`,
            clip: { x: box.x, y: box.y - margin, width: box.width, height: box.height + margin }
        });
    };

    for (const dark of [false, true]) {
        const theme = dark ? 'dark' : 'light';
        const page = await open('filtering', dark);

        // ---- 1. without a filter: the button under the count, a button for the accessibility tree
        let f = await footer(page);
        check(
            `${theme}: "No filter" alone in the row under the count`,
            f.parts.join('|') === 'No filter' && !!f.button && !f.clear,
            f.parts
        );
        check(
            `${theme}: the count in the band at the top, the button under it, both in the footer`,
            f.countRect.bottom <= f.button.top + 1 && f.button.bottom <= f.footer.bottom && f.countRect.top >= f.footer.top - 1,
            { count: f.countRect, button: f.button, footer: f.footer }
        );
        check(`${theme}: the count is a status`, f.countRole === 'status', f.countRole);
        const role = await page.getByRole('button', { name: 'No filter', exact: true }).count();
        check(`${theme}: a button named "No filter" for the accessibility tree`, role === 1, role);
        const look = await page.evaluate((g) => {
            const style = (s) => getComputedStyle(document.querySelector(`${g} ${s}`));
            const b = style('.footer-filter-none');
            return {
                color: b.color,
                bg: b.backgroundColor,
                radius: b.borderRadius,
                border: b.borderTopColor,
                title: document.querySelector(`${g} .footer-filter-none`).title
            };
        }, grid);
        check(`${theme}: square, its tooltip`, look.radius === '0px' && look.title === 'Open the filter editor', look);
        check(
            `${theme}: its text 4.5:1 or more on it`,
            contrast(look.color, look.bg) >= 4.5,
            contrast(look.color, look.bg).toFixed(2)
        );
        const countTop = f.countRect.top;
        await shot(page, `no-filter-${theme}`, 4);

        // under the pointer, and with the keyboard's focus
        await page.hover(`${grid} .footer-filter-none`);
        await page.waitForTimeout(50);
        const hover = await page.evaluate(
            (g) => getComputedStyle(document.querySelector(`${g} .footer-filter-none`)).backgroundColor,
            grid
        );
        check(
            `${theme}: under the pointer another background, the text still 4.5:1`,
            hover !== look.bg && contrast(look.color, hover) >= 4.5,
            `${look.bg} -> ${hover}, ${contrast(look.color, hover).toFixed(2)}`
        );
        await shot(page, `no-filter-hover-${theme}`, 4);
        await page.mouse.move(5, 5);

        // ---- 2. a click opens the editor; Cancel gives the focus back to the button
        await page.click(`${grid} .footer-filter-none`);
        await page.waitForTimeout(200);
        check(`${theme}: a click opens the filter editor`, await editorOpen(page));
        if (shots) await page.screenshot({ path: `${shots}/no-filter-editor-${theme}.png` });
        await page.locator('dialog.filter-editor-content button', { hasText: 'Cancel' }).click();
        await page.waitForTimeout(150);
        let a = await active(page);
        check(
            `${theme}: Cancel: closed, the focus back on "No filter"`,
            !(await editorOpen(page)) && a.className.includes('footer-filter-none'),
            a
        );
        await shot(page, `no-filter-focus-${theme}`, 4);

        // Enter and Space (the browser's, it is a <button>), Esc closes
        for (const key of ['Enter', 'Space']) {
            await page.focus(`${grid} .footer-filter-none`);
            await page.keyboard.press(key);
            await page.waitForTimeout(200);
            const opened = await editorOpen(page);
            await page.keyboard.press('Escape');
            await page.waitForTimeout(150);
            a = await active(page);
            check(
                `${theme}: ${key} opens the editor, Esc closes it, the focus back on the button`,
                opened && !(await editorOpen(page)) && a.className.includes('footer-filter-none'),
                { opened, a }
            );
        }

        // ---- 3. a filter built in the editor: + Condition, field, operator, value, Apply & close
        await page.click(`${grid} .footer-filter-none`);
        await page.waitForTimeout(200);
        await page.locator('dialog.filter-editor-content button', { hasText: '+ Condition' }).first().click();
        await page.waitForTimeout(100);
        await page.locator('.filter-editor-pick-field').last().click();
        await page.waitForTimeout(150);
        await page.locator('.simple-html-grid-menu [data-menu-id="filterEditor.field.age"]').click();
        await page.waitForTimeout(150);
        await page.locator('.filter-editor-pick-operator').last().click();
        await page.waitForTimeout(150);
        await page.locator('.simple-html-grid-menu [data-menu-id="filterEditor.operator.GREATER_THAN"]').click();
        await page.waitForTimeout(150);
        await page.locator('dialog.filter-editor-content input[aria-label="Value"]').last().fill('30');
        await page.locator('dialog.filter-editor-content button', { hasText: 'Apply & close' }).click();
        await page.waitForTimeout(250);
        f = await footer(page);
        a = await active(page);
        const filterText = await api(page, 'JSON.stringify(gi.getDatasource().getFilter())');
        check(`${theme}: applied: Clear and the chip in its place`, f.parts.join('|') === '✕ Clear|Age > 30' && !f.button, {
            parts: f.parts,
            filterText
        });
        check(`${theme}: the focus on the same button, now Clear`, a.className.includes('footer-filter-clear'), a);
        check(
            `${theme}: the count did not move`,
            Math.abs(f.countRect.top - countTop) < 0.5,
            `${countTop} -> ${f.countRect.top}`
        );
        await shot(page, `filter-clear-${theme}`, 4);

        // ---- 4. Enter on Clear: the button "No filter" again, the focus on it
        await page.keyboard.press('Enter');
        await page.waitForTimeout(200);
        f = await footer(page);
        a = await active(page);
        const none = (await api(page, 'gi.getDatasource().getFilter()')) === null;
        check(
            `${theme}: Enter on Clear: no filter, "No filter" back, the focus on it`,
            f.parts.join('|') === 'No filter' && a.className.includes('footer-filter-none') && none,
            { parts: f.parts, a }
        );

        // ---- 5. Tab: from the last cell of the last row to the button, then out of the grid; Shift+Tab back
        if (!dark) {
            const rows = await api(page, 'gi.getDatasource().length()');
            const fields = await api(page, 'gi.getLayoutFields()');
            await page.evaluate((g) => {
                document.querySelector(`${g} .simple-html-grid-body-scroller`).scrollTop = 0;
            }, grid);
            await page.waitForTimeout(300);
            const first = await page.evaluate((g) => {
                const input = [...document.querySelectorAll(`${g} .simple-html-grid-col-cell input`)].find(
                    (i) => i.offsetParent !== null && i.closest('.simple-html-grid-col-cell').$row === 0
                );
                const r = input.getBoundingClientRect();
                return { x: r.x + 10, y: r.y + r.height / 2 };
            }, grid);
            await page.mouse.click(first.x, first.y);
            await page.keyboard.press('Control+End');
            await page.waitForTimeout(400);
            a = await active(page);
            check('Ctrl+End: the last cell of the last row', a.row === rows - 1 && a.field === fields[fields.length - 1], {
                a,
                rows
            });
            await page.keyboard.press('Tab');
            await page.waitForTimeout(150);
            a = await active(page);
            check('Tab from the last cell of the last row: "No filter"', a.className.includes('footer-filter-none'), a);
            await page.keyboard.press('Tab');
            await page.waitForTimeout(150);
            a = await active(page);
            // the settings button (GridConfig.settingsButton) is the footer's last stop
            check('Tab on it: the settings button', a.className.includes('footer-settings'), a);
            await page.keyboard.press('Tab');
            await page.waitForTimeout(150);
            a = await active(page);
            check('Tab on the settings button: out of the grid', !a.inGrid, a);
            await page.focus(`${grid} .footer-filter-none`);
            await page.keyboard.press('Shift+Tab');
            await page.waitForTimeout(400);
            a = await active(page);
            check(
                'Shift+Tab on it: the last cell of the last row',
                a.row === rows - 1 && a.field === fields[fields.length - 1],
                a
            );

            // a footer of no height: no button
            await api(page, 'gi.updateConfig({ footerHeight: 0 })');
            await page.waitForTimeout(300);
            f = await footer(page);
            check('footerHeight 0: no "No filter"', !f.button && f.parts.length === 0, f.parts);
            await api(page, 'gi.updateConfig({ footerHeight: 45 })');
            await page.waitForTimeout(300);
            f = await footer(page);
            check('footerHeight 45 again: "No filter" again', !!f.button, f.parts);
        }
        if (shots) {
            await page.screenshot({ path: `${shots}/page-${theme}.png` });
        }
        await page.close();

        // ---- 6. with the summary of the selected cells: wide and narrow, without and with a filter
        const ranges = await open('ranges', dark);
        const setRanges = () => api(ranges, `gi.setRanges([{ fromRow: 0, fromField: 'company', toRow: 4, toField: 'age' }])`);
        const apart = (fo) => !!fo.summary && !!fo.row && fo.row.right <= fo.summary.left + 0.5;
        await setRanges();
        await ranges.waitForTimeout(100);
        f = await footer(ranges);
        check(`${theme}: wide, the summary and "No filter" side by side, apart`, apart(f) && !!f.button, {
            row: f.row,
            summary: f.summary
        });
        check(
            `${theme}: wide, the summary on the button's line`,
            Math.abs((f.summary.top + f.summary.bottom) / 2 - (f.button.top + f.button.bottom) / 2) < 2,
            { summary: f.summary, button: f.button }
        );
        await shot(ranges, `summary-no-filter-${theme}`, 4);
        await api(ranges, `gi.getDatasource().filter({ field: 'age', operator: 'GREATER_THAN', value: 20 })`);
        await ranges.waitForTimeout(150);
        await setRanges();
        await ranges.waitForTimeout(100);
        f = await footer(ranges);
        check(`${theme}: wide with a filter, apart`, apart(f) && !!f.clear, { row: f.row, summary: f.summary });
        await shot(ranges, `summary-filter-${theme}`, 4);

        // narrow: the stage 380px wide
        await ranges.evaluate((g) => {
            document.querySelector(g).parentElement.style.width = '380px';
        }, grid);
        await api(ranges, 'gi.rebuild()');
        await ranges.waitForTimeout(200);
        await setRanges();
        await ranges.waitForTimeout(100);
        f = await footer(ranges);
        check(
            `${theme}: narrow with a filter: the chips collapsed, the summary cut where they end`,
            apart(f) && f.parts.some((p) => /filter — click to edit/.test(p)),
            { parts: f.parts, row: f.row, summary: f.summary }
        );
        await shot(ranges, `narrow-summary-filter-${theme}`, 4);
        await api(ranges, 'gi.getDatasource().filter(null)');
        await ranges.waitForTimeout(150);
        await setRanges();
        await ranges.waitForTimeout(100);
        f = await footer(ranges);
        check(`${theme}: narrow without a filter: "No filter" and the summary apart`, apart(f) && !!f.button, {
            row: f.row,
            summary: f.summary
        });
        const title = await ranges.evaluate((g) => document.querySelector(`${g} .footer-summary`).title, grid);
        check(
            `${theme}: narrow: the summary's tooltip has all of it`,
            /Count: 20\nSum: \d+\nAverage: [\d.]+\nMin: \d+\nMax: \d+/.test(title),
            title
        );
        await shot(ranges, `narrow-summary-no-filter-${theme}`, 4);
        await ranges.close();
    }

    // ---- 7. a grid wider than its view (#sample/full-grid): the count over the horizontal scrollbar's band,
    // the thumb still dragged under it (the count lets the pointer through)
    for (const dark of [false, true]) {
        const theme = dark ? 'dark' : 'light';
        const wide = await open('full-grid', dark);
        const f = await footer(wide);
        const through = await wide.evaluate(
            (g) => getComputedStyle(document.querySelector(`${g} .footer-count`)).pointerEvents,
            grid
        );
        check(
            `${theme} full grid: "No filter" under the count, the count lets the pointer through`,
            !!f.button && f.countRect.bottom <= f.button.top + 1 && through === 'none',
            { count: f.countRect, button: f.button, through }
        );
        await shot(wide, `full-grid-${theme}`, 14);
        await wide.close();
    }

    // ---- 8. the texts of the grid: the Norwegian sample
    const no = await open('translation', false);
    // it starts with a filter: its Clear ("✕ Fjern") first
    await no.click(`${grid} .footer-filter-clear`);
    await no.waitForTimeout(200);
    const noText = await no.evaluate((g) => {
        const b = document.querySelector(`${g} .footer-filter-none`);
        return [b?.textContent.trim(), b?.title];
    }, grid);
    check('translation sample: "Ingen filter", its tooltip', noText.join('|') === 'Ingen filter|Åpne filterredigeringen', noText);
    await shot(no, 'translation');
    await no.close();

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
