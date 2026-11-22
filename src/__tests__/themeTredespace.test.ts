// reads package.json and the build script (TS 6 includes no @types by default)
/// <reference types="node" />

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    CONTRAST_PAIRS,
    type ContrastPair,
    declarations,
    lightAndDark,
    pairContrast,
    parseColour,
    readCss,
    takeRule,
    themeColours,
    toHex,
    variables
} from './themeCss';

/**
 * The TreDeSpace theme (theme-tredespace.css), read as text: it sets every colour variable of grid.css
 * and date.css - a variable added to them later without a TreDeSpace colour fails here - each one a
 * light-dark() of the library's tokens, nothing else; and it keeps the contrasts of the default theme,
 * light and dark. How it looks is checked in a browser (theme-tredespace-check.js).
 */

const GRID_SELECTOR = "[data-grid-theme='tredespace'] .simple-html-grid";
const DATE_SELECTOR = "[data-grid-theme='tredespace'] .simple-html-date";

const theme = readCss('theme-tredespace.css');
const tdsGrid = takeRule(theme, GRID_SELECTOR);
const tdsDate = takeRule(tdsGrid.rest, DATE_SELECTOR);
const tdsGridVariables = variables(tdsGrid.body);
const tdsDateVariables = variables(tdsDate.body);

const gridVariables = variables(takeRule(readCss('grid.css'), '.simple-html-grid').body);
const dateVariables = variables(takeRule(readCss('date.css'), '.simple-html-date').body);

// the sizes and weights of the font stay the grid's
const KEPT = /-font-(size|weight)/;

// the variables that are one colour in light and dark: the library's tints (red-500, blue-500,
// amber-500 at an alpha), shadows of black, its Tooltip (dark in both), nothing between the stripes
const SAME_IN_DARK = [
    '--simple-html-grid-error-bg-color',
    '--simple-html-grid-merged-color',
    '--simple-html-grid-readonly-stripe-color',
    '--simple-html-grid-required-stripe-color',
    '--simple-html-grid-stripe-bg-color',
    '--simple-html-grid-range-bg-color',
    '--simple-html-grid-find-match-color',
    '--simple-html-grid-find-current-color',
    '--simple-html-grid-menu-shadow-color',
    '--simple-html-grid-dialog-shadow-color',
    '--simple-html-grid-tooltip-shadow-color',
    '--simple-html-grid-scrollbar-shadow-color',
    '--simple-html-grid-backdrop-color',
    '--simple-html-grid-tooltip-bg-color',
    '--simple-html-grid-tooltip-font-color',
    '--simple-html-grid-tooltip-border-color'
];

describe('TreDeSpace theme - what it sets', () => {
    it('expect the file to be the two rules of variables, nothing else: no border-radius, the grid stays square', () => {
        expect(tdsDate.rest.trim()).toBe('');
        for (const [name] of [...declarations(tdsGrid.body), ...declarations(tdsDate.body)]) {
            expect(name.startsWith('--simple-html-'), name).toBe(true);
        }
    });

    it('expect grid.css and date.css to round no corner, in either theme', () => {
        const radii = declarations(`${readCss('grid.css')}${readCss('date.css')}`).filter(([name]) => name === 'border-radius');

        expect(radii.length).toBeGreaterThan(0);
        expect(radii.filter(([, value]) => value !== '0' && value !== 'initial')).toEqual([]);
    });

    it('expect every colour variable of grid.css to have a TreDeSpace colour', () => {
        const missing = [...gridVariables.keys()].filter((name) => !KEPT.test(name) && !tdsGridVariables.has(name));

        expect(missing).toEqual([]);
    });

    it('expect every colour variable of date.css to have a TreDeSpace colour', () => {
        const missing = [...dateVariables.keys()].filter((name) => !KEPT.test(name) && !tdsDateVariables.has(name));

        expect(missing).toEqual([]);
    });

    it('expect the theme to set no variable grid.css and date.css do not have (a typo), and keep the sizes', () => {
        expect([...tdsGridVariables.keys()].filter((name) => !gridVariables.has(name) || KEPT.test(name))).toEqual([]);
        expect([...tdsDateVariables.keys()].filter((name) => !dateVariables.has(name) || KEPT.test(name))).toEqual([]);
    });

    it("expect the library's font", () => {
        expect(tdsGridVariables.get('--simple-html-grid-font-family')).toBe('ui-sans-serif, system-ui, sans-serif');
        expect(tdsDateVariables.get('--simple-html-date-font-family')).toBe('ui-sans-serif, system-ui, sans-serif');
    });

    it('expect each colour to be light-dark(<light>, <dark>) of two colours, or one colour for both where that is meant', () => {
        const colours = [...tdsGridVariables, ...tdsDateVariables].filter(([name]) => !name.endsWith('-font-family'));

        for (const [name, value] of colours) {
            if (value.startsWith('light-dark(')) {
                const [light, dark] = lightAndDark(value);
                expect(() => parseColour(light), name).not.toThrow();
                expect(() => parseColour(dark), name).not.toThrow();
            } else {
                expect(SAME_IN_DARK, name).toContain(name);
                expect(() => parseColour(value), name).not.toThrow();
            }
        }
    });
});

