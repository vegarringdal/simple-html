import { describe, expect, it } from 'vitest';
import { darkTint, LIGHT_PALETTE, lightTint } from '../grid/ruleColors';
import {
    contrast,
    lightAndDark,
    mixColours,
    PALETTE_NAMES,
    parseColour,
    type Rgba,
    readCss,
    takeRule,
    themeColours,
    toHex,
    variables
} from './themeCss';

/**
 * The colours of the data bars and colour scales (dataBars.ts) in both themes, light and dark, computed as
 * Chromium draws them: a bar is a background of the palette (its pairs are in CONTRAST_PAIRS, with the
 * icons'); a scale mixes two of them in the cell (`color-mix(in srgb, ...)`) - the grid's text and a rule's
 * text colour keep 4.5:1 on every mix; a custom colour is a tint of it (ruleColors.ts) - on which the text,
 * the palette's text colours and the icons keep their contrasts whatever colour is picked: the corners of
 * the colour cube and greys are the extremes. And the palette of the Excel export is the light look of
 * grid.css.
 */

const gridVariables = variables(takeRule(readCss('grid.css'), '.simple-html-grid').body);
const tdsVariables = variables(
    takeRule(readCss('theme-tredespace.css'), "[data-grid-theme='tredespace'] .simple-html-grid").body
);

const THEMES = {
    default: [gridVariables],
    tredespace: [gridVariables, tdsVariables]
};

/** the colours a custom colour can be at its extremes: the corners of the colour cube, greys */
const EXTREMES = [
    '#000000',
    '#ffffff',
    '#ff0000',
    '#00ff00',
    '#0000ff',
    '#ffff00',
    '#00ffff',
    '#ff00ff',
    '#808080',
    '#404040',
    '#c0c0c0'
];

/** the places of a mix of two colours a scale gives a cell: the two ends and between */
const SHARES = [0, 0.25, 0.5, 0.75, 1];

/** the texts on a cell of a bar or a scale: the grid's, and a rule's text colours of the palette */
const TEXTS = ['grid-main-font-color', ...PALETTE_NAMES.map((name) => `grid-palette-${name}-color`)];

describe('data bars and colour scales - contrast in both themes, light and dark', () => {
    for (const scheme of ['light', 'dark'] as const) {
        for (const [name, sets] of Object.entries(THEMES)) {
            const colour = themeColours(sets, scheme);
            const backgrounds = PALETTE_NAMES.map((each) => colour(`grid-palette-${each}-bg-color`));
            const tint = (hex: string) => parseColour(scheme === 'light' ? lightTint(hex) : darkTint(hex));

            /** the pairs under a minimum: the text, its colour and the background as #hex */
            const under = (fills: Rgba[], texts: string[], min: number) =>
                fills.flatMap((fill) =>
                    texts
                        .filter((text) => contrast(colour(text), fill) < min)
                        .map((text) => `${text} on ${toHex(fill)}: ${contrast(colour(text), fill).toFixed(2)}`)
                );

            it(`expect the ${name} theme in ${scheme}: the text 4.5:1 on every mix of two backgrounds of the palette`, () => {
                const mixes = backgrounds.flatMap((a) =>
                    backgrounds.flatMap((b) => SHARES.map((share) => mixColours(a, b, share)))
                );

                expect(under(mixes, ['grid-main-font-color'], 4.5)).toEqual([]);
            });

            it(`expect the ${name} theme in ${scheme}: a rule's text colour 4.5:1 on the scales of the palette - two neighbours, halfway`, () => {
                // the scales of a spreadsheet: red - yellow - green and the like, each colour with the next
                const mixes = backgrounds.slice(1).map((b, i) => mixColours(backgrounds[i], b, 0.5));

                expect(under(mixes, TEXTS, 4.5)).toEqual([]);
            });

            it(`expect the ${name} theme in ${scheme}: the text and the palette's text colours 4.5:1 on the tint of any custom colour, the icons 3:1`, () => {
                const tints = EXTREMES.map(tint);

                expect(under(tints, TEXTS, 4.5)).toEqual([]);
                expect(under(tints, ['grid-icon-green-color', 'grid-icon-amber-color', 'grid-icon-red-color'], 3)).toEqual([]);
            });

            it(`expect the ${name} theme in ${scheme}: the text 4.5:1 on a scale of a palette colour and a custom one`, () => {
                const mixes = backgrounds.flatMap((a) =>
                    EXTREMES.flatMap((hex) => SHARES.map((share) => mixColours(a, tint(hex), share)))
                );

                expect(under(mixes, ['grid-main-font-color'], 4.5)).toEqual([]);
            });
        }
    }
});

describe('the palette of the Excel export', () => {
    it("expect the light colours of grid.css's palette, the text colours and the backgrounds", () => {
        for (const name of PALETTE_NAMES) {
            const palette = LIGHT_PALETTE[name as keyof typeof LIGHT_PALETTE];
            expect(lightAndDark(gridVariables.get(`--simple-html-grid-palette-${name}-color`) ?? '')[0], name).toBe(
                palette.color
            );
            expect(lightAndDark(gridVariables.get(`--simple-html-grid-palette-${name}-bg-color`) ?? '')[0], name).toBe(
                palette.background
            );
        }
        expect(Object.keys(LIGHT_PALETTE)).toEqual(PALETTE_NAMES);
    });
});
