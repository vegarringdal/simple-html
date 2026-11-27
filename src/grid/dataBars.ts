import type { Datasource } from '../datasource/dataSource';
import type { FieldType } from '../datasource/field';
import { type ColorRule, PALETTE_COLORS, type PaletteColor, type RuleColor } from './colorRules';
import { darkTint, isHexColor, lightTint } from './ruleColors';

/**
 * The data bars, colour scales and icon sets of a number column (`ColumnFormat.bar`, `scale`, `icons`):
 * what a spreadsheet's conditional formatting draws from a cell's place among the column's numbers.
 *
 * - **A data bar** is a bar in the cell's background, as long as the value's place between the low and
 *   the high end of the range: left out, from the smallest value to the largest of the rows the filter
 *   lets through - and 0, so a bar starts at 0: an axis where 0 is, negative values to the left of it
 *   (barRange, barOf).
 * - **A colour scale** is the cell's background, a mix of two colours (three with a midpoint) by the
 *   value's place from the smallest value to the largest (scaleRange, scaleOf).
 * - **An icon set** is an icon before or after the value - three of them, by two thresholds in percent of
 *   the range or as numbers (iconLevelOf, iconOf).
 *
 * **The range** is the datasource's: `datasource.aggregate(field, 'min' / 'max')` over the rows the filter
 * lets through - grouped, the rows of collapsed groups too, as the totals row has them. The datasource
 * keeps it until a value of the field changes or other rows are filtered: a render of every cell on
 * screen asks it, 100 000 rows are read once. A fixed `min` / `max` of the format is used as it is.
 *
 * **The colours** are the palette's backgrounds (css variables, light and dark, in both themes: the grid's
 * text reads on them) or a custom colour `#rrggbb` as a tint of it - light in light mode, dark in dark
 * mode (ruleColors.ts) - so the text reads on it too. They reach the cell as the values of custom
 * properties, built from a palette name or a checked `#rrggbb` only (fillValue).
 *
 * **With the colour rules** (`ColumnFormat.rules`): a rule's background wins over a scale - the cell has
 * the rule's; a bar is drawn over a rule's background; the icons show with any rule. An error and a match
 * of Find show as without them, as without a rule's colours (grid.css); the icons stay.
 *
 * showCellColor.ts puts them on the cells, renderRowCell.ts the icons, the grid config dialog edits them
 * (columnSettingsBars.ts), the Excel export writes them as Excel's own conditional formatting
 * (gridExcel.ts).
 */

/**
 * A data bar of a number column, `ColumnFormat.bar`: a bar in the cell's background as long as the value's
 * place in the range - the number stays readable over it, the bar is a light tint (a dark one in dark mode).
 *
 * The range is from `min` to `max`. Left out, they are the smallest and the largest value of the rows the
 * filter lets through, and 0 is in it: the bars start at 0, a negative value's bar goes to the left of
 * the axis where 0 is. A value out of a fixed range is drawn as its end.
 *
 * | bar | 0 to 100 | -50 to 50 |
 * | --- | --- | --- |
 * | `{}` | 50 is half the cell, from the left | 0 is in the middle, -25 a quarter to the left of it |
 * | `{ min: 0, max: 200 }` | 100 is half the cell | -50 no bar, 50 a quarter |
 *
 * @example
 * ```ts
 * import type { DataBarFormat, GridConfig } from '@simple-html/grid';
 *
 * const sales: DataBarFormat = { color: 'green' };
 * const columns: GridConfig['columns'] = {
 *     total: { format: { bar: sales } },
 *     progress: { format: { bar: { color: '#0f766e', min: 0, max: 100 } } }
 * };
 * ```
 */
export interface DataBarFormat {
    /**
     * the bar's colour: a colour of the palette - its background, see {@link PaletteColor} - or a custom
     * colour `#rrggbb`, drawn as a tint of it. Left out: `'blue'`
     */
    color?: RuleColor;
    /** the value of the bar's low end. Left out: the smallest value of the rows, or 0 when that is above 0 */
    min?: number;
    /** the value of a whole bar. Left out: the largest value of the rows, or 0 when that is below 0 */
    max?: number;
}

