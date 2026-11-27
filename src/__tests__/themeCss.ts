// reads the css files (TS 6 includes no @types by default)
/// <reference types="node" />

import fs from 'node:fs';
import path from 'node:path';

/**
 * Helpers of the theme tests (theme.test.ts, themeTredespace.test.ts): the css of a theme read as
 * text, its colours computed - happy-dom does no css. A colour is as Chromium draws it: an sRGB colour,
 * a colour out of sRGB (a Tailwind oklch()) clipped to it, a translucent colour laid over what is
 * under it in sRGB.
 */

/**
 * a css file of src, without the comments: they name colours and selectors too
 */
export function readCss(file: string) {
    return fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * the first rule with exactly this selector: its body, and the css without it
 */
export function takeRule(css: string, selector: string) {
    const start = css.indexOf(`${selector} {`);
    const end = css.indexOf('}', start);
    if (start === -1 || end === -1) {
        throw new Error(`no rule ${selector}`);
    }
    return { body: css.slice(start + selector.length + 2, end), rest: css.slice(0, start) + css.slice(end + 1) };
}

/**
 * the declarations of a block of css: [property, value], a value of several lines in one. A selector
 * never matches, the value would have a { in it
 */
export function declarations(css: string) {
    return [...css.matchAll(/([\w-]+)\s*:\s*([^;{}]+);/g)].map(
        (match) => [match[1], match[2].replace(/\s+/g, ' ').trim()] as const
    );
}

/**
 * the custom properties set in a rule body, by name
 */
export function variables(body: string) {
    return new Map(declarations(body).filter(([name]) => name.startsWith('--')));
}

/**
 * `value` cut at the commas that are not inside brackets: the arguments of a css function
 */
function splitArguments(value: string) {
    const parts: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < value.length; i++) {
        if (value[i] === '(') depth++;
        if (value[i] === ')') depth--;
        if (value[i] === ',' && depth === 0) {
            parts.push(value.slice(start, i).trim());
            start = i + 1;
        }
    }
    parts.push(value.slice(start).trim());
    return parts;
}

/**
 * light-dark(a, b) as [a, b], a plain value as [value, value]. The two are split at the comma that is
 * not inside the brackets of rgba(...) and the like
 */
export function lightAndDark(value: string): [string, string] {
    if (!value.startsWith('light-dark(')) {
        return [value, value];
    }
    const parts = splitArguments(value.slice('light-dark('.length, -1));
    if (parts.length !== 2) {
        throw new Error(`light-dark() without two colours: ${value}`);
    }
    return [parts[0], parts[1]];
}

/**
 * a colour: red, green, blue from 0 to 1 (sRGB, as it is stored), alpha from 0 to 1
 */
export type Rgba = [number, number, number, number];

const NAMED: Record<string, Rgba> = {
    transparent: [0, 0, 0, 0],
    white: [1, 1, 1, 1],
    black: [0, 0, 0, 1],
    red: [1, 0, 0, 1]
};

const clip = (value: number) => Math.min(1, Math.max(0, value));

/**
 * a number of a css colour: `50%` is half of `full`
 */
function cssNumber(text: string, full: number) {
    return text.endsWith('%') ? (Number.parseFloat(text) / 100) * full : Number.parseFloat(text);
}

/**
 * oklch() to sRGB (CSS Color 4: OKLab, LMS, linear sRGB), clipped to sRGB as Chromium draws it
 */
