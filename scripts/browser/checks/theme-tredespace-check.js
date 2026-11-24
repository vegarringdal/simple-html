// The grid's four looks in a real browser: the default theme and the TreDeSpace theme
// (theme-tredespace.css, data-grid-theme="tredespace" on the body), each light and dark - the demo's
// "Grid theme" select and "Toggle dark/light" (localStorage simple-html-demo-grid-theme /
// simple-html-demo-theme).
//
// On the full grid and the filtering samples: the cells, the header, the filter row, selected rows, a
// range, the focus outline, a menu with a submenu, the date picker, a tooltip, the footer's filter
// chips, the filter editor. Each colour is read from the element (getComputedStyle, drawn on a canvas
// for its sRGB pixel) and compared:
// - TreDeSpace: with the TreDeSpace UI library's tokens, read from the library's own page
//   (https://tredespace.com/docs/widgets: its --color-* custom properties, dark and with
//   data-theme="light") and checked against its source (styles.css, Tailwind 4.3.3). Offline: the
//   source only
// - default: with grid.css's colours (the default theme is unchanged)
// - no colour of the default palette is left in a TreDeSpace grid or its popovers (the checkboxes left
//   out: the browser draws them, in both themes)
// Screenshots of the four at 1300 x 1400, and the library's widgets next to the grid in each mode.
//
// Usage: node theme-tredespace-check.js <site url> <shots dir> [--offline]
const path = require('node:path');
const fs = require('node:fs');
const [, , base, shots, flag] = process.argv;
if (!base || !shots) {
    console.log('usage: node theme-tredespace-check.js <site url> <shots dir> [--offline]');
    process.exit(2);
}
const { chromium } = require('playwright');
const LIBRARY_URL = 'https://tredespace.com/docs/widgets';
fs.mkdirSync(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
const info = (text) => results.push(`INFO  ${text}`);

// the library's tokens from its source: src/treDeSpaceUI/styles.css (the dark surfaces, the light
// theme) and tailwindcss@4.3.3 theme.css for the rest of the dark ones
const SOURCE_TOKENS = {
    dark: {
        'slate-950': '#080f21',
        'slate-900': '#172033',
        'slate-800': '#283548',
        'slate-700': 'oklch(37.2% 0.044 257.287)',
        // the frame of a menu: stronger than the library's slate-800 - the user found the menus faint (2026-11-23)
        'menu-frame': 'oklch(44.6% 0.043 257.281)',
        'slate-200': 'oklch(92.9% 0.013 255.508)',
        'blue-950': 'oklch(28.2% 0.091 267.935)',
        'blue-900': 'oklch(37.9% 0.146 265.522)',
        'blue-400': 'oklch(70.7% 0.165 254.624)'
    },
    light: {
        'slate-950': '#f1f5f9',
        'slate-900': '#f8fafc',
        'slate-800': '#e2e8f0',
        'slate-700': '#cbd5e1',
        'menu-frame': '#cbd5e1',
        'slate-200': '#1e293b',
        'blue-950': '#dbeafe',
        'blue-900': '#bfdbfe',
        'blue-400': '#2563eb'
    }
};
// the library's own tokens: the menu frame is the grid's
const TOKEN_NAMES = Object.keys(SOURCE_TOKENS.dark).filter((name) => name !== 'menu-frame');

// what the grid's parts are: a token of the library (TreDeSpace) - mix: two tokens half and half, #: a
// colour of the library's Tooltip - and the default theme's colour from grid.css / date.css
const ROLES = [
    // [part, element, property, TreDeSpace, default light, default dark]
    ['the grid, the bars', 'root', 'backgroundColor', 'slate-900', '#f5f5f5', '#374151'],
    ['a label', 'label', 'backgroundColor', 'slate-900', '#f5f5f5', '#374151'],
    ['the filter row', 'filterCol', 'backgroundColor', 'slate-950', '#ffffff', '#4b5563'],
    ['a filter input text', 'filterInput', 'color', 'slate-200', '#2e2d2d', '#f9f7f7'],
    ['an even row', 'rowEven', 'backgroundColor', 'slate-950', '#ffffff', '#4b5563'],
    ['an odd row', 'rowOdd', 'backgroundColor', 'mix:slate-950,slate-900', '#f7f7f7', '#5a6370'],
    ['a cell text', 'cellInput', 'color', 'slate-200', '#2e2d2d', '#f9f7f7'],
    ['the line under a cell', 'cell', 'borderBottomColor', 'slate-800', '#e6e5e5', '#1f2937'],
    ['the line under the header', 'header', 'borderBottomColor', 'slate-700', '#d1d0d0', '#1f2937'],
    ['a selected row (even)', 'selectedEven', 'backgroundColor', 'blue-950', '#afc7db', '#274e8f'],
    ['a selected row (odd)', 'selectedOdd', 'backgroundColor', 'mix:blue-950,blue-900', '#bdd4e7', '#234882'],
    ['the line of a range', 'rangeTop', 'borderTopColor', 'blue-400', '#1e40af', '#dbeafe'],
    ['the focus outline', 'focused', 'outlineColor', 'blue-400', '#005fcc', '#b3d7ff'],
    ['the footer', 'footer', 'backgroundColor', 'slate-900', '#f5f5f5', '#374151'],
    ['a menu', 'menu', 'backgroundColor', 'slate-900', '#f5f5f5', '#374151'],
    ['the frame of a menu', 'menu', 'borderTopColor', 'menu-frame', '#e6e5e5', '#1f2937'],
    ['a menu item under the pointer', 'menuHover', 'backgroundColor', 'blue-950', '#afc7db', '#274e8f'],
    ['a menu item text', 'menuHover', 'color', 'slate-200', '#2e2d2d', '#f9f7f7'],
    ['the date picker', 'date', 'backgroundColor', 'slate-900', '#ffffff', '#374151'],
    ['the date picker text', 'date', 'color', 'slate-200', '#2e2d2d', '#f9f7f7'],
    ['a tooltip', 'tooltip', 'backgroundColor', '#242933', '#ffffff', '#4b5563'],
    ['a tooltip text', 'tooltip', 'color', '#c9cfd8', '#2e2d2d', '#f9f7f7'],
    ['a filter chip', 'chip', 'backgroundColor', 'slate-950', '#ffffff', '#4b5563'],
    ['the filter editor', 'editor', 'backgroundColor', 'slate-900', '#f5f5f5', '#374151'],
    ['the frame of the filter editor', 'editor', 'borderTopColor', 'slate-700', '#d1d0d0', '#1f2937'],
    ['Apply', 'primary', 'backgroundColor', 'blue-400', '#2563eb', '#93c5fd'],
    ['the scrollbar thumb', 'scroller', 'thumb', 'thumb:blue-400,slate-800', '#bdd4e7', '#234882'],
    ['the scrollbar track', 'scroller', 'track', 'slate-900', '#ffffff', '#4b5563']
];

/** in the page: window.__pixel(colour), the pixel of a css colour on a canvas as #rrggbb (null: alpha 0) */
const PIXEL_SCRIPT = () => {
    window.__pixel = (colour) => {
        window.__canvas ??= document.createElement('canvas');
        const canvas = window.__canvas;
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d', { colorSpace: 'srgb', willReadFrequently: true });
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = '#000';
        ctx.fillStyle = colour;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        return a === 0 ? null : `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    };
};

const channel = (hex, i) => Number.parseInt(hex.slice(i, i + 2), 16);
const near = (a, b, by = 1) => !!a && !!b && [1, 3, 5].every((i) => Math.abs(channel(a, i) - channel(b, i)) <= by);
const mixHex = (a, b) =>
    `#${[1, 3, 5]
        .map((i) =>
            Math.round((channel(a, i) + channel(b, i)) / 2)
                .toString(16)
                .padStart(2, '0')
        )
        .join('')}`;

/** the colours of one element: background, text, the top and bottom borders, the outline */
const ONE_SCRIPT = () => {
    window.__one = (el, pseudo) => {
        if (!el) return null;
        const style = getComputedStyle(el, pseudo);
        return {
            backgroundColor: window.__pixel(style.backgroundColor),
            color: window.__pixel(style.color),
            borderTopColor: window.__pixel(style.borderTopColor),
            borderBottomColor: window.__pixel(style.borderBottomColor),
            outlineColor: style.outlineStyle === 'none' ? null : window.__pixel(style.outlineColor)
        };
    };
};

/**
 * The library's tokens as its page draws them: its --color-* in dark (its default) and with
 * data-theme="light", read on its widgets page. Some colours of its widgets, and screenshots of them
 */
async function libraryLook(browser) {
    const tokens = {};
    const shotsOf = {};
    const widgets = {};
    for (const mode of ['dark', 'light']) {
        const page = await browser.newPage({ viewport: { width: 1300, height: 1000 }, colorScheme: mode });
        await page.goto(LIBRARY_URL, { waitUntil: 'networkidle', timeout: 30000 });
        await page.evaluate(PIXEL_SCRIPT);
        await page.evaluate((light) => {
            if (light) document.documentElement.setAttribute('data-theme', 'light');
            else document.documentElement.removeAttribute('data-theme');
        }, mode === 'light');
        tokens[mode] = await page.evaluate(
            (names) =>
                Object.fromEntries(
                    names.map((name) => [
                        name,
                        window.__pixel(getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim())
                    ])
                ),
            TOKEN_NAMES
        );
        // its scrollbar thumb (styles.css): the colour its page gives ::-webkit-scrollbar-thumb
        tokens[mode].thumb = await page.evaluate(() => {
            const probe = document.createElement('div');
            probe.style.background = 'color-mix(in srgb, var(--color-blue-400) 45%, var(--color-slate-800))';
            document.body.appendChild(probe);
            const pixel = window.__pixel(getComputedStyle(probe).backgroundColor);
            probe.remove();
            return pixel;
        });
        // the widgets themselves, not the page around them: the box with the widget tabs
        const box = page.locator('div.flex.overflow-hidden.bg-slate-950').first();
        await box.scrollIntoViewIfNeeded();
        const tab = async (name) => {
            await page.evaluate((n) => {
                const span = [...document.querySelectorAll('button span.truncate')].find((e) => e.textContent.trim() === n);
                span.closest('button').click();
            }, name);
            await page.waitForTimeout(400);
        };
        // a tree with a selected row
        await tab('TreeView');
        widgets[mode] = await page.evaluate(() => {
            const row = [...document.querySelectorAll('[class*="bg-blue-950"]')].find((e) => e.textContent.includes('PIPE-8821'));
            return { treeSelected: row ? window.__pixel(getComputedStyle(row).backgroundColor) : null };
        });
        shotsOf[`${mode}-tree`] = await box.screenshot();
        // an open menu
        await tab('Menu');
        await page.getByText('Right-click here', { exact: false }).first().click({ button: 'right' });
        await page.waitForTimeout(300);
        Object.assign(
            widgets[mode],
            await page.evaluate(() => {
                const menu = document.querySelector('[role="menu"]');
                if (!menu) return {};
                const style = getComputedStyle(menu);
                const item = menu.querySelector('[role="menuitem"]');
                return {
                    menuBg: window.__pixel(style.backgroundColor),
                    menuBorder: window.__pixel(style.borderTopColor),
                    menuText: item ? window.__pixel(getComputedStyle(item).color) : null
                };
            })
        );
        shotsOf[`${mode}-menu`] = await box.screenshot();
        await page.keyboard.press('Escape');
        // an open date picker
        await tab('DatePicker');
        await page.getByText('Pick a date', { exact: false }).first().click();
        await page.waitForTimeout(300);
        Object.assign(
            widgets[mode],
            await page.evaluate(() => {
                const pop = [...document.querySelectorAll('.fixed')].find((e) => e.textContent.includes('wk'));
                return pop ? { dateBg: window.__pixel(getComputedStyle(pop).backgroundColor) } : {};
            })
        );
        shotsOf[`${mode}-date`] = await box.screenshot();
        await page.close();
    }
    return { tokens, shots: shotsOf, widgets };
}

/**
 * every colour the elements under these selectors show: text, background, the borders they have, an
 * outline. As #rrggbb, transparent left out
 */
async function collectColours(page, selectors) {
    return page.evaluate((list) => {
        // each colour and the first element that has it, for a message
        const found = new Map();
        let current = '';
        const add = (value) => {
            const pixel = window.__pixel(value);
            if (pixel && !found.has(pixel)) found.set(pixel, current);
        };
        for (const selector of list) {
            for (const top of document.querySelectorAll(selector)) {
                // not the checkboxes: the browser draws them, their background is its Field colour
                for (const el of [top, ...top.querySelectorAll(':not(input[type="checkbox"])')].slice(0, 4000)) {
                    const style = getComputedStyle(el);
                    // not what is not seen: the grid's focus helper input is there at opacity 0
                    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
                    current = `${el.tagName.toLowerCase()}${el.type ? `[type=${el.type}]` : ''}.${[...el.classList].join('.')} in ${el.parentElement?.className}`;
                    add(style.color);
                    add(style.backgroundColor);
                    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
                        if (Number.parseFloat(style[`border${side}Width`]) > 0 && style[`border${side}Style`] !== 'none')
                            add(style[`border${side}Color`]);
                    }
                    if (style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0) add(style.outlineColor);
                }
            }
        }
        return [...found];
    }, selectors);
}

/**
 * The colours of the grid's parts in the full grid and filtering samples, with what is open for them;
 * the screenshots
 */
async function gridLook(browser, gridTheme, mode, tokens) {
    const page = await browser.newPage({ viewport: { width: 1300, height: 1400 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(
        ([dark, theme]) => {
            localStorage.setItem('simple-html-demo-theme', dark ? 'dark' : 'light');
            localStorage.setItem('simple-html-demo-grid-theme', theme);
        },
        [mode === 'dark', gridTheme]
    );
    const name = `${gridTheme} ${mode}`;
    const stage = '.stage simple-html-grid';
    const open = async (sample) => {
        await page.goto(`${base}#sample/${sample}`);
        await page.waitForSelector(`${stage} .simple-html-grid-body .simple-html-grid-col-cell`);
        await page.waitForTimeout(300);
        await page.evaluate(PIXEL_SCRIPT);
        await page.evaluate(ONE_SCRIPT);
    };
    await open('full-grid');

    const state = await page.evaluate(() => ({
        theme: document.body.dataset.gridTheme ?? 'default',
        dark: document.body.classList.contains('dark'),
        select: document.querySelector('.grid-theme-select')?.value
    }));
    check(
        `${name}: the demo's select and toggle give the look`,
        state.theme === gridTheme && state.select === gridTheme && state.dark === (mode === 'dark'),
        JSON.stringify(state)
    );

    // two rows selected (row numbers 2 and 3), a range over rows 6 to 8, the focus on a cell
    const selectors = page.locator(`${stage} .simple-html-grid-body-view-selector .simple-html-grid-row`);
    await selectors.nth(1).click();
    await selectors.nth(2).click({ modifiers: ['Shift'] });
    // a cell: the row's element in each part of the body has row-id left-pinned5, middle-pinned5 ...
    const cellOf = (row, attribute) =>
        page
            .locator(
                `${stage} .simple-html-grid-body .simple-html-grid-row[row-id$="pinned${row}"] input[data-attribute="${attribute}"]`
            )
            .first();
    await cellOf(5, 'company').click();
    await cellOf(7, 'city').click({ modifiers: ['Shift'] });
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(150);

    const seen = await page.evaluate((stageSelector) => {
        const grid = document.querySelector(stageSelector);
        const notSelected = ':not(.simple-html-grid-selected-row-odd):not(.simple-html-grid-selected-row-even)';
        const els = {
            root: grid.querySelector('.simple-html-grid') ?? grid,
            label: grid.querySelector('.simple-html-label'),
            filterCol: grid.querySelector(
                '.simple-html-grid-header .simple-html-grid-col:has(.simple-html-grid-cell-filter-input)'
            ),
            filterInput: grid.querySelector('.simple-html-grid-cell-filter-input'),
            rowEven: grid.querySelector(`.simple-html-grid-body .simple-html-grid-row-even${notSelected}`),
            rowOdd: grid.querySelector(`.simple-html-grid-body .simple-html-grid-row-odd${notSelected}`),
            cell: grid.querySelector('.simple-html-grid-body .simple-html-grid-col-cell'),
            cellInput: grid.querySelector(
                `.simple-html-grid-body .simple-html-grid-row-even${notSelected} .simple-html-grid-col-cell input`
            ),
            header: grid.querySelector('.simple-html-grid-header'),
            selectedEven: grid.querySelector('.simple-html-grid-body .simple-html-grid-selected-row-even'),
            selectedOdd: grid.querySelector('.simple-html-grid-body .simple-html-grid-selected-row-odd'),
            footer: grid.querySelector('.simple-html-grid-footer'),
            focused: document.activeElement?.closest('.simple-html-grid-col-cell') ? document.activeElement : null
        };
        const out = Object.fromEntries(Object.entries(els).map(([key, el]) => [key, window.__one(el)]));
        out.rangeTop = window.__one(grid.querySelector('.simple-html-cell-range-top'), '::after');
        // scrollbar-color: the thumb and the track, two colours cut at the space between them
        const scrollbar = getComputedStyle(grid.querySelector('.simple-html-grid-body-scroller')).scrollbarColor;
        let depth = 0;
        const cut = [...scrollbar].findIndex((c) => {
            depth += c === '(' ? 1 : c === ')' ? -1 : 0;
            return c === ' ' && depth === 0;
        });
        out.scroller = {
            thumb: window.__pixel(scrollbar.slice(0, cut)),
            track: window.__pixel(scrollbar.slice(cut + 1)),
            value: scrollbar
        };
        return out;
    }, stage);

    // a menu on a cell, a submenu open, the pointer on its first item that can be picked (Undo / Redo's
    // are disabled while nothing was changed: the next submenu)
    await page.locator('.main-header h1').first().click();
    await cellOf(12, 'city').click({ button: 'right' });
    await page.waitForSelector('.simple-html-grid-menu[role="menu"]');
    const parents = page.locator('.simple-html-grid-menu[role="menu"]').first().locator('[aria-haspopup="menu"]');
    const enabled = '.simple-html-grid-menu-item:not(.simple-html-grid-menu-item-disabled)';
    let levels = 0;
    for (let i = 0; i < (await parents.count()); i++) {
        await parents.nth(i).hover();
        await page.waitForTimeout(300);
        levels = await page.locator('.simple-html-grid-menu[role="menu"]').count();
        if (levels > 1 && (await page.locator('.simple-html-grid-menu[role="menu"]').nth(1).locator(enabled).count()) > 0) {
            break;
        }
    }
    await page.locator('.simple-html-grid-menu[role="menu"]').nth(1).locator(enabled).first().hover();
    await page.waitForTimeout(150);
    Object.assign(
        seen,
        await page.evaluate(() => {
            const menus = document.querySelectorAll('.simple-html-grid-menu[role="menu"]');
            const hovered = [...menus[1].querySelectorAll('.simple-html-grid-menu-item')].find((e) => e.matches(':hover'));
            return { menu: window.__one(menus[0]), menuHover: window.__one(hovered) };
        })
    );
    check(`${name}: a menu with its submenu open`, levels === 2, `${levels} levels`);
    const fullShot = `${shots}/${gridTheme}-${mode}-full-grid.png`;
    await page.screenshot({ path: fullShot });
    const colours = await collectColours(page, ['.simple-html-grid-menu', stage]);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.locator('.main-header h1').first().click();

    // the filtering sample: the date picker, the filter chips in the footer, a tooltip of a chip, the
    // filter editor
    await open('filtering');
    // the date picker of the date filter
    await page.locator(`${stage} input[aria-label="Filter date"]`).click();
    await page.waitForSelector('.simple-html-date', { state: 'visible' });
    await page.waitForTimeout(200);
    Object.assign(seen, await page.evaluate(() => ({ date: window.__one(document.querySelector('.simple-html-date')) })));
    const dateBox = await page.locator('.simple-html-date').first().boundingBox();
    const dateShot = `${shots}/${gridTheme}-${mode}-date.png`;
    await page.screenshot({
        path: dateShot,
        clip: {
            x: Math.max(0, dateBox.x - 12),
            y: Math.max(0, dateBox.y - 40),
            width: dateBox.width + 24,
            height: dateBox.height + 52
        }
    });
    colours.push(...(await collectColours(page, ['.simple-html-grid-menu'])));
    await page.keyboard.press('Escape');
    await page.locator('.main-header h1').first().click();

    // the footer's filter chips
    await page.getByRole('button', { name: 'Norway AND age < 30' }).click();
    await page.waitForSelector(`${stage} .footer-filter-chip`);
    Object.assign(
        seen,
        await page.evaluate(
            (stageSelector) => ({ chip: window.__one(document.querySelector(`${stageSelector} .footer-filter-chip`)) }),
            stage
        )
    );
    colours.push(...(await collectColours(page, [`${stage} .simple-html-grid-footer`])));

    // the filter editor, and the tooltip of one of its buttons
    await page.getByRole('button', { name: 'Open filter editor' }).click();
    await page.waitForSelector('.filter-editor-content', { state: 'visible' });
    await page.waitForTimeout(200);
    await page.locator('.filter-editor-content [data-tooltip]').first().hover();
    await page.waitForTimeout(400);
    Object.assign(
        seen,
        await page.evaluate(() => {
            const tooltip = [...document.querySelectorAll('.simple-html-grid-tooltip')].find(
                (t) => getComputedStyle(t).display !== 'none'
            );
            return {
                editor: window.__one(document.querySelector('.filter-editor-content')),
                primary: window.__one(document.querySelector('.filter-editor-content .simple-html-grid-button-primary')),
                tooltip: window.__one(tooltip)
            };
        })
    );
    check(`${name}: a tooltip in the filter editor`, !!seen.tooltip);
    const filteringShot = `${shots}/${gridTheme}-${mode}-filtering.png`;
    await page.screenshot({ path: filteringShot });
    colours.push(...(await collectColours(page, ['.filter-editor-content', '.simple-html-grid-tooltip', stage])));

    // every part: its colour
    for (const [part, key, property, tds, defaultLight, defaultDark] of ROLES) {
        const actual = seen[key]?.[property] ?? null;
        let expected;
        if (gridTheme === 'default') {
            expected = mode === 'light' ? defaultLight : defaultDark;
        } else if (tds.startsWith('#')) {
            expected = tds;
        } else if (tds.startsWith('mix:')) {
            const [a, b] = tds.slice(4).split(',');
            expected = mixHex(tokens[mode][a], tokens[mode][b]);
        } else if (tds.startsWith('thumb:')) {
            // the library's own: color-mix(in srgb, blue-400 45%, slate-800), drawn by its page
            expected = tokens[mode].thumb;
        } else {
            expected = tokens[mode][tds];
        }
        check(
            `${name}: ${part} (${property}) ${gridTheme === 'tredespace' ? tds : 'grid.css'}`,
            near(actual, expected, 1),
            `${actual} ~ ${expected}`
        );
    }
    check(`${name}: no error on the page`, errors.length === 0, errors.join(' | '));
    await page.close();
    return { shots: { fullShot, dateShot, filteringShot }, colours: new Map(colours) };
}