/**
 * A colour scale of a number column, `ColumnFormat.scale`: the cell's background is a mix of two colours
 * by the value's place from the smallest value to the largest - or of three, with a colour of the
 * midpoint. The colours of the palette are its backgrounds, a custom colour is a tint of it: the grid's
 * text reads on all of them, light and dark.
 *
 * The range is from `min` to `max`, left out the smallest and the largest value of the rows the filter
 * lets through. The midpoint is `mid`, left out halfway between them. A value out of a fixed range has
 * the colour of its end.
 *
 * A colour rule's background wins over the scale: such a cell has the rule's.
 *
 * @example
 * ```ts
 * import type { ColorScaleFormat, GridConfig } from '@simple-html/grid';
 *
 * // red - yellow - green, as a spreadsheet's: green for the high values
 * const heat: ColorScaleFormat = { minColor: 'red', midColor: 'yellow', maxColor: 'green' };
 * const columns: GridConfig['columns'] = {
 *     margin: { format: { scale: heat } },
 *     load: { format: { scale: { minColor: 'grey', maxColor: '#7c3aed', min: 0, max: 100 } } }
 * };
 * ```
 */
export interface ColorScaleFormat {
    /** the colour of the smallest value: a colour of the palette or `#rrggbb`, see {@link RuleColor} */
    minColor: RuleColor;
    /** the colour of the midpoint: a scale of three colours. Left out: two */
    midColor?: RuleColor;
    /** the colour of the largest value */
    maxColor: RuleColor;
    /** the value of `minColor`. Left out: the smallest value of the rows */
    min?: number;
    /** with `midColor`, the value of the midpoint. Left out: halfway between the low and the high end */
    mid?: number;
    /** the value of `maxColor`. Left out: the largest value of the rows */
    max?: number;
}

/**
 * The icons of an icon set, `IconSetFormat.set`: three each - the icon of the high values, of the middle
 * ones and of the low ones. Each is drawn in the icon colours of the theme, green, amber and red
 * (`--simple-html-grid-icon-green-color` ...):
 *
 * | set | high | middle | low |
 * | --- | --- | --- | --- |
 * | `'arrows'` | ▲ green | ► amber | ▼ red |
 * | `'traffic'` | ● green | ● amber | ● red |
 * | `'flags'` | ⚑ green | ⚑ amber | ⚑ red |
 * | `'symbols'` | ✓ green | ! amber | ✕ red |
 *
 * @example
 * ```ts
 * import type { IconSetName } from '@simple-html/grid';
 *
 * const lights: IconSetName = 'traffic';
 * ```
 */
export type IconSetName = 'arrows' | 'traffic' | 'flags' | 'symbols';

/** @internal every icon set, in the order of the grid config dialog */
export const ICON_SETS: readonly IconSetName[] = ['arrows', 'traffic', 'flags', 'symbols'];

/**
 * An icon set of a number column, `ColumnFormat.icons`: an icon before (or after) each value, by two
 * thresholds - a value from the second has the high icon, from the first the middle one, below it the
 * low one (as a spreadsheet's: "from" is `>=`).
 *
 * The thresholds are percent of the range from the smallest value to the largest of the rows the filter
 * lets through (`unit: 'percent'`, the default: `[33, 67]`, the thirds), or numbers (`unit: 'number'`).
 * For a screen reader the cell says *High*, *Middle* or *Low* after its value (the texts
 * `cell.icon.high` ...).
 *
 * | icons | 0 to 100 |
 * | --- | --- |
 * | `{ set: 'arrows' }` | ▲ from 67, ► from 33, ▼ below |
 * | `{ set: 'traffic', thresholds: [50, 90] }` | a green light from 90, amber from 50 |
 * | `{ set: 'symbols', thresholds: [0, 1000], unit: 'number' }` | ✓ from 1000, ! from 0, ✕ for a negative value |
 * | `{ set: 'arrows', reverse: true }` | ▼ red from 67: the high values are the bad ones (costs, days late) |
 *
 * @example
 * ```ts
 * import type { GridConfig, IconSetFormat } from '@simple-html/grid';
 *
 * const trend: IconSetFormat = { set: 'arrows' };
 * const columns: GridConfig['columns'] = {
 *     growth: { format: { icons: trend } },
 *     stock: { format: { icons: { set: 'traffic', thresholds: [10, 50], unit: 'number', position: 'after' } } }
 * };
 * ```
 */