function oklchToRgb(lightness: number, chroma: number, hue: number): [number, number, number] {
    const a = chroma * Math.cos((hue * Math.PI) / 180);
    const b = chroma * Math.sin((hue * Math.PI) / 180);
    const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const linear = [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
    ];
    const [red, green, blue] = linear.map(clip).map((c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
    return [red, green, blue];
}

/**
 * A css colour as Rgba: #hex, rgb() / rgba() (with commas or spaces, `/ alpha`), oklch(), a few
 * names, and color-mix(in srgb, a [p%], b [q%]). A colour out of sRGB is clipped first
 */
export function parseColour(text: string): Rgba {
    const value = text.trim().toLowerCase();
    if (NAMED[value]) {
        return NAMED[value];
    }
    if (value.startsWith('#')) {
        const hex = value.slice(1);
        const full = hex.length <= 4 ? [...hex].map((digit) => digit + digit).join('') : hex;
        const channels = full.match(/../g)?.map((pair) => Number.parseInt(pair, 16) / 255) ?? [];
        return [channels[0], channels[1], channels[2], channels[3] ?? 1];
    }
    const fn = /^([a-z-]+)\((.*)\)$/.exec(value);
    if (!fn) {
        throw new Error(`not a colour: ${text}`);
    }
    const [, name, inner] = fn;
    if (name === 'color-mix') {
        const [space, ...mixed] = splitArguments(inner);
        if (space !== 'in srgb' || mixed.length !== 2) {
            throw new Error(`only color-mix(in srgb, a, b): ${text}`);
        }
        const parts = mixed.map((part) => {
            const percent = /\s(\d+(?:\.\d+)?)%$/.exec(part);
            return {
                colour: parseColour(percent ? part.slice(0, percent.index) : part),
                percent: percent ? Number(percent[1]) : undefined
            };
        });
        const first = (parts[0].percent ?? (parts[1].percent === undefined ? 50 : 100 - parts[1].percent)) / 100;
        return mix(parts[0].colour, parts[1].colour, first);
    }
    const [channels, alphaText] = inner.includes('/') ? inner.split('/') : [inner, undefined];
    const args = channels.includes(',') ? channels.split(',') : channels.trim().split(/\s+/);
    const numbers = args.map((arg) => arg.trim()).filter(Boolean);
    const alpha =
        alphaText !== undefined ? cssNumber(alphaText.trim(), 1) : numbers[3] !== undefined ? cssNumber(numbers[3], 1) : 1;
    if (name === 'rgb' || name === 'rgba') {
        return [cssNumber(numbers[0], 255) / 255, cssNumber(numbers[1], 255) / 255, cssNumber(numbers[2], 255) / 255, alpha];
    }
    if (name === 'oklch') {
        return [...oklchToRgb(cssNumber(numbers[0], 1), cssNumber(numbers[1], 0.4), Number.parseFloat(numbers[2])), alpha];
    }
    throw new Error(`not a colour: ${text}`);
}

/**
 * color-mix(in srgb, a share, b): premultiplied by alpha, as css mixes
 */
function mix(a: Rgba, b: Rgba, share: number): Rgba {
    const alpha = a[3] * share + b[3] * (1 - share);
    if (alpha === 0) {
        return [0, 0, 0, 0];
    }
    const channel = (i: number) => (a[i] * a[3] * share + b[i] * b[3] * (1 - share)) / alpha;
    return [channel(0), channel(1), channel(2), alpha];
}

/**
 * colours laid over each other, the top one first: what shows. The last one is the opaque bottom
 */
export function layered(...colours: Rgba[]): Rgba {
    return colours.reduceRight((under, over) => {
        const channel = (i: number) => over[i] * over[3] + under[i] * (1 - over[3]);
        return [channel(0), channel(1), channel(2), 1];
    });
}

/**
 * the WCAG relative luminance of an opaque colour
 */
function luminance([red, green, blue]: Rgba) {
    const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

/**
 * the WCAG contrast ratio of two opaque colours, 1 to 21
 */
export function contrast(a: Rgba, b: Rgba) {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
}

/**
 * a colour as #rrggbb, for a message
 */
export function toHex([red, green, blue]: Rgba) {
    return `#${[red, green, blue]
        .map((c) =>
            Math.round(clip(c) * 255)
                .toString(16)
                .padStart(2, '0')
        )
        .join('')}`;
}

/**
 * The colours of a theme, light or dark: `colour('grid-main-bg-color')` is
 * --simple-html-grid-main-bg-color. `sets` are the variables of the theme's rules, the later ones over
 * the earlier ones (grid.css's and then a theme's); a variable that is another one (var(...)) is that
 * one's colour
 */
export function themeColours(sets: Map<string, string>[], scheme: 'light' | 'dark') {
    const all = new Map(sets.flatMap((set) => [...set]));
    const colour = (name: string): Rgba => {
        const value = all.get(`--simple-html-${name}`);
        if (value === undefined) {
            throw new Error(`no --simple-html-${name}`);
        }
        const alias = /^var\(--simple-html-([\w-]+)\)$/.exec(value);
        if (alias) {
            return colour(alias[1]);
        }
        return parseColour(lightAndDark(value)[scheme === 'light' ? 0 : 1]);
    };
    return colour;
}

/**
 * a contrast a theme has to keep: the colour `fg` on the colours of `on` - laid over each other, the
 * top one first, the last one opaque - at least `min`: 4.5 for text, 3 for lines and marks (WCAG AA,
 * 1.4.3 and 1.4.11). `alpha` is the opacity of fg (the row numbers are at 80%)
 */
export interface ContrastPair {
    fg: string;
    on: string[];
    min: number;
    alpha?: number;
}

const ROWS = ['grid-main-bg-even', 'grid-main-bg-odd'];
const SELECTED = ['grid-main-bg-selected-odd', 'grid-main-bg-selected-even'];
const ROWS_AND_SELECTED = [...ROWS, ...SELECTED];

const on = (fg: string, min: number, backgrounds: (string | string[])[], alpha?: number): ContrastPair[] =>
    backgrounds.map((background) => ({ fg, min, on: Array.isArray(background) ? background : [background], alpha }));

const under = (tint: string, backgrounds: string[]) => backgrounds.map((background) => [tint, background]);

/** the colours of the palette of the colour rules (ColumnFormat.rules) */
const PALETTE = [
    'red',
    'orange',
    'amber',
    'yellow',
    'lime',
    'green',
    'teal',
    'cyan',
    'blue',
    'indigo',
    'purple',
    'pink',
    'brown',
    'grey'
];
/** the backgrounds of the palette: a cell's, laid over the row - under a range's tint too */
const PALETTE_BACKGROUNDS = PALETTE.map((colour) => `grid-palette-${colour}-bg-color`);

/**
 * The contrasts of the palette of the colour rules. An error and a match of Find show as without a rule
 * (grid.css): not under their tints. A text colour on the rows, the selected rows, a range's tint over
 * them, the inputs (the detail form, the dialog's preview) and every background of the palette; the
 * text, a link, the marks on the backgrounds
 */
const PALETTE_PAIRS: ContrastPair[] = [
    ...PALETTE.flatMap((colour) =>
        on(`grid-palette-${colour}-color`, 4.5, [
            ...ROWS_AND_SELECTED,
            ...under('grid-range-bg-color', ROWS_AND_SELECTED),
            'grid-sec-bg-color',
            'grid-main-bg-color',
            ...PALETTE_BACKGROUNDS,
            ...under('grid-range-bg-color', PALETTE_BACKGROUNDS)
        ])
    ),
    ...['grid-main-font-color', 'grid-link-color'].flatMap((text) =>
        on(text, 4.5, [...PALETTE_BACKGROUNDS, ...under('grid-range-bg-color', PALETTE_BACKGROUNDS)])
    ),
    ...[
        'grid-focus-color',
        'grid-edited-color',
        'grid-new-color',
        'grid-deleted-color',
        'grid-conflict-color',
        'grid-multiline-color',
        'grid-range-border-color'
    ].flatMap((mark) => on(mark, 3, PALETTE_BACKGROUNDS))
];

/**
 * The icons of an icon set (ColumnFormat.icons): marks, 3:1 to the rows, the selected rows - under a
 * range's tint too - and every background of the palette (a rule's, a scale's, a bar's)
 */
const ICON_PAIRS: ContrastPair[] = ['grid-icon-green-color', 'grid-icon-amber-color', 'grid-icon-red-color'].flatMap((icon) =>
    on(icon, 3, [
        ...ROWS_AND_SELECTED,
        ...under('grid-range-bg-color', ROWS_AND_SELECTED),
        ...PALETTE_BACKGROUNDS,
        ...under('grid-range-bg-color', PALETTE_BACKGROUNDS)
    ])
);

/** @internal the colour names of the palette, for the tests of the data bars and colour scales */
export const PALETTE_NAMES: readonly string[] = PALETTE;

/** @internal color-mix(in srgb, a share, b), for the tests of the colour scales */
export const mixColours = (a: Rgba, b: Rgba, share: number): Rgba => mix(a, b, share);

/**
 * The contrasts of the grid and the date picker - what the theming guide promises for the default
 * theme (theme.test.ts, IMPORVEMENT.md "contrast"), every theme keeps them, light and dark
 */
export const CONTRAST_PAIRS: ContrastPair[] = [
    // the text: on the bars and the menus, the inputs, the rows, the selected rows, the active option
    ...on('grid-main-font-color', 4.5, [
        'grid-main-bg-color',
        'grid-sec-bg-color',
        'grid-alt-bg-color',
        ...ROWS_AND_SELECTED,
        'grid-lookup-active-bg-color'
    ]),
    // ... under an error's tint, a range's tint (with an error's too) and the tints of Find
    ...on('grid-main-font-color', 4.5, under('grid-error-bg-color', [...ROWS_AND_SELECTED, 'grid-main-bg-color'])),
    ...on('grid-main-font-color', 4.5, under('grid-range-bg-color', ROWS_AND_SELECTED)),
    ...on(
        'grid-main-font-color',
        4.5,
        ROWS.map((row) => ['grid-range-bg-color', 'grid-error-bg-color', row])
    ),
    ...on('grid-main-font-color', 4.5, under('grid-find-match-color', ROWS_AND_SELECTED)),
    ...on('grid-main-font-color', 4.5, under('grid-find-current-color', ROWS_AND_SELECTED)),
    // the row numbers, at 80%: on the row selector and on a selected row's
    ...on('grid-main-font-color', 4.5, ['grid-main-bg-color', ...SELECTED], 0.8),
    // placeholders and quiet text: in the inputs, the menus, the column chooser's search
    ...on('grid-sec-font-color', 4.5, ['grid-sec-bg-color', 'grid-main-bg-color', 'grid-alt-bg-color']),
    ...on('grid-accent-font-color', 4.5, ['grid-accent-color']),
    ...on('grid-totals-font-color', 4.5, ['grid-totals-bg-color']),
    ...on('grid-aggregate-label-color', 4.5, ['grid-totals-bg-color', 'grid-main-bg-color']),
    // a problem in the column settings dialog: on the dialog and on its preview
    ...on('grid-danger-font-color', 4.5, ['grid-sec-bg-color', 'grid-main-bg-color']),
    // a link: in the cells - the rows, the selected rows, under the tints of an error, a range and Find -
    // and in the column settings' preview
    ...on('grid-link-color', 4.5, [...ROWS_AND_SELECTED, 'grid-sec-bg-color', 'grid-main-bg-color']),
    ...on('grid-link-color', 4.5, under('grid-error-bg-color', ROWS_AND_SELECTED)),
    ...on('grid-link-color', 4.5, under('grid-range-bg-color', ROWS_AND_SELECTED)),
    ...on('grid-link-color', 4.5, under('grid-find-match-color', ROWS_AND_SELECTED)),
    ...on('grid-link-color', 4.5, under('grid-find-current-color', ROWS_AND_SELECTED)),
    ...on('grid-tooltip-font-color', 4.5, ['grid-tooltip-bg-color']),
    // lines and marks: the focus outline, the filled controls and the frames of the controls
    ...on('grid-focus-color', 3, ['grid-main-bg-color', 'grid-sec-bg-color', ...ROWS_AND_SELECTED]),
    ...on('grid-accent-color', 3, ['grid-main-bg-color']),
    ...on('grid-control-border-color', 3, ['grid-main-bg-color']),
    // a range's line: on the rows, the selected rows, an error's tint
    ...on('grid-range-border-color', 3, [...ROWS_AND_SELECTED, ...under('grid-error-bg-color', ROWS)]),
    // the line of the current match: on the rows, the selected rows, its own tint
    ...on('grid-find-current-border-color', 3, [...ROWS_AND_SELECTED, ...under('grid-find-current-color', ROWS_AND_SELECTED)]),
    // the row state: on the rows, the row numbers and the selected rows, under an error's tint too
    ...['grid-edited-color', 'grid-new-color', 'grid-deleted-color', 'grid-conflict-color'].flatMap((state) =>
        on(state, 3, [
            ...ROWS_AND_SELECTED,
            'grid-main-bg-color',
            ...under('grid-error-bg-color', [...ROWS_AND_SELECTED, 'grid-main-bg-color'])
        ])
    ),
    // an error's border, bar and mark: on the rows and the row numbers
    ...on('grid-error-color', 3, [...ROWS, 'grid-main-bg-color']),
    ...on('grid-multiline-color', 3, ROWS_AND_SELECTED),
    ...on('grid-lookup-icon-color', 3, ['grid-lookup-button-bg-color']),
    ...on('grid-group-line-color', 3, ['grid-main-bg-color']),
    // the date picker: its text - on the days between From and To of a range picker too - the frame of
    // the selected day (beside those days too) and today's bar
    ...on('date-main-color', 4.5, [
        'date-main-bg-color',
        'date-hover-bg-color',
        'date-main-bg-selected',
        'date-in-range-bg-color'
    ]),
    ...on('date-dimmed-color', 4.5, ['date-main-bg-color']),
    ...on('date-week-color', 4.5, ['date-main-bg-color']),
    ...on('date-selected-border', 3, ['date-main-bg-color', 'date-main-bg-selected', 'date-in-range-bg-color']),
    ...on('date-today-color', 3, ['date-main-bg-color', 'date-main-bg-selected', 'date-in-range-bg-color']),
    // the palette of the colour rules: the text colours, the backgrounds
    ...PALETTE_PAIRS,
    // the icons of an icon set
    ...ICON_PAIRS
];

/**
 * the contrast of a pair in a theme: [ratio, the colours as #hex for a message]
 */
export function pairContrast(colour: (name: string) => Rgba, pair: ContrastPair): [number, string] {
    const background = layered(...pair.on.map(colour));
    const fg = colour(pair.fg);
    const shown = layered([fg[0], fg[1], fg[2], fg[3] * (pair.alpha ?? 1)], background);
    const ratio = contrast(shown, background);
    return [ratio, `${pair.fg} ${toHex(shown)} on ${pair.on.join(' over ')} ${toHex(background)}: ${ratio.toFixed(2)}`];
}
