// Real browser check of the data bars, colour scales and icon sets of a number column (ColumnFormat.bar,
// scale, icons - dataBars.ts, showCellColor.ts, columnSettingsBars.ts) and the colours of the Excel export
// (gridExcel.ts, xlsx.ts), on the "Full grid" sample (#sample/full-grid), in the four looks: default and
// TreDeSpace, light and dark.
// - the sample's own: Balance a bar (negatives left of 0, red text by a rule over it), the months a heat
//   map (red - yellow - green), KPI 1 arrows
// - the dialog by mouse (default light): KPI 2 - Data bar (Green), Colour scale, Icons (Traffic lights,
//   thresholds 20 / 80), the five cells of its preview, Apply & close. The other looks get the same format
//   by setState
// - every cell on screen: the bar's start and end (the computed gradient) vs its value and the range of the
//   rows, the scale's colour vs the mix of the palette's two colours, the icon's level vs the thresholds
// - a header filter changes the range: the largest value shown has a whole bar; scrolling keeps every cell
//   right (cells reused)
// - contrast: the number 4.5:1 on the bar and on the scale's colour (and the row), the icons 3:1
// - no rounded corners; a phone (390px): the cells, the dialog's section without a sideways scroll
// - the Excel download (Excel (all rows)), unzipped here: styles.xml has the rules' font and fill colours,
//   the sheet Excel's own dataBar, colorScale and iconSet after the autofilter, the cfvos and colours
// Usage: node data-bars-check.js <site url> [shots dir]
const path = require('node:path');
const fs = require('node:fs');
const zlib = require('node:zlib');
const [, , base, shots] = process.argv;
if (!base) {
    console.log('usage: node data-bars-check.js <site url> [screenshot dir]');
    process.exit(2);
}
const { chromium, devices } = require('playwright');
// a column's settings are in tabs: an element of a hidden one, its tab clicked first
require('../sections')();
if (shots) {
    fs.mkdirSync(shots, { recursive: true });
}