export interface IconSetFormat {
    /** the icons, see {@link IconSetName} */
    set: IconSetName;
    /**
     * the two thresholds, the first not above the second: from the first the middle icon, from the second
     * the high one. Left out: `[33, 67]`
     */
    thresholds?: [number, number];
    /**
     * `'percent'` (the default): the thresholds are percent of the range, 0 to 100. `'number'`: they are
     * values of the column
     */
    unit?: 'percent' | 'number';
    /** `true`: the icons the other way round - the low values have the high icon (▲ green) */
    reverse?: boolean;
    /** `'before'` (the default): the icon at the left of the cell, `'after'` at its right */
    position?: 'before' | 'after';
}

/** the thresholds of an icon set when it has none: the thirds of the range */
export const DEFAULT_THRESHOLDS: readonly [number, number] = [33, 67];

/** the colour of a data bar when it has none */
export const DEFAULT_BAR_COLOR: PaletteColor = 'blue';

/** the smallest and the largest value of a range */
export interface ValueRange {
    min: number;
    max: number;
}

/**
 * The smallest and the largest number of a field over the rows the filter lets through - grouped, the
 * rows of collapsed groups too: `datasource.aggregate()`, which keeps them until a value of the field
 * changes or other rows are filtered. null when no row has a number
 */
export function shownRange(datasource: Datasource<any>, field: string): ValueRange | null {
    const min = datasource.aggregate(field, 'min');
    const max = datasource.aggregate(field, 'max');
    return min === null || max === null ? null : { min, max };
}

/** a finite number, else null */
const numberOf = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/** a value in a range, at its ends */
const clamp = (value: number, range: ValueRange) => Math.min(Math.max(value, range.min), range.max);

/**
 * The range of a data bar: its `min` and `max`, left out the smallest and the largest value of the rows
 * with 0 - a bar starts at 0. null when it has no length: no rows, every value 0, a fixed min not below
 * the max
 * @param shown the range of the rows, shownRange()
 */
export function barRange(bar: DataBarFormat, shown: ValueRange | null): ValueRange | null {
    const min = bar.min ?? Math.min(0, shown?.min ?? 0);
    const max = bar.max ?? Math.max(0, shown?.max ?? 0);
    return max > min ? { min, max } : null;
}

/**
 * The bar of a value: where it starts and ends, from 0 (the cell's left) to 1 (its right). It goes from
 * the axis - where 0 is, the range's end nearest to 0 when 0 is out of it - to the value: to the right
 * for a value above 0, to the left below. null for a value that is no finite number
 * @param range the bar's range, barRange()
 */
export function barOf(value: unknown, range: ValueRange): { start: number; end: number } | null {
    const number = numberOf(value);
    if (number === null) {
        return null;
    }
    const place = (each: number) => (clamp(each, range) - range.min) / (range.max - range.min);
    const axis = place(0);
    const at = place(number);
    return { start: Math.min(axis, at), end: Math.max(axis, at) };
}

/**
 * The range of a colour scale: its `min` and `max`, left out the smallest and the largest value of the
 * rows. null without one (no rows) or when the low end is above the high one (a fixed min above the
 * values)
 * @param shown the range of the rows, shownRange()
 */
export function scaleRange(scale: ColorScaleFormat, shown: ValueRange | null): ValueRange | null {
    const min = scale.min ?? shown?.min;
    const max = scale.max ?? shown?.max;
    return min === undefined || max === undefined || min > max ? null : { min, max };
}

/** the colour of a value on a colour scale: `at` of the way from `from` to `to`, 0 to 1 */
export interface ScaleColor {
    from: RuleColor;
    to: RuleColor;
    at: number;
}

/**
 * The colour of a value on a colour scale: between the colours of the two ends it is between - the
 * low end and the high one, or the midpoint and one of them - and how far. A range of one value has the
 * middle: the midpoint's colour, or halfway. null for a value that is no finite number
 * @param range the scale's range, scaleRange()
 */
