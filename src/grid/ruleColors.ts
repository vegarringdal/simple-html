/**
 * The custom colours of the colour rules (`ColorRule.color` / `background` as `#rrggbb`, colorRules.ts):
 * a colour the user picks, readable in light and dark without a theme of its own.
 *
 * - **Only `#` and six hex digits** (isHexColor): a colour from a saved state is hostile, nothing else
 *   reaches css - and it is set as the value of a custom property with `style.setProperty()`, never as
 *   css text.
 * - **A custom background** is that colour in light and in dark. A rule without a text colour gets black
 *   or white text on it, whichever has the more contrast (readableOn): a custom background always reads.
 * - **A custom text colour** on the rows (or a background of the palette) is the colour picked in light
 *   mode, and in dark mode that colour lighter, as little as it takes to have 4.5:1 to the lightest dark
 *   row of the themes (darkModeText). On a custom background it is the colour picked in both.
 * - **The grid config dialog warns** when a custom text colour has less than 4.5:1 to the light rows, or
 *   to the custom background of the rule (textContrast): it is the user's pick, the grid keeps it.
 * - **A custom colour of a data bar or a colour scale** (dataBars.ts) is a tint of it, light in light
 *   mode and dark in dark mode (lightTint, darkTint): the grid's text reads on it, no warning needed.
 * - **The Excel export** writes the palette as the default theme's light look (LIGHT_PALETTE).
 */

import type { PaletteColor } from './colorRules';

/** a colour of the palette is a name, a custom one `#` and six hex digits - nothing else */
const HEX = /^#[0-9a-fA-F]{6}$/;

/** true for a custom colour: `#` and six hex digits, `#ff8800` */
export function isHexColor(value: unknown): value is `#${string}` {
    return typeof value === 'string' && HEX.test(value);
}

/**
 * the rows of the light look the dialog's warning measures with: the default theme's and TreDeSpace's,
 * the darkest of them (where a dark text has the least contrast)
 */
export const LIGHT_ROWS: readonly string[] = ['#f7f7f7', '#f1f5f9'];

/**
 * the rows of the dark look a custom text colour is made light enough for: the default theme's odd row
 * (#5a6370), the lightest dark row of the themes - on a darker row a light text has more contrast
 */
export const DARK_ROW = '#5a6370';

/** the contrast a text needs, WCAG AA */
export const TEXT_CONTRAST = 4.5;

/** a colour as red, green, blue from 0 to 1 */
function channels(hex: string): [number, number, number] {
    return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255) as [number, number, number];
}