describe('TreDeSpace theme - the colours', () => {
    const colour = (scheme: 'light' | 'dark') => themeColours([tdsGridVariables, tdsDateVariables], scheme);

    // the tokens of the library, light and dark: its styles.css (the light theme, the dark surfaces)
    // and the Tailwind colours as Chromium draws them (read from the pixels of a canvas)
    it.each([
        ['grid-main-bg-color', 'slate-900', '#f8fafc', '#172033'],
        ['grid-main-bg-even', 'slate-950', '#f1f5f9', '#080f21'],
        ['grid-main-bg-border', 'slate-800', '#e2e8f0', '#283548'],
        ['grid-pinned-border', 'slate-700', '#cbd5e1', '#314158'],
        ['grid-main-font-color', 'slate-200', '#1e293b', '#e2e8f0'],
        ['grid-sec-font-color', 'slate-400', '#475569', '#90a1b9'],
        ['grid-main-bg-selected-even', 'blue-950', '#dbeafe', '#162556'],
        ['grid-focus-color', 'blue-400', '#2563eb', '#51a2ff'],
        ['grid-error-color', 'red-400', '#dc2626', '#ff6467'],
        ['grid-danger-font-color', 'red-300', '#b91c1c', '#ffa2a2'],
        ['grid-danger-border', 'red-600', '#dc2626', '#e7000b'],
        ['grid-edited-color', 'amber-400', '#b45309', '#ffb900'],
        ['grid-new-color', 'green-400', '#15803d', '#05df72'],
        ['grid-conflict-color', 'violet-600 / violet-400', '#7c3aed', '#a684ff'],
        ['grid-totals-font-color', 'slate-100', '#0f172a', '#f1f5f9'],
        ['grid-group-line-color', 'slate-500', '#64748b', '#62748e']
    ])('expect %s to be %s', (name, _token, light, dark) => {
        const near = (hex: string, expected: string) =>
            [1, 3, 5].every(
                (i) => Math.abs(Number.parseInt(hex.slice(i, i + 2), 16) - Number.parseInt(expected.slice(i, i + 2), 16)) <= 1
            );

        expect(near(toHex(colour('light')(name)), light), `${toHex(colour('light')(name))} light`).toBe(true);
        expect(near(toHex(colour('dark')(name)), dark), `${toHex(colour('dark')(name))} dark`).toBe(true);
    });
});

describe('TreDeSpace theme - contrast (WCAG AA)', () => {
    // the TreDeSpace theme on top of grid.css and date.css: the variables it does not set (none, see
    // above) and the ones that are another variable come from there
    const themes = {
        default: [gridVariables, dateVariables],
        tredespace: [gridVariables, dateVariables, tdsGridVariables, tdsDateVariables]
    };

    // more than the default theme keeps: the warning of the value list is text (the default's red is
    // 3.7:1), and so is the text under the flash of a merged cell
    const TREDESPACE_ONLY: ContrastPair[] = [
        { fg: 'grid-warning-font-color', on: ['grid-main-bg-color'], min: 4.5 },
        ...['grid-main-bg-even', 'grid-main-bg-odd', 'grid-main-bg-selected-odd', 'grid-main-bg-selected-even'].map((row) => ({
            fg: 'grid-main-font-color',
            on: ['grid-merged-color', row],
            min: 4.5
        }))
    ];

    for (const scheme of ['light', 'dark'] as const) {
        for (const [name, sets] of Object.entries(themes)) {
            it(`expect the ${name} theme in ${scheme} to keep every contrast of the theming guide`, () => {
                const colour = themeColours(sets, scheme);
                const under = CONTRAST_PAIRS.map((pair) => pairContrast(colour, pair)).filter(
                    ([ratio], i) => ratio < CONTRAST_PAIRS[i].min
                );

                expect(under.map(([, text]) => text)).toEqual([]);
            });
        }

        it(`expect the TreDeSpace theme in ${scheme} to keep the warning and the merged flash readable too`, () => {
            const colour = themeColours(themes.tredespace, scheme);
            const under = TREDESPACE_ONLY.map((pair) => pairContrast(colour, pair)).filter(
                ([ratio], i) => ratio < TREDESPACE_ONLY[i].min
            );

            expect(under.map(([, text]) => text)).toEqual([]);
        });
    }

    it('expect the pairs to cover the text, the selected rows, the tints, the row state and the date picker', () => {
        const names = new Set(CONTRAST_PAIRS.flatMap((pair) => [pair.fg, ...pair.on]));

        for (const name of [
            'grid-main-font-color',
            'grid-sec-font-color',
            'grid-main-bg-selected-odd',
            'grid-range-bg-color',
            'grid-find-current-color',
            'grid-error-bg-color',
            'grid-conflict-color',
            'grid-accent-font-color',
            'grid-tooltip-font-color',
            'date-main-bg-selected'
        ]) {
            expect(names.has(name), name).toBe(true);
        }
    });
});

describe('TreDeSpace theme - the package', () => {
    const root = path.resolve(__dirname, '..', '..');

    it('expect package.json to export the file next to grid.css and date.css', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

        expect(pkg.exports['./theme-tredespace.css']).toBe('./dist/theme-tredespace.css');
        expect(pkg.exports['./grid.css']).toBe('./dist/grid.css');
    });

    it('expect the build to copy every css file of src to dist, this one with them', () => {
        const build = fs.readFileSync(path.join(root, 'scripts', 'build.js'), 'utf8');

        expect(build).toContain("copy('src/**/*.css', 'dist')");
        expect(fs.existsSync(path.join(root, 'src', 'theme-tredespace.css'))).toBe(true);
    });
});