export function scaleOf(value: unknown, scale: ColorScaleFormat, range: ValueRange): ScaleColor | null {
    const number = numberOf(value);
    if (number === null) {
        return null;
    }
    const { minColor, midColor, maxColor } = scale;
    const span = range.max - range.min;
    if (!midColor) {
        return { from: minColor, to: maxColor, at: span ? (clamp(number, range) - range.min) / span : 0.5 };
    }
    if (!span) {
        return { from: midColor, to: midColor, at: 0 };
    }
    const mid = clamp(scale.mid ?? range.min + span / 2, range);
    const at = clamp(number, range);
    if (at <= mid) {
        return { from: minColor, to: midColor, at: mid === range.min ? 1 : (at - range.min) / (mid - range.min) };
    }
    return { from: midColor, to: maxColor, at: (at - mid) / (range.max - mid) };
}

/** the level of a value in an icon set: from the second threshold, from the first, below it */
export type IconLevel = 'high' | 'middle' | 'low';

/**
 * The level of a value in an icon set, by its thresholds: `'high'` from the second, `'middle'` from the
 * first, `'low'` below. A threshold in percent is that much of the range from its low end - compared as
 * `(value - min) * 100 >= percent * (max - min)`, so 67 of 0 to 100 is high, not lost to 0.67 * 100. null
 * for a value that is no finite number, and for percent without a range (no rows)
 * @param shown the range of the rows, shownRange()
 */
export function iconLevelOf(value: unknown, icons: IconSetFormat, shown: ValueRange | null): IconLevel | null {
    const number = numberOf(value);
    if (number === null) {
        return null;
    }
    const [low, high] = icons.thresholds ?? DEFAULT_THRESHOLDS;
    let from: (threshold: number) => boolean;
    if (icons.unit === 'number') {
        from = (threshold) => number >= threshold;
    } else if (shown) {
        from = (threshold) => (number - shown.min) * 100 >= threshold * (shown.max - shown.min);
    } else {
        return null;
    }
    return from(high) ? 'high' : from(low) ? 'middle' : 'low';
}

/** the shape of an icon */
export type IconShape = 'up' | 'side' | 'down' | 'circle' | 'flag' | 'check' | 'exclamation' | 'cross';

/** the colour of an icon: a variable of the theme each, `--simple-html-grid-icon-<colour>-color` */
export type IconColor = 'green' | 'amber' | 'red';

/** the icons of each set: the high one, the middle one, the low one */
const SET_ICONS: Readonly<Record<IconSetName, readonly [IconShape, IconShape, IconShape]>> = {
    arrows: ['up', 'side', 'down'],
    traffic: ['circle', 'circle', 'circle'],
    flags: ['flag', 'flag', 'flag'],
    symbols: ['check', 'exclamation', 'cross']
};

/** the colours of the high, the middle and the low icon */
const ICON_COLORS: readonly [IconColor, IconColor, IconColor] = ['green', 'amber', 'red'];

/** the levels, the high one first: the place of a set's icon */
const LEVELS: readonly IconLevel[] = ['high', 'middle', 'low'];

/**
 * The icon of a level in an icon set: its shape and its colour - the other way round with `reverse`, the
 * low values have the high icon
 */
export function iconOf(level: IconLevel, icons: IconSetFormat): { shape: IconShape; color: IconColor } {
    const index = LEVELS.indexOf(level);
    const place = icons.reverse ? 2 - index : index;
    return { shape: SET_ICONS[icons.set][place], color: ICON_COLORS[place] };
}

/** the class of a cell with a data bar */
export const BAR_CLASS = 'simple-html-grid-cell-bar';

/** the class of a cell with the colour of a colour scale */
export const SCALE_CLASS = 'simple-html-grid-cell-scale';

/**
 * the custom properties of a cell with a bar: where it starts and ends (`12.5%`), its colour (fillValue).
 * grid.css draws it from them
 */
export const BAR_START = '--simple-html-grid-bar-start';
export const BAR_END = '--simple-html-grid-bar-end';
export const BAR_COLOR = '--simple-html-grid-bar-color';

