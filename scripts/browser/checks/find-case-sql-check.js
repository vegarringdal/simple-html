// Real browser check of Find's "Match case", and that Find makes no SQL (the find bar of Ctrl+F;
// #sample/find and #sample/sql):
// - the toggle Aa: by the mouse (the focus stays in the input), by Alt+C in the input, by Tab and Space;
//   aria-pressed, a tooltip, square, filled in the accent colour while on (3:1 read from the pixels)
// - the counts with and without case: what the cells show, counted from the datasource in the page
// - "Filter rows" with case: the rows shown are the rows with a cell that shows the text as it is; the
//   footer's chip has the Aa marker
// - the SQL sample: Filter rows on filters the rows in the browser, the SQL under the grid stays the
//   filter's - by the sample's button and typed in the bar
// - screenshots: the bar and the chip in the default theme light and dark and TreDeSpace light and dark,
//   the SQL sample light and dark
// Usage: /.claude/browser-checks node find-case-sql-check.js <site url> [screenshot dir]
const [, , base, shots] = process.argv;
if (!base) {
    console.log('usage: node find-case-sql-check.js <site url> [screenshot dir]');
    process.exit(2);
}
const { chromium } = require('playwright');
if (shots) {
    require('node:fs').mkdirSync(shots, { recursive: true });
}

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);

// WCAG relative luminance and contrast
const lin = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};

const grid = '.stage simple-html-grid';

async function open(browser, sample, mode, gridTheme) {
    const page = await browser.newPage({
        viewport: { width: 1300, height: 1200 },
        deviceScaleFactor: 1,
        timezoneId: 'Europe/Oslo'
    });
    page.__errors = [];
    page.on('pageerror', (e) => page.__errors.push(String(e)));
    await page.addInitScript(
        ([dark, theme]) => {
            localStorage.setItem('simple-html-demo-theme', dark ? 'dark' : 'light');
            localStorage.setItem('simple-html-demo-grid-theme', theme);
        },
        [mode === 'dark', gridTheme]
    );
    await page.goto(`${base}#sample/${sample}`);
    await page.waitForSelector(`${grid} .simple-html-grid-col-cell`);
    await page.waitForTimeout(300);
    return page;
}

