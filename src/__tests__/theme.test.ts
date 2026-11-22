// reads the css files (TS 6 includes no @types by default)
/// <reference types="node" />

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The theme of grid.css and date.css, read as text: every colour is a variable, each variable is
 * light-dark(<light>, <dark>) so the grid follows the color-scheme of the page, and the light colours
 * are the ones the grid had before.
 * How it looks - the colours, the contrast, the focus outline, the stacking - is checked in a browser,
 * happy-dom does no css.
 */

function readCss(file: string) {
    // without the comments: they name colours and selectors too
    return fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * the first rule with exactly this selector: its body, and the css without it
 */
function takeRule(css: string, selector: string) {
    const start = css.indexOf(`${selector} {`);
    const end = css.indexOf('}', start);
    if (start === -1 || end === -1) {
        throw new Error(`no rule ${selector}`);
    }
    return { body: css.slice(start + selector.length + 2, end), rest: css.slice(0, start) + css.slice(end + 1) };
}

/**
 * the declarations of a block of css: [property, value]. A selector never matches, the value would
 * have a { in it
 */
function declarations(css: string) {
    return [...css.matchAll(/([\w-]+)\s*:\s*([^;{}]+);/g)].map((match) => [match[1], match[2].trim()] as const);
}

/**
 * the custom properties set in a rule body, by name
 */
function variables(body: string) {
    return new Map(declarations(body).filter(([name]) => name.startsWith('--')));
}

/**
 * light-dark(a, b) as [a, b], a plain value as [value, value]. The two are split at the comma
 * that is not inside the brackets of rgba(...) and the like
 */
function lightAndDark(value: string): [string, string] {
    if (!value.startsWith('light-dark(')) {
        return [value, value];
    }
    const inner = value.slice('light-dark('.length, -1);
    let depth = 0;
    for (let i = 0; i < inner.length; i++) {
        if (inner[i] === '(') depth++;
        if (inner[i] === ')') depth--;
        if (inner[i] === ',' && depth === 0) {
            return [inner.slice(0, i).trim(), inner.slice(i + 1).trim()];
        }
    }
    throw new Error(`light-dark() with one colour: ${value}`);
}

// a colour written out: #hex, rgb(), hsl() ... or a named colour. var(...) is taken out first
const LITERAL_COLOUR =
    /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(|\b(?:black|white|red|green|blue|gray|grey|yellow|orange|purple|pink|silver|maroon|navy|teal|olive|lime|aqua|fuchsia)\b/i;

/**
 * the declarations outside the theme rule that write a colour out instead of using a variable
 */
function literalColours(css: string) {
    return declarations(css)
        .filter(([, value]) => LITERAL_COLOUR.test(value.replace(/var\([^)]*\)/g, '')))
        .map(([name, value]) => `${name}: ${value}`);
}

const grid = takeRule(readCss('grid.css'), '.simple-html-grid');
const date = takeRule(readCss('date.css'), '.simple-html-date');
const gridVariables = variables(grid.body);
const dateVariables = variables(date.body);

// the light colour of every variable is what grid.css / date.css had before v6: the variables, and the
// colours that were written out in the rules
const GRID_LIGHT: Record<string, string> = {
    '--simple-html-grid-main-bg-color': '#f5f5f5',
    '--simple-html-grid-sec-bg-color': '#ffffff',
    '--simple-html-grid-alt-bg-color': '#ffffff',
    '--simple-html-grid-main-bg-border': '#e6e5e5',
    '--simple-html-grid-pinned-border': '#d1d0d0',
    '--simple-html-grid-sec-bg-border': '#e6e5e5',
    '--simple-html-grid-main-bg-selected-odd': '#bdd4e7',
    '--simple-html-grid-main-bg-selected-even': '#afc7db',
    '--simple-html-grid-main-bg-even': '#ffffff',
    '--simple-html-grid-main-bg-odd': '#f7f7f7',
    '--simple-html-grid-main-font-color': '#2e2d2d',
    // darker than before v6 on purpose: #979494 was 3.0:1 on white, under WCAG AA's 4.5:1 for text
    '--simple-html-grid-sec-font-color': '#6b6b6b',
    '--simple-html-grid-dropzone-color': 'rgba(129, 127, 127, 0.7)',
    '--simple-html-grid-grouping-border': '#c7c7c7',
    '--simple-html-grid-boxshadow': '#fffdfd',
    '--simple-html-grid-main-hr-border': '#ffffff',
    '--simple-html-grid-error-color': '#dc2626',
    '--simple-html-grid-error-bg-color': 'rgba(220, 38, 38, 0.12)',
    '--simple-html-grid-warning-font-color': 'red',
    '--simple-html-grid-danger-font-color': '#c0392b',
    '--simple-html-grid-danger-border': '#d98282',
    '--simple-html-grid-readonly-stripe-color': 'rgb(255, 0, 0)',
    '--simple-html-grid-required-stripe-color': 'rgb(0, 8, 255)',
    '--simple-html-grid-stripe-bg-color': 'rgb(255, 255, 255)',
    '--simple-html-grid-menu-shadow-color': 'rgba(0, 0, 0, 0.28)',
    '--simple-html-grid-dialog-shadow-color': 'rgba(0, 0, 0, 0.32)',
    '--simple-html-grid-tooltip-shadow-color': 'rgba(0, 0, 0, 0.28)',
    '--simple-html-grid-scrollbar-shadow-color': 'rgb(0 0 0 / 30%)',
    '--simple-html-grid-backdrop-color': 'rgba(129, 127, 127, 0.2)'
};

// the dimmed days and the week numbers were changed in v6 (#dfdfdf, #8b8b8b before): too light for
// text, 1.3:1 and 3.4:1 to white. Now 4.5:1 and more
const DATE_LIGHT: Record<string, string> = {
    '--simple-html-date-main-bg-color': 'white',
    '--simple-html-date-main-color': '#2e2d2d',
    '--simple-html-date-dimmed-color': '#767676',
    '--simple-html-date-week-color': '#6b6b6b',
    '--simple-html-date-header-bg-border': '#181515',
    '--simple-html-date-main-bg-border': '#e6e5e5',
    '--simple-html-date-main-bg-selected': '#bdd4e7'
};

// the variables that are one plain colour, the same in light and dark
const SAME_IN_DARK = ['--simple-html-grid-scrollbar-shadow-color', '--simple-html-grid-readonly-stripe-color'];

describe('theme - every colour a variable', () => {
    it('expect grid.css to write no colour out outside the variables of .simple-html-grid', () => {
        expect(literalColours(grid.rest)).toEqual([]);
    });

    it('expect date.css to write no colour out outside the variables of .simple-html-date', () => {
        expect(literalColours(date.rest)).toEqual([]);
    });

    it('expect every variable grid.css and date.css use to be set in their theme rule', () => {
        const used = [...`${readCss('grid.css')}${readCss('date.css')}`.matchAll(/var\((--simple-html-[\w-]+)/g)].map(
            (match) => match[1]
        );
        const missing = [...new Set(used)].filter((name) => !gridVariables.has(name) && !dateVariables.has(name));

        expect(missing).toEqual([]);
    });
});

describe('theme - light and dark', () => {
    it('expect the light colour of every grid variable to be the colour before v6', () => {
        for (const [name, light] of Object.entries(GRID_LIGHT)) {
            expect(lightAndDark(gridVariables.get(name) ?? '')[0], name).toBe(light);
        }
    });

    it('expect the light colour of every date picker variable to be the colour before v6, the two made darker aside', () => {
        for (const [name, light] of Object.entries(DATE_LIGHT)) {
            expect(lightAndDark(dateVariables.get(name) ?? '')[0], name).toBe(light);
        }
    });

    it('expect a colour variable to be light-dark(<light>, <dark>), or one plain colour for both', () => {
        const colours = [...gridVariables, ...dateVariables].filter(([name]) => !/-font-(size|weight|family)/.test(name));

        for (const [name, value] of colours) {
            const [light, dark] = lightAndDark(value);
            expect(light, name).not.toBe('');
            expect(dark, name).not.toBe('');
            // a plain colour is the same in both: only where that is meant
            if (!value.startsWith('light-dark(')) {
                expect(SAME_IN_DARK, name).toContain(name);
            }
        }
    });

    it('expect a focus colour for the grid and the date picker, used by a :focus-visible outline', () => {
        expect(gridVariables.has('--simple-html-grid-focus-color')).toBe(true);
        expect(dateVariables.has('--simple-html-date-focus-color')).toBe(true);
        expect(takeRule(grid.rest, '.simple-html-grid:focus-visible,\n.simple-html-grid :focus-visible').body).toContain(
            'var(--simple-html-grid-focus-color)'
        );
        expect(takeRule(date.rest, '.simple-html-date:focus-visible,\n.simple-html-date :focus-visible').body).toContain(
            'var(--simple-html-date-focus-color)'
        );
    });
});

describe('theme - the header column stacking', () => {
    // the z-index of the rule with this selector that sets one
    const zIndex = (selector: string) => {
        const rules = [...grid.rest.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter((match) => match[1].trim() === selector);
        const values = rules.map((match) => /z-index:\s*(-?\d+)/.exec(match[2])?.[1]).filter((value) => value !== undefined);
        expect(values, selector).toHaveLength(1);
        return Number(values[0]);
    };

    it('expect the resize handle over the filter input, so all of it can be grabbed', () => {
        expect(zIndex('.simple-html-grid-col-resize')).toBeGreaterThan(zIndex('.simple-html-grid input'));
        expect(zIndex('.simple-html-grid-col-resize-right')).toBeGreaterThan(zIndex('.simple-html-grid input'));
    });

    it('expect the drop zones of a label over the resize handle, a column can be dropped on the right edge', () => {
        for (const zone of ['left', 'right', 'top', 'bottom', 'center']) {
            expect(zIndex(`.simple-html-grid .dragdrop-state .simple-html-grid-drop-zone-${zone}`), zone).toBeGreaterThan(
                zIndex('.simple-html-grid-col-resize')
            );
        }
    });

    it('expect grid.css to style no input outside the grid', () => {
        expect(readCss('grid.css')).not.toMatch(/(^|})\s*input\s*\{/);
    });
});