/**
 * the custom properties of a cell with a colour of a scale: the two colours (fillValue) and how much of
 * the second (`37.5%`) - grid.css mixes them, `color-mix(in srgb, ...)`
 */
export const SCALE_FROM = '--simple-html-grid-scale-from';
export const SCALE_TO = '--simple-html-grid-scale-to';
export const SCALE_AT = '--simple-html-grid-scale-at';

/** @internal every class the bars and scales give a cell: a cell drops the ones it does not get */
export const FILL_CLASSES: readonly string[] = [BAR_CLASS, SCALE_CLASS];

/** @internal every custom property the bars and scales give a cell */
export const FILL_PROPERTIES: readonly string[] = [BAR_START, BAR_END, BAR_COLOR, SCALE_FROM, SCALE_TO, SCALE_AT];

/**
 * The css value of a colour of a bar or a scale, for a custom property of the cell: a colour of the
 * palette is its background's variable, a custom colour its tints in light and dark mode. Only a palette
 * name or a checked `#rrggbb` gets into it - anything else is the default bar colour's
 */
export function fillValue(color: RuleColor | undefined): string {
    if (isHexColor(color)) {
        return `light-dark(${lightTint(color)}, ${darkTint(color)})`;
    }
    const palette = PALETTE_COLORS.find((known) => known === color) ?? DEFAULT_BAR_COLOR;
    return `var(--simple-html-grid-palette-${palette}-bg-color)`;
}

/** a part of 1 as a percent for css, `0.125` is `12.5%` - two decimals at most */
const percent = (part: number) => `${Math.round(part * 10_000) / 100}%`;

/** what the bars and scales put on a cell: classes and custom properties */
export interface CellFill {
    classes: string[];
    style: Record<string, string>;
}

/** no bar, no scale */
export const NO_FILL: CellFill = { classes: [], style: {} };

/**
 * The bar and the scale colour of a value of a number column, as classes and custom properties of its
 * cell (showCellColor.ts) or the preview of the grid config dialog. A rule's background wins over the
 * scale: with one, the cell has no scale colour. NO_FILL for a format without them and for a value that is
 * no number
 * @param format the column's format: its `bar` and `scale`
 * @param rule the colour rule that colours the cell, null for none
 * @param shown the range of the column's rows, shownRange() - asked only when a bar or a scale needs it
 */
export function cellFillOf(
    value: unknown,
    format: { bar?: DataBarFormat; scale?: ColorScaleFormat } | undefined,
    rule: ColorRule | null,
    shown: () => ValueRange | null
): CellFill {
    const { bar, scale } = format ?? {};
    if ((!bar && !scale) || numberOf(value) === null) {
        return NO_FILL;
    }
    const fill: CellFill = { classes: [], style: {} };
    const range = shown();
    const barAt = bar ? barRange(bar, range) : null;
    const drawn = barAt ? barOf(value, barAt) : null;
    if (bar && drawn) {
        fill.classes.push(BAR_CLASS);
        fill.style[BAR_START] = percent(drawn.start);
        fill.style[BAR_END] = percent(drawn.end);
        fill.style[BAR_COLOR] = fillValue(bar.color ?? DEFAULT_BAR_COLOR);
    }
    const scaleAt = scale && !rule?.background ? scaleRange(scale, range) : null;
    const color = scale && scaleAt ? scaleOf(value, scale, scaleAt) : null;
    if (color) {
        fill.classes.push(SCALE_CLASS);
        fill.style[SCALE_FROM] = fillValue(color.from);
        fill.style[SCALE_TO] = fillValue(color.to);
        fill.style[SCALE_AT] = percent(color.at);
    }
    return fill;
}

/** true when a column's format has a bar, a scale or icons: they need the range of the rows */
export function hasValueFill(format: { bar?: unknown; scale?: unknown; icons?: unknown } | undefined): boolean {
    return format?.bar !== undefined || format?.scale !== undefined || format?.icons !== undefined;
}

/** a plain object, not null or an array */
const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/** a list of names as the messages write them: `'a', 'b'` */
const quoted = (list: readonly string[]) => list.map((each) => `'${each}'`).join(', ');