/**
 * the colours of the default theme (light and dark) and of the TreDeSpace theme as pixels: from the
 * site's css, the .simple-html-grid / .simple-html-date rules of grid.css and date.css and of the theme
 */
async function paletteColours(browser) {
    const page = await browser.newPage();
    const response = await page.goto(`${base}index.css`);
    const css = await response.text();
    await page.setContent('<p></p>');
    await page.evaluate(PIXEL_SCRIPT);
    const rule = (selector) => {
        const start = css.indexOf(`${selector}{`);
        return start === -1 ? '' : css.slice(start, css.indexOf('}', start));
    };
    const colours = (text) => text.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|oklch\([^)]*\)|\b(?:white|red)\b/gi) ?? [];
    const defaults = [...colours(rule('.simple-html-grid')), ...colours(rule('.simple-html-date'))];
    const tds = [
        ...colours(rule('[data-grid-theme=tredespace] .simple-html-grid')),
        ...colours(rule('[data-grid-theme=tredespace] .simple-html-date'))
    ];
    const pixels = (list) => page.evaluate((l) => [...new Set(l.map((c) => window.__pixel(c)).filter(Boolean))], list);
    const result = {
        defaults: await pixels(defaults),
        tds: await pixels(tds),
        defaultCount: defaults.length,
        tdsCount: tds.length
    };
    await page.close();
    return result;
}

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });

    // the library's tokens from its source, and from its page
    const sourcePage = await browser.newPage();
    await sourcePage.setContent('<p></p>');
    await sourcePage.evaluate(PIXEL_SCRIPT);
    const source = {};
    for (const mode of ['dark', 'light']) {
        source[mode] = await sourcePage.evaluate(
            (t) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, window.__pixel(v)])),
            SOURCE_TOKENS[mode]
        );
        source[mode].thumb = await sourcePage.evaluate(
            (t) => window.__pixel(`color-mix(in srgb, ${t['blue-400']} 45%, ${t['slate-800']})`),
            SOURCE_TOKENS[mode]
        );
    }
    await sourcePage.close();
    let library = null;
    if (flag !== '--offline') {
        try {
            library = await libraryLook(browser);
        } catch (error) {
            info(`the library's page could not be read (${String(error).split('\n')[0]}): the tokens of its source are used`);
        }
    }
    const tokens = library?.tokens ?? source;
    // the menu frame is the grid's own colour, not the library's: from the table above always
    for (const mode of ['dark', 'light']) {
        tokens[mode]['menu-frame'] = source[mode]['menu-frame'];
    }
    if (library) {
        for (const mode of ['dark', 'light']) {
            const off = [...TOKEN_NAMES, 'thumb'].filter((token) => !near(library.tokens[mode][token], source[mode][token], 1));
            check(
                `the library's page draws its ${mode} tokens as its source has them`,
                off.length === 0,
                off.map((t) => `${t} ${library.tokens[mode][t]} ~ ${source[mode][t]}`).join(', ')
            );
        }
    }

    const palette = await paletteColours(browser);
    check(
        'the site has the default and the TreDeSpace colours',
        palette.defaultCount > 60 && palette.tdsCount > 60,
        `${palette.defaultCount} / ${palette.tdsCount}`
    );
    // a colour of both palettes (#2563eb, #dc2626 ...) is not one "left over"
    const defaultOnly = palette.defaults.filter((c) => !palette.tds.some((t) => near(c, t, 1)));

    const looks = {};
    for (const gridTheme of ['default', 'tredespace']) {
        for (const mode of ['light', 'dark']) {
            looks[`${gridTheme}-${mode}`] = await gridLook(browser, gridTheme, mode, tokens);
        }
    }
    for (const mode of ['light', 'dark']) {
        const seen = looks[`tredespace-${mode}`].colours;
        const left = [...seen].filter(([c]) => defaultOnly.includes(c)).map(([c, where]) => `${c} ${where}`);
        check(
            `tredespace ${mode}: no colour of the default palette in the grid and its popovers`,
            left.length === 0,
            `${seen.size} colours seen${left.length ? `, left: ${left.join(', ')}` : ''}`
        );
        const inDefault = [...looks[`default-${mode}`].colours.keys()].filter((c) => defaultOnly.includes(c));
        info(`default ${mode}: ${inDefault.length} of the colours seen are the default palette's (the same walk finds them)`);
    }

    // the library's widgets next to the grid, each mode
    if (library) {
        for (const mode of ['dark', 'light']) {
            const w = library.widgets[mode];
            info(
                `library ${mode}: menu ${w.menuBg} frame ${w.menuBorder} text ${w.menuText}, selected tree row ${w.treeSelected}, date picker ${w.dateBg}`
            );
            check(
                `tredespace ${mode}: the grid's menu is the library's Menu (background)`,
                near(w.menuBg, tokens[mode]['slate-900'], 1),
                `${w.menuBg}`
            );
            check(
                `tredespace ${mode}: the grid's menu text is the library's`,
                near(w.menuText, tokens[mode]['slate-200'], 1),
                `${w.menuText}`
            );
            check(
                `tredespace ${mode}: a selected row is the library's selected TreeView row`,
                near(w.treeSelected, tokens[mode]['blue-950'], 1),
                `${w.treeSelected}`
            );
            check(
                `tredespace ${mode}: the date picker is the library's DatePicker (background)`,
                near(w.dateBg, tokens[mode]['slate-900'], 1),
                `${w.dateBg}`
            );
            const grid = looks[`tredespace-${mode}`].shots;
            const page = await browser.newPage({ viewport: { width: 2000, height: 1000 } });
            const img = (buffer) => `data:image/png;base64,${buffer.toString('base64')}`;
            const file = (p) => img(fs.readFileSync(p));
            await page.setContent(`<body style="margin:0;background:#777;color:#fff;font:16px sans-serif;display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px">
                <div><div>TreDeSpace UI widgets - ${mode}</div><img style="width:100%" src="${img(library.shots[`${mode}-tree`])}"><img style="width:100%" src="${img(library.shots[`${mode}-menu`])}"><img style="width:100%" src="${img(library.shots[`${mode}-date`])}"></div>
                <div><div>@simple-html/grid, TreDeSpace theme - ${mode}</div><img style="width:100%" src="${file(grid.fullShot)}"><img style="width:100%" src="${file(grid.filteringShot)}"><img style="width:45%" src="${file(grid.dateShot)}"></div>
            </body>`);
            await page.waitForTimeout(200);
            await page.screenshot({ path: `${shots}/compare-tredespace-${mode}.png`, fullPage: true });
            await page.close();
        }
    }

    await browser.close();
    console.log(results.join('\n'));
    const failed = results.filter((r) => r.startsWith('FAIL')).length;
    console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
})();