/** a pixel of the page, as painted */
async function pixel(page, x, y) {
    const png = await page.screenshot({ clip: { x, y, width: 1, height: 1 } });
    return page.evaluate(async (b64) => {
        const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
        const bitmap = await createImageBitmap(blob);
        const canvas = new OffscreenCanvas(1, 1);
        const c2d = canvas.getContext('2d');
        c2d.drawImage(bitmap, 0, 0);
        return [...c2d.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    }, png.toString('base64'));
}

const gi = (page, fn, arg) =>
    page.evaluate(
        ([g, f, a]) => new Function('gi', 'a', `return (${f})(gi, a)`)(document.querySelector(g).grid.gridInterface, a),
        [grid, String(fn), arg]
    );

/** the cells whose text, as the datasource's formatter writes it, holds the text - in any case or as it is */
const expectedCount = (page, text, caseSensitive) =>
    gi(
        page,
        (g, [t, cs]) => {
            const ds = g.getDatasource();
            const fold = (s) => (cs ? s : s.toLowerCase());
            let count = 0;
            for (const row of ds.getRows()) {
                for (const field of g.getLayoutFields()) {
                    if (ds.getField(field).type === 'boolean') continue;
                    if (fold(String(ds.getFormatter(field).format(row[field]))).includes(fold(t))) count++;
                }
            }
            return count;
        },
        [text, caseSensitive]
    );

/** the rows with a cell that shows the text, of every row the filter lets through */
const rowsWith = (page, text, caseSensitive) =>
    gi(
        page,
        (g, [t, cs]) => {
            const ds = g.getDatasource();
            const fold = (s) => (cs ? s : s.toLowerCase());
            const fields = g.getLayoutFields().filter((f) => ds.getField(f).type !== 'boolean');
            return ds
                .getAllData()
                .filter((row) => fields.some((f) => fold(String(ds.getFormatter(f).format(row[f]))).includes(fold(t)))).length;
        },
        [text, caseSensitive]
    );

const active = (page) =>
    page.evaluate(() => {
        const el = document.activeElement;
        return {
            className: typeof el?.className === 'string' ? el.className : '',
            findInput: !!el?.classList.contains('simple-html-grid-find-input')
        };
    });

async function cellCenter(page, row, field) {
    return page.evaluate(
        ([g, r, f]) => {
            const input = [...document.querySelectorAll(`${g} input[data-attribute="${f}"]`)].find(
                (i) => i.closest('.simple-html-grid-col-cell')?.$row === r && i.offsetParent !== null
            );
            const rect = input.getBoundingClientRect();
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        },
        [grid, row, field]
    );
}

/** the find sample: the toggle, the counts, Filter rows with case, the chip; screenshots */
async function findSample(browser, gridTheme, mode) {
    const name = `${gridTheme} ${mode}`;
    const page = await open(browser, 'find', mode, gridTheme);
    const caseButton = `${grid} .simple-html-grid-find-case`;
    const pressed = () => page.locator(caseButton).getAttribute('aria-pressed');
    const count = () => page.locator(`${grid} .simple-html-grid-find-count`).textContent();

    // Ctrl+F in a cell, type "Norway"
    const start = await cellCenter(page, 2, 'company');
    await page.mouse.click(start.x, start.y);
    await page.keyboard.press('Control+f');
    await page.keyboard.type('Norway');
    await page.waitForTimeout(400);
    const anyCase = await expectedCount(page, 'Norway', false);
    let shown = await count();
    check(
        `${name}: "Norway" in any case: the count of the cells that show it`,
        shown.trim() === `1 of ${anyCase}` && (await pressed()) === 'false',
        `${shown} vs ${anyCase}`
    );

    // the look: square, a tooltip, the text Aa
    const look = await page.evaluate((b) => {
        const el = document.querySelector(b);
        return {
            radius: getComputedStyle(el).borderRadius,
            title: el.title,
            text: el.textContent.trim(),
            label: el.getAttribute('aria-label'),
            width: el.getBoundingClientRect().width
        };
    }, caseButton);
    check(
        `${name}: the toggle: Aa, named Match case, a tooltip with Alt+C, square, 21px`,
        look.text === 'Aa' &&
            look.label === 'Match case' &&
            look.title === 'Match case (Alt+C)' &&
            look.radius === '0px' &&
            Math.round(look.width) === 21,
        JSON.stringify(look)
    );

    // by the mouse: pressed, the focus stays in the input; "norway" as it is is no cell
    await page.locator(`${grid} .simple-html-grid-find-input`).fill('norway');
    await page.waitForTimeout(400);
    await page.locator(caseButton).click();
    await page.waitForTimeout(150);
    shown = await count();
    let a = await active(page);
    let s = await gi(page, (g) => g.getFind());
    check(
        `${name}: by the mouse: pressed, "norway" as it is finds no cell, the focus stays in the input`,
        (await pressed()) === 'true' && s.caseSensitive && s.count === 0 && shown.trim() === 'No matches' && a.findInput,
        JSON.stringify({ shown, s, a })
    );
    // "Norway" with case: the cells that show it as it is
    await page.locator(`${grid} .simple-html-grid-find-input`).fill('Norway');
    await page.waitForTimeout(400);
    const withCase = await expectedCount(page, 'Norway', true);
    s = await gi(page, (g) => g.getFind());
    check(
        `${name}: "Norway" with Match case: the cells that show it as it is`,
        s.count === withCase && withCase > 0,
        `${s.count} vs ${withCase}`
    );

    // the pressed toggle: filled with the accent colour, the Aa at least 3:1 to the fill, the fill 3:1 to the bar
    const box = await page.locator(caseButton).boundingBox();
    const fill = await pixel(page, Math.floor(box.x + 2), Math.floor(box.y + 2));
    const barBg = await pixel(page, Math.floor(box.x) - 1, Math.floor(box.y + box.height / 2));
    const accent = await page.evaluate((b) => getComputedStyle(document.querySelector(b)).backgroundColor, caseButton);
    // the darkest (or lightest) pixel of the Aa: its text
    let text = fill;
    for (let x = Math.floor(box.x + 4); x < box.x + box.width - 4; x++) {
        const p = await pixel(page, x, Math.floor(box.y + box.height / 2));
        if (contrast(p, fill) > contrast(text, fill)) {
            text = p;
        }
    }
    check(
        `${name}: the pressed Aa: the text at least 3:1 to its fill, the fill at least 3:1 to the bar`,
        contrast(text, fill) >= 3 && contrast(fill, barBg) >= 3,
        `text ${text} on ${fill} (${accent}): ${contrast(text, fill).toFixed(2)}, fill to the bar ${barBg}: ${contrast(fill, barBg).toFixed(2)}`
    );
    if (shots) {
        const r = await page.locator(`${grid} .simple-html-grid-find`).boundingBox();
        await page.screenshot({
            path: `${shots}/find-case-bar-${gridTheme}-${mode}.png`,
            clip: { x: r.x - 60, y: r.y - 4, width: r.width + 62, height: 120 }
        });
    }

    // Alt+C in the input: off, the focus stays; again: on
    await page.locator(`${grid} .simple-html-grid-find-input`).focus();
    await page.keyboard.press('Alt+c');
    await page.waitForTimeout(150);
    a = await active(page);
    s = await gi(page, (g) => g.getFind());
    const value = await page.locator(`${grid} .simple-html-grid-find-input`).inputValue();
    check(
        `${name}: Alt+C in the input turns it off, types nothing, the focus stays`,
        (await pressed()) === 'false' && !s.caseSensitive && s.count === anyCase && a.findInput && value === 'Norway',
        JSON.stringify({ s, a, value })
    );
    await page.keyboard.press('Alt+c');
    await page.waitForTimeout(150);
    check(`${name}: Alt+C again turns it on`, (await pressed()) === 'true', String(await pressed()));

    // Tab to it, Space: off; Shift+Tab back
    await page.keyboard.press('Tab');
    a = await active(page);
    const onCase = a.className.includes('simple-html-grid-find-case');
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);
    const offBySpace = await pressed();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    const onByEnter = await pressed();
    await page.keyboard.press('Shift+Tab');
    a = await active(page);
    check(
        `${name}: Tab from the input to Aa, Space off, Enter on, Shift+Tab back`,
        onCase && offBySpace === 'false' && onByEnter === 'true' && a.findInput,
        JSON.stringify({ onCase, offBySpace, onByEnter, back: a.findInput })
    );

    // Filter rows with case: the rows with a cell that shows "Norway" as it is
    await page.locator(`${grid} .simple-html-grid-find-filter`).click();
    await page.waitForTimeout(300);
    const total = await gi(page, (g) => g.getDatasource().getAllData().length);
    let rows = await gi(page, (g) => g.getDatasource().getDataRows().length);
    const wanted = await rowsWith(page, 'Norway', true);
    const chip = await page.evaluate((g) => {
        const el = document.querySelector(`${g} .footer-filter-find`);
        return {
            text: el?.textContent.replace(/\s+/g, ' ').trim(),
            marker: el?.querySelector('.footer-filter-case')?.textContent.trim()
        };
    }, grid);
    check(
        `${name}: Filter rows with Match case: the rows that show "Norway" as it is, the chip with the Aa marker`,
        rows === wanted && rows > 0 && rows < total && chip.marker === 'Aa' && chip.text.startsWith('Find: Norway'),
        JSON.stringify({ rows, wanted, chip })
    );
    // the text "norway" with case: no row; turned off: the rows of any case
    await page.locator(`${grid} .simple-html-grid-find-input`).fill('NORWAY');
    await page.waitForTimeout(400);
    rows = await gi(page, (g) => g.getDatasource().getDataRows().length);
    const noRows = rows === 0;
    await page.locator(caseButton).click();
    await page.waitForTimeout(300);
    rows = await gi(page, (g) => g.getDatasource().getDataRows().length);
    const anyRows = await rowsWith(page, 'NORWAY', false);
    check(
        `${name}: "NORWAY": no row with Match case, the rows of any case without`,
        noRows && rows === anyRows && rows > 0,
        `${rows} vs ${anyRows}`
    );
    if (shots) {
        await page.locator(caseButton).click();
        await page.locator(`${grid} .simple-html-grid-find-input`).fill('Norway');
        await page.waitForTimeout(400);
        const g = await page.locator(grid).boundingBox();
        await page.screenshot({
            path: `${shots}/find-case-filter-rows-${gridTheme}-${mode}.png`,
            clip: { x: g.x, y: g.y, width: g.width, height: g.height }
        });
    }
    check(`${name}: no page errors`, page.__errors.length === 0, page.__errors.join(' | '));
    await page.close();
}