/** the keys of each part, for the check of one from plain JavaScript or JSON */
const BAR_KEYS: readonly (keyof DataBarFormat)[] = ['color', 'min', 'max'];
const SCALE_KEYS: readonly (keyof ColorScaleFormat)[] = ['minColor', 'midColor', 'maxColor', 'min', 'mid', 'max'];
const ICON_KEYS: readonly (keyof IconSetFormat)[] = ['set', 'thresholds', 'unit', 'reverse', 'position'];

/** throws when an object has a key the part does not have */
function assertKeys(part: Record<string, unknown>, keys: readonly string[], name: string, what: string): void {
    for (const key of Object.keys(part)) {
        if (!keys.includes(key)) {
            throw new TypeError(`${name} has '${key.slice(0, 70)}', ${what} has ${keys.join(', ')}`);
        }
    }
}

/** throws for a colour that is no colour of the palette and no `#rrggbb` */
function assertColor(color: unknown, name: string): void {
    if (!PALETTE_COLORS.some((known) => known === color) && !isHexColor(color)) {
        throw new TypeError(
            `${name} is ${JSON.stringify(color)?.slice(0, 70)}, it is a colour of the palette (${quoted(PALETTE_COLORS)}) or a custom colour '#rrggbb'`
        );
    }
}

/** throws for a value that is no finite number, undefined is none */
function assertNumber(value: unknown, name: string): void {
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) {
        // NaN and Infinity as they are: JSON writes them as null
        const shown = typeof value === 'number' ? String(value) : JSON.stringify(value)?.slice(0, 70);
        throw new TypeError(`${name} is ${shown}, it is a finite number - left out, from the rows`);
    }
}

/**
 * @internal
 * Throws when the bar, the scale or the icons of a column's format do not fit it - TypeScript catches
 * neither a typo nor a part of the wrong kind in a config from plain JavaScript or JSON (a saved state,
 * hostile), and a part that is wrong would draw nothing without a word:
 * - each for a `number` field only - a calculated column of numbers too - not a lookup column, not with
 *   `checkbox` (a checkbox shows no number)
 * - `bar`: `{ color?, min?, max? }` - a colour of the palette or `#rrggbb`, finite numbers, min below max
 * - `scale`: `{ minColor, midColor?, maxColor, min?, mid?, max? }` - the two colours at least, `mid` with
 *   `midColor` only, finite numbers, min below max and the midpoint between them
 * - `icons`: `{ set, thresholds?, unit?, reverse?, position? }` - a set of ICON_SETS, two finite
 *   thresholds the first not above the second (0 to 100 in percent), `'percent'` or `'number'`, true or
 *   false, `'before'` or `'after'`
 * @param format the format: its `bar`, `scale`, `icons` and `checkbox` are read
 * @param name how the message names it: `GridConfig: columns.total.format`
 * @throws a `TypeError` naming the part, what it has and what it takes
 */
export function assertValueFills(
    format: Record<string, unknown>,
    field: string,
    type: FieldType,
    lookup: boolean,
    name: string
): void {
    const { bar, scale, icons, checkbox } = format;
    for (const [key, part] of [
        ['bar', bar],
        ['scale', scale],
        ['icons', icons]
    ] as const) {
        if (part === undefined) {
            continue;
        }
        if (lookup || type !== 'number') {
            throw new TypeError(
                `${name}.${key} is for a number field, '${field}' is ${lookup ? 'a lookup column (its cells show labels)' : type}`
            );
        }
        if (checkbox !== undefined) {
            throw new TypeError(`${name} has checkbox and ${key}: a checkbox shows no number, it is the one or the other`);
        }
    }
    if (bar !== undefined) {
        assertBar(bar, `${name}.bar`);
    }
    if (scale !== undefined) {
        assertScale(scale, `${name}.scale`);
    }
    if (icons !== undefined) {
        assertIcons(icons, `${name}.icons`);
    }
}