const results = [];
const check = (name, ok, detail = '') =>
    results.push(
        `${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? `  (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : ''}`
    );

/** in the page: colours as drawn, their contrast, the colour of a css variable in a cell */
const COLOUR_TOOLS = `
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
// a css value as the element resolves it (var(), light-dark()): a probe in it
window.__resolved = (element, value, property = 'backgroundColor') => {
    const probe = document.createElement('span');
    probe.style[property] = value;
    element.appendChild(probe);
    const resolved = getComputedStyle(probe)[property];
    probe.remove();
    return resolved;
};
`;

/** the entries of a ZIP (APPNOTE: the central directory, each entry's local header), inflated */
function unzip(buffer) {
    const end = buffer.length - 22;
    const count = buffer.readUInt16LE(end + 10);
    let at = buffer.readUInt32LE(end + 16);
    const entries = {};
    for (let i = 0; i < count; i++) {
        const method = buffer.readUInt16LE(at + 10);
        const size = buffer.readUInt32LE(at + 20);
        const nameLength = buffer.readUInt16LE(at + 28);
        const extra = buffer.readUInt16LE(at + 30);
        const comment = buffer.readUInt16LE(at + 32);
        const offset = buffer.readUInt32LE(at + 42);
        const name = buffer.subarray(at + 46, at + 46 + nameLength).toString('utf8');
        const local = offset + 30 + buffer.readUInt16LE(offset + 26) + buffer.readUInt16LE(offset + 28);
        const data = buffer.subarray(local, local + size);
        entries[name] = (method === 8 ? zlib.inflateRawSync(data) : data).toString('utf8');
        at += 46 + nameLength + extra + comment;
    }
    return entries;
}

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];
    const looks = [
        { theme: 'light', grid: 'default' },
        { theme: 'dark', grid: 'default' },
        { theme: 'light', grid: 'tredespace' },
        { theme: 'dark', grid: 'tredespace' }
    ];
    // the format the dialog gives KPI 2
    const KPI2 = {
        bar: { color: 'green' },
        scale: { minColor: 'red', midColor: 'yellow', maxColor: 'green' },
        icons: { set: 'traffic', thresholds: [20, 80] }
    };

    for (const look of looks) {
        const name = `${look.grid}-${look.theme}`;
        const first = name === 'default-light';
        const context = await browser.newContext({ viewport: { width: 1300, height: 1000 }, acceptDownloads: true });
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
        const shot = async (file, locator) => {
            if (shots) {
                await (locator ?? page).screenshot({ path: `${shots}/${file}-${name}.png` });
            }
        };
        const dialogSel = 'dialog.column-settings';
        const byId = (part) => page.locator(`${dialogSel} [id$="-settings-${part}"]`);

        /** the grid shows the field's column: scrolled sideways to it */
        const scrollTo = async (field) => {
            await page.evaluate((f) => {
                const grid = document.querySelector('.stage simple-html-grid');
                const config = grid.grid.gridInterface.__getGridConfig();
                let left = 0;
                for (const column of config.layout.center) {
                    if (column.fields.includes(f)) {
                        break;
                    }
                    left += column.width;
                }
                const scroller = grid.querySelector('.simple-html-grid-middle-scroller');
                scroller.scrollLeft = Math.max(0, left - 200);
                scroller.dispatchEvent(new Event('scroll'));
            }, field);
            await page.waitForTimeout(250);
        };

        /**
         * every cell of a field on screen: its value, what the grid computed for it - the bar's ends (from the
         * computed gradient), the scale's colour, the icon - what it should be from the range of the rows the
         * filter lets through, and the contrasts of its number and icon
         */
        const measure = (field) =>
            page.evaluate((f) => {
                const grid = document.querySelector('.stage simple-html-grid');
                const gi = grid.grid.gridInterface;
                const datasource = gi.getDatasource();
                const format = gi.__getGridConfig().columns[f].format ?? {};
                const min = datasource.aggregate(f, 'min');
                const max = datasource.aggregate(f, 'max');
                const cells = [...grid.querySelectorAll('.simple-html-grid-col-cell[type="row-cell"]')].filter(
                    (c) => c.$attribute === f && c.closest('.simple-html-grid-row').style.display === 'block'
                );
                const mix = (a, b, t) => a.map((channel, i) => (i < 3 ? channel * (1 - t) + b[i] * t : 1));
                const far = (a, b) => Math.max(...[0, 1, 2].map((i) => Math.abs(a[i] - b[i]))) * 255;
                const problems = [];
                let minText = 99;
                let minIcon = 99;
                let bars = 0;
                let scales = 0;
                let icons = 0;
                for (const cell of cells) {
                    const value = datasource.getRow(cell.$row)?.[f];
                    if (typeof value !== 'number') {
                        continue;
                    }
                    const style = getComputedStyle(cell);
                    const input = cell.querySelector('input');
                    const text = window.__rgb(getComputedStyle(input ?? cell).color);
                    const rowBg = window.__rgb(getComputedStyle(cell.closest('.simple-html-grid-row')).backgroundColor);
                    const under = [];
                    // the bar: its ends in the gradient vs the value's place
                    if (format.bar) {
                        const lo = format.bar.min ?? Math.min(0, min);
                        const hi = format.bar.max ?? Math.max(0, max);
                        const place = (v) => (Math.min(Math.max(v, lo), hi) - lo) / (hi - lo);
                        const want = [Math.min(place(0), place(value)), Math.max(place(0), place(value))].map((p) => p * 100);
                        // the gradient's stops: its arguments at the top level, each a colour and its place
                        const inner = style.backgroundImage.slice(style.backgroundImage.indexOf('(') + 1, -1);
                        const parts = [];
                        let depth = 0;
                        let from = 0;
                        for (let i = 0; i < inner.length; i++) {
                            depth += inner[i] === '(' ? 1 : inner[i] === ')' ? -1 : 0;
                            if (inner[i] === ',' && depth === 0) {
                                parts.push(inner.slice(from, i));
                                from = i + 1;
                            }
                        }
                        parts.push(inner.slice(from));
                        const stops = parts.slice(1).map((part) => Number.parseFloat(part.trim().split(' ').at(-1)));
                        const got = [stops[0], stops[2]];
                        if (
                            !cell.classList.contains('simple-html-grid-cell-bar') ||
                            Math.abs(got[0] - want[0]) > 0.02 ||
                            Math.abs(got[1] - want[1]) > 0.02
                        ) {
                            problems.push(`bar of ${value}: ${got} not ${want.map((p) => p.toFixed(2))}`);
                        }
                        bars++;
                        under.push(window.__rgb(window.__resolved(cell, 'var(--simple-html-grid-bar-color)')));
                    }
                    // the scale: the cell's colour vs the mix of the palette's two colours
                    const cellBg = window.__rgb(style.backgroundColor);
                    if (format.scale && cell.classList.contains('simple-html-grid-cell-scale')) {
                        const { minColor, midColor, maxColor } = format.scale;
                        const colour = (c) =>
                            window.__rgb(window.__resolved(cell, `var(--simple-html-grid-palette-${c}-bg-color)`));
                        const t = (value - min) / (max - min || 1);
                        const want = midColor
                            ? t <= 0.5
                                ? mix(colour(minColor), colour(midColor), t * 2)
                                : mix(colour(midColor), colour(maxColor), (t - 0.5) * 2)
                            : mix(colour(minColor), colour(maxColor), t);
                        // a few 255ths apart: a colour of TreDeSpace out of sRGB is clipped by the canvas here
                        if (far(cellBg, want) > 6) {
                            problems.push(
                                `scale of ${value}: ${cellBg.map((c) => Math.round(c * 255))} not ${want.map((c) => Math.round(c * 255))}`
                            );
                        }
                        scales++;
                        under.push(cellBg);
                    } else {
                        under.push(cellBg[3] === 0 ? rowBg : cellBg);
                    }
                    for (const bg of under) {
                        minText = Math.min(minText, window.__contrast(text, bg));
                    }
                    // the icon: its level vs the thresholds, its colour on what is under it
                    if (format.icons) {
                        const [a, b] = format.icons.thresholds ?? [33, 67];
                        const level =
                            format.icons.unit === 'number'
                                ? value >= b
                                    ? 'high'
                                    : value >= a
                                      ? 'middle'
                                      : 'low'
                                : (value - min) * 100 >= b * (max - min)
                                  ? 'high'
                                  : (value - min) * 100 >= a * (max - min)
                                    ? 'middle'
                                    : 'low';
                        const icon = cell.querySelector('.simple-html-grid-cell-icon');
                        if (icon?.dataset.level !== level) {
                            problems.push(`icon of ${value}: ${icon?.dataset.level} not ${level}`);
                        } else {
                            const iconColour = window.__rgb(getComputedStyle(icon).color);
                            for (const bg of under) {
                                minIcon = Math.min(minIcon, window.__contrast(iconColour, bg));
                            }
                            // the icon's text for a screen reader describes the input
                            if (input.getAttribute('aria-describedby') !== icon.id || !icon.textContent.trim()) {
                                problems.push(`icon of ${value} not the input's description`);
                            }
                        }
                        icons++;
                    }
                    // square: no rounded corners
                    if (style.borderRadius !== '0px') {
                        problems.push(`rounded ${style.borderRadius}`);
                    }
                }
                return {
                    cells: cells.length,
                    bars,
                    scales,
                    icons,
                    problems,
                    minText: Math.round(minText * 100) / 100,
                    minIcon: Math.round(minIcon * 100) / 100
                };
            }, field);

        const expectCells = (label, m, { bars = false, scales = false, icons = false } = {}) => {
            check(
                `${name}: ${label} - every cell on screen right`,
                m.cells > 5 &&
                    m.problems.length === 0 &&
                    (!bars || m.bars > 5) &&
                    (!scales || m.scales > 5) &&
                    (!icons || m.icons > 5),
                { cells: m.cells, bars: m.bars, scales: m.scales, icons: m.icons, problems: m.problems.slice(0, 4) }
            );
            check(`${name}: ${label} - the number 4.5:1 on the bar, the scale and the row`, m.minText >= 4.5, m.minText);
            if (icons) {
                check(`${name}: ${label} - the icons 3:1 on what is under them`, m.minIcon >= 3, m.minIcon);
            }
        };

        // the sample's own: Balance, the months, KPI 1
        await scrollTo('balance');
        expectCells('Balance (a bar, negatives, a rule)', await measure('balance'), { bars: true });
        await shot('data-bars-balance');
        await scrollTo('jan');
        expectCells('Jan (a scale)', await measure('jan'), { scales: true });
        expectCells('Mar (a scale)', await measure('mar'), { scales: true });
        await shot('data-bars-months');
        await scrollTo('kpi1');
        expectCells('KPI 1 (icons)', await measure('kpi1'), { icons: true });

        if (first) {
            // the dialog by mouse: KPI 2
            await page.evaluate(() =>
                document.querySelector('.stage simple-html-grid').grid.gridInterface.openColumnSettings('kpi2')
            );
            await page.waitForSelector(dialogSel);
            await byId('bars-bar').click();
            await page.locator(`${dialogSel} input[name$="-settings-bars-bar-color"][aria-label="Green"]`).click();
            await byId('bars-scale').click();
            await byId('bars-icons').click();
            await page.locator(`${dialogSel} label[data-tooltip="Traffic lights"]`).click();
            await byId('bars-icons-low').fill('20');
            await byId('bars-icons-high').fill('80');
            await page.waitForTimeout(100);
            const preview = await page.evaluate((sel) => {
                const cells = [...document.querySelectorAll(`${sel} .column-settings-bars-sample`)];
                return cells.map((cell) => ({
                    bar: getComputedStyle(cell).backgroundImage.includes('gradient'),
                    scale: cell.classList.contains('simple-html-grid-cell-scale'),
                    icon: cell.querySelector('.simple-html-grid-cell-icon')?.dataset.level,
                    shape: cell.querySelector('.simple-html-grid-cell-icon')?.dataset.shape
                }));
            }, dialogSel);
            check(
                `${name}: the dialog's five cells - bars, the scale, the traffic lights low, low, middle, middle, high`,
                preview.length === 5 &&
                    preview.every((p) => p.bar && p.scale && p.shape === 'circle') &&
                    preview.map((p) => p.icon).join() === 'low,middle,middle,middle,high',
                preview
            );
            // the section in view: its panel scrolled, not the dialog (a scroll container too, overflow hidden)
            await page.evaluate((sel) => {
                const dialog = document.querySelector(sel);
                dialog.querySelector('.column-settings-bars').scrollIntoView();
                dialog.scrollTop = 0;
                dialog.scrollLeft = 0;
            }, dialogSel);
            await shot('data-bars-dialog', page.locator(dialogSel));
            // a number that is no number: the problem, Apply waits
            await byId('bars-bar-min').fill('abc');
            const problem = await page.locator(`${dialogSel} .column-settings-bars .column-settings-problem`).allTextContents();
            check(`${name}: a min that is no number is said`, problem.join() === 'abc is no number', problem);
            await byId('bars-bar-min').fill('');
            await page.locator(`${dialogSel} button`, { hasText: /^\s*Apply & close\s*$/ }).click();
            await page.waitForTimeout(200);
            const state = await page.evaluate(
                () => document.querySelector('.stage simple-html-grid').grid.gridInterface.getState().formats.kpi2
            );
            check(
                `${name}: Apply - the state has KPI 2's bar, scale and icons`,
                JSON.stringify(state) === JSON.stringify(KPI2),
                state
            );
        } else {
            // the formats of the sample kept: setState() replaces them all
            await page.evaluate((f) => {
                const gi = document.querySelector('.stage simple-html-grid').grid.gridInterface;
                gi.setState({ formats: { ...gi.getState().formats, kpi2: f } });
            }, KPI2);
            await page.waitForTimeout(200);
        }
        await scrollTo('kpi2');
        expectCells('KPI 2 (bar, scale, icons)', await measure('kpi2'), { bars: true, scales: true, icons: true });
        await shot('data-bars-kpi2');

        if (first) {
            // a header filter: KPI 2 >= 50 - the range of the rows it lets through
            const filter = page.getByRole('textbox', { name: 'Filter Kpi2' });
            await filter.fill('50');
            await filter.press('Enter');
            await page.waitForTimeout(300);
            const filtered = await page.evaluate(() => {
                const ds = document.querySelector('.stage simple-html-grid').grid.gridInterface.getDatasource();
                return { min: ds.aggregate('kpi2', 'min'), rows: ds.length() };
            });
            check(`${name}: the header filter lets 50 and up through`, filtered.min >= 50 && filtered.rows < 5000, filtered);
            expectCells('KPI 2 filtered', await measure('kpi2'), { bars: true, scales: true, icons: true });
            await shot('data-bars-filtered');
            await filter.fill('');
            await filter.press('Enter');
            await page.waitForTimeout(300);

            // scrolling down: the cells reused show their own rows
            for (const top of [3000, 30000, 60000]) {
                await page.evaluate((t) => {
                    const s = document.querySelector('.stage .simple-html-grid-body-scroller');
                    s.scrollTop = t;
                    s.dispatchEvent(new Event('scroll'));
                }, top);
                await page.waitForTimeout(500);
                expectCells(`KPI 2 scrolled to ${top}px`, await measure('kpi2'), { bars: true, scales: true, icons: true });
            }

            // the Excel download, read back
            const [download] = await Promise.all([
                page.waitForEvent('download'),
                page.getByRole('button', { name: 'Excel (all rows)' }).click()
            ]);
            const file = await download.path();
            const parts = unzip(fs.readFileSync(file));
            const sheet = parts['xl/worksheets/sheet1.xml'];
            const styles = parts['xl/styles.xml'];
            if (shots) {
                fs.writeFileSync(`${shots}/data-bars-export.xlsx`, fs.readFileSync(file));
            }
            const rules = [
                ...sheet.matchAll(/<conditionalFormatting sqref="([^"]+)"><cfRule type="(\w+)" priority="(\d+)">/g)
            ].map((m) => ({ sqref: m[1], type: m[2], priority: Number(m[3]) }));
            const types = rules.map((rule) => rule.type);
            check(
                `${name}: Excel - Balance a dataBar, 12 colorScales of the months, KPI 1 an iconSet, KPI 2 all three`,
                types.filter((t) => t === 'dataBar').length === 2 &&
                    types.filter((t) => t === 'colorScale').length === 13 &&
                    types.filter((t) => t === 'iconSet').length === 2,
                types.join()
            );
            check(
                `${name}: Excel - the priorities 1, 2 ... and after the autofilter`,
                rules.every((rule, i) => rule.priority === i + 1) &&
                    sheet.indexOf('<autoFilter') < sheet.indexOf('<conditionalFormatting'),
                rules.length
            );
            check(
                `${name}: Excel - KPI 2's icons: traffic lights from 20 and 80 %, its scale red - yellow - green`,
                sheet.includes(
                    '<iconSet iconSet="3TrafficLights1"><cfvo type="percent" val="0"/><cfvo type="percent" val="20"/><cfvo type="percent" val="80"/></iconSet>'
                ) && sheet.includes('<color rgb="FFFECACA"/><color rgb="FFFEF08A"/><color rgb="FFBBF7D0"/>'),
                ''
            );
            check(
                `${name}: Excel - the bars from MIN(0, ...) to MAX(0, ...) of the column`,
                /<dataBar minLength="0" maxLength="100"><cfvo type="formula" val="MIN\(0,MIN\(\$[A-Z]+\$2:\$[A-Z]+\$5001\)\)"\/>/.test(
                    sheet
                ),
                ''
            );
            // the rules' colours: Balance < 0 red text, Status waiting on orange - the cells' own styles
            check(
                `${name}: Excel - styles.xml has the rules' red text font and orange fill`,
                styles.includes('<color rgb="FF90101A"/>') && styles.includes('<fgColor rgb="FFFED7AA"/>'),
                ''
            );
            const fills = /<fills count="(\d+)">(.*?)<\/fills>/.exec(styles);
            const fonts = /<fonts count="(\d+)">(.*?)<\/fonts>/.exec(styles);
            const xfs = /<cellXfs count="(\d+)">(.*?)<\/cellXfs>/.exec(styles);
            check(
                `${name}: Excel - the counts of fonts, fills and cellXfs are their elements`,
                fills &&
                    fonts &&
                    xfs &&
                    Number(fills[1]) === (fills[2].match(/<fill>/g) ?? []).length &&
                    Number(fonts[1]) === (fonts[2].match(/<font>/g) ?? []).length &&
                    Number(xfs[1]) === (xfs[2].match(/<xf /g) ?? []).length,
                { fills: fills?.[1], fonts: fonts?.[1], xfs: xfs?.[1] }
            );
            // a cell with a negative balance: its style's font is the red one
            const negative = await page.evaluate(() => {
                const grid = document.querySelector('.stage simple-html-grid');
                const rows = grid.grid.gridInterface.getDatasource().getDataRows();
                return rows.findIndex((row) => row.balance < 0);
            });
            const fields = await page.evaluate(() =>
                document.querySelector('.stage simple-html-grid').grid.gridInterface.getLayoutFields()
            );
            const letter = (i) => {
                let s = '';
                for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
                return s;
            };
            const reference = `${letter(fields.indexOf('balance'))}${negative + 2}`;
            const s = Number(new RegExp(`<c r="${reference}" s="(\\d+)"`).exec(sheet)?.[1] ?? -1);
            const xf = (xfs?.[2].match(/<xf [^>]*?(\/>|>.*?<\/xf>)/g) ?? [])[s] ?? '';
            const fontId = Number(/fontId="(\d+)"/.exec(xf)?.[1] ?? -1);
            const font = (fonts?.[2].match(/<font>.*?<\/font>/g) ?? [])[fontId] ?? '';
            check(`${name}: Excel - a negative balance (${reference}) in the rule's red`, font.includes('FF90101A'), font);
            // and without colours
            const plain = await page.evaluate(async () => {
                const blob = await document
                    .querySelector('.stage simple-html-grid')
                    .grid.gridInterface.getExcel({ colors: false });
                return [...new Uint8Array(await blob.arrayBuffer())];
            });
            const plainParts = unzip(Buffer.from(plain));
            check(
                `${name}: Excel - colors: false has no conditional formatting and no fills`,
                !plainParts['xl/worksheets/sheet1.xml'].includes('conditionalFormatting') &&
                    plainParts['xl/styles.xml'].includes('<fills count="2">'),
                ''
            );
        }
        await context.close();
    }

    // a phone: the cells, the dialog's section without a sideways scroll
    const { defaultBrowserType: _webkit, ...iphone } = devices['iPhone 13'];
    const phone = await browser.newContext(iphone);
    const page = await phone.newPage();
    page.on('pageerror', (e) => errors.push(`phone: ${e}`));
    await page.goto(`${base}#sample/full-grid`);
    await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
    await page.waitForTimeout(400);
    // the pinned columns take the phone's width: a bar and icons on Id (pinned left), a scale on Total (right)
    const onPhone = await page.evaluate(() => {
        const grid = document.querySelector('.stage simple-html-grid');
        grid.grid.gridInterface.setState({
            formats: {
                id: { bar: { color: 'purple' }, icons: { set: 'symbols' } },
                total: { scale: { minColor: 'blue', maxColor: 'pink' } }
            }
        });
        return new Promise((resolve) =>
            setTimeout(
                () =>
                    resolve({
                        bars: grid.querySelectorAll('.simple-html-grid-cell-bar').length,
                        scales: grid.querySelectorAll('.simple-html-grid-cell-scale').length,
                        icons: grid.querySelectorAll('.simple-html-grid-cell-icon').length,
                        page: document.documentElement.scrollWidth <= innerWidth + 1
                    }),
                300
            )
        );
    });
    check(
        'phone: bars, scales and icons on screen, no sideways scroll of the page',
        onPhone.bars > 5 && onPhone.scales > 5 && onPhone.icons > 5 && onPhone.page,
        onPhone
    );
    if (shots) {
        await page.screenshot({ path: `${shots}/data-bars-phone.png` });
    }
    await page.evaluate(() => document.querySelector('.stage simple-html-grid').grid.gridInterface.openColumnSettings('kpi2'));
    await page.waitForSelector('dialog.column-settings');
    for (const kind of ['bar', 'scale', 'icons']) {
        await page.locator(`dialog.column-settings [id$="-settings-bars-${kind}"]`).tap();
    }
    await page.waitForTimeout(150);
    const fits = await page.evaluate(() => {
        const dialog = document.querySelector('dialog.column-settings');
        const section = dialog.querySelector('.column-settings-bars');
        section.scrollIntoView();
        dialog.scrollTop = 0;
        dialog.scrollLeft = 0;
        const box = dialog.getBoundingClientRect();
        const wide = [...section.querySelectorAll('*')].filter((el) => el.getBoundingClientRect().right > box.right + 1);
        return { dialog: Math.round(box.width), inner: innerWidth, outside: wide.map((el) => el.className).slice(0, 5) };
    });
    check(
        'phone: the dialog section fits the dialog, the dialog the screen',
        fits.dialog <= fits.inner && fits.outside.length === 0,
        fits
    );
    if (shots) {
        await page.screenshot({ path: `${shots}/data-bars-phone-dialog.png` });
    }
    await phone.close();

    check('no page errors', errors.length === 0, errors.slice(0, 5));
    await browser.close();
    console.log(results.join('\n'));
    console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
})();