/** the SQL sample: Find's Filter rows filters in the browser, the SQL stays the filter's */
async function sqlSample(browser, mode) {
    const page = await open(browser, 'sql', mode, 'default');
    const blocks = () => page.evaluate(() => [...document.querySelectorAll('.stage .demo-sql-block')].map((b) => b.textContent));
    const button = (label) => page.locator('.stage .demo-btn', { hasText: label }).first().click();

    let shown = await blocks();
    check(
        `${mode}: the SQL sample starts with WHERE 1=1`,
        shown.length === 4 && shown.every((b) => b.includes('WHERE 1=1')),
        shown.join(' | ')
    );

    await button('Find "acme", Filter rows');
    await page.waitForTimeout(300);
    shown = await blocks();
    check(
        `${mode}: Find "acme" with Filter rows: still WHERE 1=1, no find in the SQL`,
        shown.every((b) => b.includes('WHERE 1=1') && !b.includes('acme')),
        shown.join(' | ')
    );
    const rows = await gi(page, (g) => g.getDatasource().getDataRows().length);
    const wanted = await rowsWith(page, 'acme', false);
    check(`${mode}: the grid shows the rows with a match`, rows === wanted && rows > 0, `${rows} vs ${wanted}`);
    await button('Norway, age 30-40');
    shown = await blocks();
    check(
        `${mode}: a filter with Filter rows on: the filter's SQL only`,
        shown[0].includes('"norway"') && !shown[0].includes('acme'),
        shown[0]
    );
    if (shots) {
        await page.locator('.stage .demo-sql').scrollIntoViewIfNeeded();
        const out = await page.locator('.stage .demo-sql').boundingBox();
        const g = await page.locator(grid).boundingBox();
        await page.screenshot({
            path: `${shots}/sql-find-${mode}.png`,
            clip: { x: g.x, y: g.y, width: g.width, height: Math.min(1200, out.y + out.height - g.y) }
        });
    }

    // typed in the find bar: Ctrl+F, the text, Aa, the funnel
    await button('Clear filter');
    await button('Close find');
    await page.waitForTimeout(200);
    const cell = await cellCenter(page, 1, 'company');
    await page.mouse.click(cell.x, cell.y);
    await page.keyboard.press('Control+f');
    await page.keyboard.press('Control+a');
    await page.keyboard.type('Mango');
    await page.keyboard.press('Alt+c');
    await page.locator(`${grid} .simple-html-grid-find-filter`).click();
    await page.waitForTimeout(400);
    shown = await blocks();
    check(
        `${mode}: typed in the bar, Alt+C and the funnel: still WHERE 1=1`,
        shown.every((b) => b.includes('WHERE 1=1')),
        shown.join(' | ')
    );
    await page.keyboard.press('Escape');
    // a calculated column: its formula in the SQL of every dialect, not "is not one of the columns"
    await button('Clear filter');
    await button('calculated: LEFT({company}, 3) = "won"');
    await page.waitForTimeout(300);
    shown = await blocks();
    check(
        `${mode}: a filter on a calculated column (LEFT): its formula as SQL in every dialect`,
        shown.length === 4 &&
            shown.every((b) => b.includes('WHERE') && b.includes('company_name') && !b.includes('not one of the columns')) &&
            shown[0].includes('SUBSTR(') &&
            shown[3].includes('SUBSTRING('),
        shown.join(' | ')
    );
    const shortRows = await gi(page, (g) => g.getDatasource().getRows().length);
    check(`${mode}: the grid shows the rows of the calculated filter`, shortRows > 0, String(shortRows));
    await button('calculated: days since date1 > 30');
    await page.waitForTimeout(300);
    shown = await blocks();
    check(
        `${mode}: a calculated column with dates (DAYS, TODAY): SQL in every dialect`,
        shown.every((b) => b.includes('WHERE') && !b.includes('not one of the columns')) &&
            shown[0].includes(`DATE '`) &&
            shown[3].includes('DATEDIFF(day'),
        shown.join(' | ')
    );
    // a column with a template: filtered on the text it shows, in the grid and in the SQL
    await button('Clear filter');
    await button('template: {company} ({country}) contains "(norway)"');
    await page.waitForTimeout(300);
    shown = await blocks();
    check(
        `${mode}: a template filtered as shown: company and country joined in the SQL of every dialect`,
        shown.length === 4 &&
            shown.every((b) => b.includes('company_name') && b.includes('country') && !b.includes('not one of the columns')) &&
            shown[0].includes('(norway)'),
        shown.join(' | ')
    );
    const norway = await gi(page, (g) => {
        const rows = g.getDatasource().getRows();
        return { count: rows.length, all: rows.every((row) => row.country === 'Norway') };
    });
    check(`${mode}: the grid shows the rows of Norway`, norway.count > 0 && norway.all, norway);
    check(`${mode}: SQL sample: no page errors`, page.__errors.length === 0, page.__errors.join(' | '));
    await page.close();
}

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    try {
        for (const gridTheme of ['default', 'tredespace']) {
            for (const mode of ['light', 'dark']) {
                await findSample(browser, gridTheme, mode);
            }
        }
        for (const mode of ['light', 'dark']) {
            await sqlSample(browser, mode);
        }
    } catch (error) {
        check('the run', false, String(error?.stack ?? error));
    }
    await browser.close();
    console.log(results.join('\n'));
    console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
})();