/** see assertValueFills: a data bar */
function assertBar(bar: unknown, name: string): void {
    if (!isObject(bar)) {
        throw new TypeError(`${name} is ${JSON.stringify(bar)}, it is an object: { color?: 'blue', min?: 0, max?: 100 }`);
    }
    assertKeys(bar, BAR_KEYS, name, 'a data bar');
    if (bar.color !== undefined) {
        assertColor(bar.color, `${name}.color`);
    }
    assertNumber(bar.min, `${name}.min`);
    assertNumber(bar.max, `${name}.max`);
    if (typeof bar.min === 'number' && typeof bar.max === 'number' && bar.min >= bar.max) {
        throw new TypeError(`${name} has min ${bar.min} and max ${bar.max}: the min is below the max`);
    }
}

/** see assertValueFills: a colour scale */
function assertScale(scale: unknown, name: string): void {
    if (!isObject(scale)) {
        throw new TypeError(
            `${name} is ${JSON.stringify(scale)}, it is an object: { minColor: 'red', midColor?: 'yellow', maxColor: 'green' }`
        );
    }
    assertKeys(scale, SCALE_KEYS, name, 'a colour scale');
    assertColor(scale.minColor, `${name}.minColor`);
    if (scale.midColor !== undefined) {
        assertColor(scale.midColor, `${name}.midColor`);
    }
    assertColor(scale.maxColor, `${name}.maxColor`);
    for (const key of ['min', 'mid', 'max'] as const) {
        assertNumber(scale[key], `${name}.${key}`);
    }
    if (scale.mid !== undefined && scale.midColor === undefined) {
        throw new TypeError(`${name} has mid without midColor: the midpoint is the value of the midColor`);
    }
    const { min, mid, max } = scale as Partial<Record<'min' | 'mid' | 'max', number>>;
    if (min !== undefined && max !== undefined && min >= max) {
        throw new TypeError(`${name} has min ${min} and max ${max}: the min is below the max`);
    }
    if (mid !== undefined && ((min !== undefined && mid < min) || (max !== undefined && mid > max))) {
        throw new TypeError(`${name}.mid is ${mid}: the midpoint is between the min and the max`);
    }
}

/** see assertValueFills: an icon set */
function assertIcons(icons: unknown, name: string): void {
    if (!isObject(icons)) {
        throw new TypeError(`${name} is ${JSON.stringify(icons)}, it is an object: { set: 'arrows', thresholds?: [33, 67] }`);
    }
    assertKeys(icons, ICON_KEYS, name, 'an icon set');
    const { set, thresholds, unit, reverse, position } = icons;
    if (!ICON_SETS.some((known) => known === set)) {
        throw new TypeError(`${name}.set is ${JSON.stringify(set)?.slice(0, 70)}, it is ${quoted(ICON_SETS)}`);
    }
    if (unit !== undefined && unit !== 'percent' && unit !== 'number') {
        throw new TypeError(`${name}.unit is ${JSON.stringify(unit)?.slice(0, 70)}, it is 'percent' or 'number'`);
    }
    if (thresholds !== undefined) {
        if (
            !Array.isArray(thresholds) ||
            thresholds.length !== 2 ||
            thresholds.some((each) => typeof each !== 'number' || !Number.isFinite(each))
        ) {
            throw new TypeError(
                `${name}.thresholds is ${JSON.stringify(thresholds)?.slice(0, 70)}, it is two numbers: [33, 67] - from the first the middle icon, from the second the high one`
            );
        }
        const [low, high] = thresholds as [number, number];
        if (low > high) {
            throw new TypeError(`${name}.thresholds is [${low}, ${high}]: the first is not above the second`);
        }
        if (unit !== 'number' && (low < 0 || high > 100)) {
            throw new TypeError(
                `${name}.thresholds is [${low}, ${high}]: in percent they are 0 to 100 - unit: 'number' takes values of the column`
            );
        }
    }
    if (reverse !== undefined && typeof reverse !== 'boolean') {
        throw new TypeError(`${name}.reverse is ${JSON.stringify(reverse)}, it is true or false`);
    }
    if (position !== undefined && position !== 'before' && position !== 'after') {
        throw new TypeError(`${name}.position is ${JSON.stringify(position)?.slice(0, 70)}, it is 'before' or 'after'`);
    }
}