/** the WCAG relative luminance of a colour */
function luminance(hex: string): number {
    const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const [red, green, blue] = channels(hex).map(linear);
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** the WCAG contrast of two colours, 1 to 21 */
export function contrastRatio(a: string, b: string): number {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
}

/** black or white, whichever has the more contrast to the background */
export function readableOn(background: string): '#000000' | '#ffffff' {
    return contrastRatio('#000000', background) >= contrastRatio('#ffffff', background) ? '#000000' : '#ffffff';
}

/** a colour as hue (0 to 360), saturation and lightness (0 to 1) */
function toHsl(hex: string): [number, number, number] {
    const [red, green, blue] = channels(hex);
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const lightness = (max + min) / 2;
    if (max === min) {
        return [0, 0, lightness];
    }
    const delta = max - min;
    const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    const hue =
        max === red
            ? (green - blue) / delta + (green < blue ? 6 : 0)
            : max === green
              ? (blue - red) / delta + 2
              : (red - green) / delta + 4;
    return [hue * 60, saturation, lightness];
}

/** hue, saturation and lightness as `#rrggbb` */
function fromHsl(hue: number, saturation: number, lightness: number): string {
    const k = (n: number) => (n + hue / 30) % 12;
    const a = saturation * Math.min(lightness, 1 - lightness);
    const channel = (n: number) => lightness - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return `#${[0, 8, 4]
        .map((n) =>
            Math.round(channel(n) * 255)
                .toString(16)
                .padStart(2, '0')
        )
        .join('')}`;
}

/**
 * A custom text colour for the dark look: the colour itself when it has 4.5:1 to DARK_ROW, else lighter
 * - its lightness up a step at a time, its hue and saturation kept - until it has. White at the end
 */
export function darkModeText(hex: string): string {
    if (contrastRatio(hex, DARK_ROW) >= TEXT_CONTRAST) {
        return hex.toLowerCase();
    }
    const [hue, saturation, lightness] = toHsl(hex);
    for (let next = lightness + 0.01; next < 1; next += 0.01) {
        const lighter = fromHsl(hue, saturation, next);
        if (contrastRatio(lighter, DARK_ROW) >= TEXT_CONTRAST) {
            return lighter;
        }
    }
    return '#ffffff';
}

/**
 * The contrast of a rule's custom text colour, for the warning of the grid config dialog: to its custom
 * background, else to the light rows (the darkest of LIGHT_ROWS). null for a text colour that is no
 * custom one - the palette's are readable
 */
export function textContrast(color: string | undefined, background: string | undefined): number | null {
    if (!isHexColor(color)) {
        return null;
    }
    if (isHexColor(background)) {
        return contrastRatio(color, background);
    }
    return Math.min(...LIGHT_ROWS.map((row) => contrastRatio(color, row)));
}

/**
 * The custom colours of the data bars and the colour scales (`ColumnFormat.bar`, `scale`, dataBars.ts):
 * a tint of the colour, so the grid's text reads on it whatever colour is picked - and a colour rule's
 * text colour of the palette too. In light mode a fifth of the colour and the rest white, in dark mode
 * a fifth of it and the rest black: every channel is 0.8 or more in light (the darkest, black, gives
 * #cccccc), 0.2 or less in dark (white gives #333333). The palette's backgrounds are tints like these,
 * light in light mode and dark in dark mode. The theme tests check the contrast of the tints of the
 * corners of the colour cube in both themes
 */
export const TINT_SHARE = 0.2;

/** `share` of colour a and the rest of colour b, mixed in sRGB as css's `color-mix(in srgb, ...)` does */
export function mixColors(a: string, b: string, share: number): string {
    const [first, second] = [channels(a), channels(b)];
    return `#${first
        .map((channel, i) =>
            Math.round((channel * share + second[i] * (1 - share)) * 255)
                .toString(16)
                .padStart(2, '0')
        )
        .join('')}`;
}

/** the tint of a custom colour of a data bar or a colour scale in light mode, see TINT_SHARE */
export function lightTint(hex: string): string {
    return mixColors(hex, '#ffffff', TINT_SHARE);
}

/** the tint of a custom colour of a data bar or a colour scale in dark mode, see TINT_SHARE */
export function darkTint(hex: string): string {
    return mixColors(hex, '#000000', TINT_SHARE);
}

/**
 * The palette of the colour rules in the default theme's light look, as #rrggbb: what the Excel export
 * writes (a sheet has no dark mode, nor the page's theme). The same as the light colours of the
 * `--simple-html-grid-palette-<colour>-color` and `-bg-color` variables of grid.css - the theme tests
 * check that - the text colours and the backgrounds
 */
export const LIGHT_PALETTE: Readonly<Record<PaletteColor, { color: string; background: string }>> = {
    red: { color: '#90101a', background: '#fecaca' },
    orange: { color: '#7c2f00', background: '#fed7aa' },
    amber: { color: '#6b3a00', background: '#fcd34d' },
    yellow: { color: '#654100', background: '#fef08a' },
    lime: { color: '#2f4a00', background: '#d9f99d' },
    green: { color: '#00541c', background: '#bbf7d0' },
    teal: { color: '#00504a', background: '#99f6e4' },
    cyan: { color: '#004a60', background: '#67e8f9' },
    blue: { color: '#12429f', background: '#bae6fd' },
    indigo: { color: '#3426a0', background: '#c7d2fe' },
    purple: { color: '#681aa4', background: '#e9d5ff' },
    pink: { color: '#8a1050', background: '#fbcfe8' },
    brown: { color: '#5c3317', background: '#e8d5c4' },
    grey: { color: '#414853', background: '#d1d5db' }
};
