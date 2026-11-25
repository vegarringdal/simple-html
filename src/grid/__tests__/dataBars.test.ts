import { describe, expect, it } from 'vitest';
import { assertColumnFormat, type ColumnFormat } from '../columnFormat';
import {
    BAR_COLOR,
    BAR_END,
    BAR_START,
    barOf,
    barRange,
    type ColorScaleFormat,
    cellFillOf,
    fillValue,
    type IconSetFormat,
    iconLevelOf,
    iconOf,
    NO_FILL,
    SCALE_AT,
    SCALE_FROM,
    SCALE_TO,
    scaleOf,
    scaleRange
} from '../dataBars';
import { parseNumberText, valueFillProblems } from '../gridFunctions/columnSettingsBars';
import { darkTint, lightTint, mixColors } from '../ruleColors';

/**
 * The data bars, colour scales and icon sets of a number column (dataBars.ts), without a grid: the
 * ranges and where a value is in them, the colours and the icons of a value, what a cell gets (classes and
 * custom properties), the tints of a custom colour, the check of a format from plain JavaScript or JSON,
 * and the numbers and problems of the grid config dialog's section. The cells are in dataBarsGrid.test.ts,
 * the dialog in columnSettingsBars.test.ts, the Excel export in dataBarsExcel.test.ts.
 */

describe('data bars - the range and the bar of a value', () => {
    it('expect the range of the rows with 0 in it: a bar starts at 0', () => {
        expect(barRange({}, { min: 10, max: 50 })).toEqual({ min: 0, max: 50 });
        expect(barRange({}, { min: -20, max: 50 })).toEqual({ min: -20, max: 50 });
        expect(barRange({}, { min: -50, max: -10 })).toEqual({ min: -50, max: 0 });
    });

    it('expect a fixed min and max as they are, one of them with the rows', () => {
        expect(barRange({ min: 900, max: 1000 }, { min: 0, max: 50 })).toEqual({ min: 900, max: 1000 });
        expect(barRange({ max: 200 }, { min: 10, max: 50 })).toEqual({ min: 0, max: 200 });
        expect(barRange({ min: -100 }, { min: 10, max: 50 })).toEqual({ min: -100, max: 50 });
    });

    it('expect no range without a length: no rows, every value 0, a min above the max of the rows', () => {
        expect(barRange({}, null)).toBeNull();
        expect(barRange({}, { min: 0, max: 0 })).toBeNull();
        expect(barRange({ min: 900 }, { min: 10, max: 50 })).toBeNull();
    });

    it('expect a bar from 0 to the value, its place in the range', () => {
        const range = { min: 0, max: 200 };

        expect(barOf(50, range)).toEqual({ start: 0, end: 0.25 });
        expect(barOf(200, range)).toEqual({ start: 0, end: 1 });
        expect(barOf(0, range)).toEqual({ start: 0, end: 0 });
    });

    it('expect a negative value left of the axis where 0 is, a positive one right of it', () => {
        const range = { min: -50, max: 150 };

        expect(barOf(100, range)).toEqual({ start: 0.25, end: 0.75 });
        expect(barOf(-25, range)).toEqual({ start: 0.125, end: 0.25 });
        expect(barOf(-50, range)).toEqual({ start: 0, end: 0.25 });
    });

    it('expect a range above 0 to start at its low end, one below 0 at its high end, a value out of it at the end', () => {
        expect(barOf(950, { min: 900, max: 1000 })).toEqual({ start: 0, end: 0.5 });
        expect(barOf(-75, { min: -100, max: -50 })).toEqual({ start: 0.5, end: 1 });
        expect(barOf(5000, { min: 900, max: 1000 })).toEqual({ start: 0, end: 1 });
        expect(barOf(-5000, { min: 0, max: 100 })).toEqual({ start: 0, end: 0 });
    });

    it('expect no bar for what is no finite number', () => {
        for (const value of [null, undefined, '', '12', Number.NaN, Number.POSITIVE_INFINITY, new Date(), true]) {
            expect(barOf(value, { min: 0, max: 10 }), String(value)).toBeNull();
        }
    });
});

describe('colour scales - the colour of a value', () => {
    const twoColours: ColorScaleFormat = { minColor: 'red', maxColor: 'green' };
    const threeColours: ColorScaleFormat = { minColor: 'red', midColor: 'yellow', maxColor: 'green' };

    it('expect the range of the rows without 0 in it, a fixed end as it is', () => {
        expect(scaleRange(twoColours, { min: 10, max: 50 })).toEqual({ min: 10, max: 50 });
        expect(scaleRange({ ...twoColours, min: 0 }, { min: 10, max: 50 })).toEqual({ min: 0, max: 50 });
        expect(scaleRange({ ...twoColours, min: 0, max: 100 }, null)).toEqual({ min: 0, max: 100 });
        expect(scaleRange(twoColours, null)).toBeNull();
        expect(scaleRange({ ...twoColours, min: 100 }, { min: 10, max: 50 })).toBeNull();
    });

    it('expect two colours mixed by the place of the value', () => {
        const range = { min: 0, max: 200 };

        expect(scaleOf(0, twoColours, range)).toEqual({ from: 'red', to: 'green', at: 0 });
        expect(scaleOf(50, twoColours, range)).toEqual({ from: 'red', to: 'green', at: 0.25 });
        expect(scaleOf(200, twoColours, range)).toEqual({ from: 'red', to: 'green', at: 1 });
        expect(scaleOf(500, twoColours, range)).toEqual({ from: 'red', to: 'green', at: 1 });
    });

    it('expect three colours: the low half to the midpoint, the high half from it - halfway when it is left out', () => {
        const range = { min: 0, max: 200 };

        expect(scaleOf(50, threeColours, range)).toEqual({ from: 'red', to: 'yellow', at: 0.5 });
        expect(scaleOf(100, threeColours, range)).toEqual({ from: 'red', to: 'yellow', at: 1 });
        expect(scaleOf(150, threeColours, range)).toEqual({ from: 'yellow', to: 'green', at: 0.5 });
        // a midpoint of its own: 80
        expect(scaleOf(40, { ...threeColours, mid: 80 }, range)).toEqual({ from: 'red', to: 'yellow', at: 0.5 });
        expect(scaleOf(140, { ...threeColours, mid: 80 }, range)).toEqual({ from: 'yellow', to: 'green', at: 0.5 });
        // the midpoint at the low end: every value above it is in the high half
        expect(scaleOf(0, { ...threeColours, mid: 0 }, range)).toEqual({ from: 'red', to: 'yellow', at: 1 });
    });

    it('expect a range of one value to have the middle, no colour for what is no number', () => {
        expect(scaleOf(5, twoColours, { min: 5, max: 5 })).toEqual({ from: 'red', to: 'green', at: 0.5 });
        expect(scaleOf(5, threeColours, { min: 5, max: 5 })).toEqual({ from: 'yellow', to: 'yellow', at: 0 });
        expect(scaleOf(null, twoColours, { min: 0, max: 5 })).toBeNull();
        expect(scaleOf('3', twoColours, { min: 0, max: 5 })).toBeNull();
    });
});

describe('icon sets - the level and the icon of a value', () => {
    const arrows: IconSetFormat = { set: 'arrows' };

    it('expect the thirds of the range: high from 67 %, middle from 33 %, exactly at a threshold too', () => {
        const shown = { min: 0, max: 100 };

        expect(iconLevelOf(67, arrows, shown)).toBe('high');
        expect(iconLevelOf(66.9, arrows, shown)).toBe('middle');
        expect(iconLevelOf(33, arrows, shown)).toBe('middle');
        expect(iconLevelOf(32.99, arrows, shown)).toBe('low');
        expect(iconLevelOf(-10, arrows, shown)).toBe('low');
        // 0.67 * 100 is 67.00000000000001: compared without the division
        expect(iconLevelOf(0.67, arrows, { min: 0, max: 1 })).toBe('high');
    });

    it('expect percent of a range that does not start at 0', () => {
        const shown = { min: 1000, max: 2000 };

        expect(iconLevelOf(1670, arrows, shown)).toBe('high');
        expect(iconLevelOf(1330, arrows, shown)).toBe('middle');
        expect(iconLevelOf(1329, arrows, shown)).toBe('low');
    });

    it('expect thresholds as numbers: the range does not count', () => {
        const stock: IconSetFormat = { set: 'traffic', thresholds: [10, 50], unit: 'number' };

        expect(iconLevelOf(50, stock, null)).toBe('high');
        expect(iconLevelOf(10, stock, { min: 0, max: 1 })).toBe('middle');
        expect(iconLevelOf(9.99, stock, null)).toBe('low');
    });

    it('expect no level for what is no number, nor in percent without a range; every value of one value is high', () => {
        expect(iconLevelOf(null, arrows, { min: 0, max: 1 })).toBeNull();
        expect(iconLevelOf(5, arrows, null)).toBeNull();
        expect(iconLevelOf(5, arrows, { min: 5, max: 5 })).toBe('high');
    });

    it('expect the icons of each set in green, amber and red - the other way round with reverse', () => {
        expect(['high', 'middle', 'low'].map((level) => iconOf(level as 'high', arrows))).toEqual([
            { shape: 'up', color: 'green' },
            { shape: 'side', color: 'amber' },
            { shape: 'down', color: 'red' }
        ]);
        expect(iconOf('high', { set: 'symbols' })).toEqual({ shape: 'check', color: 'green' });
        expect(iconOf('middle', { set: 'symbols' })).toEqual({ shape: 'exclamation', color: 'amber' });
        expect(iconOf('low', { set: 'traffic' })).toEqual({ shape: 'circle', color: 'red' });
        expect(iconOf('low', { set: 'flags' })).toEqual({ shape: 'flag', color: 'red' });
        // reversed: the low values have the high icon
        expect(iconOf('high', { set: 'arrows', reverse: true })).toEqual({ shape: 'down', color: 'red' });
        expect(iconOf('low', { set: 'arrows', reverse: true })).toEqual({ shape: 'up', color: 'green' });
        expect(iconOf('middle', { set: 'arrows', reverse: true })).toEqual({ shape: 'side', color: 'amber' });
    });
});

describe('bars and scales - what a cell gets', () => {
    const shown = () => ({ min: 0, max: 200 });

    it('expect the classes and the custom properties of a bar and a scale', () => {
        const format: ColumnFormat = { bar: { color: 'green' }, scale: { minColor: 'red', maxColor: '#00ff00' } };

        expect(cellFillOf(50, format, null, shown)).toEqual({
            classes: ['simple-html-grid-cell-bar', 'simple-html-grid-cell-scale'],
            style: {
                [BAR_START]: '0%',
                [BAR_END]: '25%',
                [BAR_COLOR]: 'var(--simple-html-grid-palette-green-bg-color)',
                [SCALE_FROM]: 'var(--simple-html-grid-palette-red-bg-color)',
                [SCALE_TO]: 'light-dark(#ccffcc, #003300)',
                [SCALE_AT]: '25%'
            }
        });
    });

    it("expect a rule's background to win over the scale, the bar to stay", () => {
        const format: ColumnFormat = { bar: {}, scale: { minColor: 'red', maxColor: 'green' } };

        const fill = cellFillOf(50, format, { operator: 'GREATER_THAN', value: '0', background: 'grey' }, shown);
        expect(fill.classes).toEqual(['simple-html-grid-cell-bar']);
        // the default colour of a bar
        expect(fill.style[BAR_COLOR]).toBe('var(--simple-html-grid-palette-blue-bg-color)');
        // a text colour of a rule does not
        expect(cellFillOf(50, format, { operator: 'GREATER_THAN', value: '0', color: 'red' }, shown).classes).toEqual([
            'simple-html-grid-cell-bar',
            'simple-html-grid-cell-scale'
        ]);
    });

    it('expect nothing for a format without them, a value that is no number - the range not even asked', () => {
        let asked = 0;
        const counting = () => {
            asked++;
            return shown();
        };

        expect(cellFillOf(50, {}, null, counting)).toBe(NO_FILL);
        expect(cellFillOf(null, { bar: {} }, null, counting)).toBe(NO_FILL);
        expect(cellFillOf('12', { bar: {} }, null, counting)).toBe(NO_FILL);
        expect(cellFillOf(5, undefined, null, counting)).toBe(NO_FILL);
        expect(asked).toBe(0);
        // no rows: no bar of the default range
        expect(cellFillOf(5, { bar: {} }, null, () => null)).toEqual({ classes: [], style: {} });
    });

    it('expect two decimals of a percent at most', () => {
        const fill = cellFillOf(1, { bar: {} }, null, () => ({ min: 0, max: 3 }));
        expect(fill.style[BAR_END]).toBe('33.33%');
    });

    it('expect a palette name or a checked #rrggbb only in the css value - anything else the default', () => {
        expect(fillValue('teal')).toBe('var(--simple-html-grid-palette-teal-bg-color)');
        expect(fillValue('#0F766E')).toBe(`light-dark(${lightTint('#0F766E')}, ${darkTint('#0F766E')})`);
        expect(fillValue('red;}' as never)).toBe('var(--simple-html-grid-palette-blue-bg-color)');
        expect(fillValue('url(x)' as never)).toBe('var(--simple-html-grid-palette-blue-bg-color)');
        expect(fillValue(undefined)).toBe('var(--simple-html-grid-palette-blue-bg-color)');
    });

    it('expect the tints of a custom colour: a fifth of it, white in light and black in dark', () => {
        expect(lightTint('#000000')).toBe('#cccccc');
        expect(darkTint('#ffffff')).toBe('#333333');
        expect(lightTint('#ff0000')).toBe('#ffcccc');
        expect(darkTint('#ff0000')).toBe('#330000');
        expect(mixColors('#000000', '#ffffff', 0.5)).toBe('#808080');
    });
});

describe('bars, scales, icons - the check of a format', () => {
    const check =
        (format: unknown, type: 'number' | 'text' = 'number', lookup = false) =>
        () =>
            assertColumnFormat(format, 'total', type, lookup, 'GridConfig: columns.total.format');

    it('expect a bar, a scale and icons of every part to pass', () => {
        expect(check({ bar: {} })).not.toThrow();
        expect(check({ bar: { color: '#0f766e', min: -5, max: 5 } })).not.toThrow();
        expect(
            check({ scale: { minColor: 'red', midColor: 'yellow', maxColor: 'green', min: 0, mid: 0, max: 100 } })
        ).not.toThrow();
        expect(
            check({ icons: { set: 'flags', thresholds: [0, 100], unit: 'percent', reverse: false, position: 'after' } })
        ).not.toThrow();
        expect(check({ icons: { set: 'symbols', thresholds: [-500, 1e6], unit: 'number' } })).not.toThrow();
        expect(
            check({
                rules: [{ operator: 'LESS_THAN', value: '0', color: 'red' }],
                bar: {},
                scale: { minColor: 'red', maxColor: 'green' },
                icons: { set: 'arrows' }
            })
        ).not.toThrow();
    });

    it('expect a TypeError for a column that is no number column, a lookup column, a checkbox', () => {
        expect(check({ bar: {} }, 'text')).toThrow(
            new TypeError("GridConfig: columns.total.format.bar is for a number field, 'total' is text")
        );
        expect(check({ icons: { set: 'arrows' } }, 'number', true)).toThrow(
            /icons is for a number field, 'total' is a lookup column/
        );
        expect(check({ checkbox: {}, scale: { minColor: 'red', maxColor: 'green' } })).toThrow(
            'GridConfig: columns.total.format has checkbox and scale: a checkbox shows no number, it is the one or the other'
        );
    });

    it('expect a TypeError for a bar that does not fit', () => {
        expect(check({ bar: 'blue' })).toThrow(/bar is "blue", it is an object/);
        expect(check({ bar: { colour: 'blue' } })).toThrow(
            "GridConfig: columns.total.format.bar has 'colour', a data bar has color, min, max"
        );
        expect(check({ bar: { color: 'magenta' } })).toThrow(/bar.color is "magenta", it is a colour of the palette/);
        expect(check({ bar: { color: '#fff' } })).toThrow(/bar.color is "#fff"/);
        expect(check({ bar: { min: '0' } })).toThrow(/bar.min is "0", it is a finite number/);
        expect(check({ bar: { max: Number.POSITIVE_INFINITY } })).toThrow(/bar.max is Infinity, it is a finite number/);
        expect(check({ scale: { minColor: 'red', maxColor: 'green', mid: Number.NaN } })).toThrow(/scale.mid is NaN/);
        expect(check({ bar: { min: 5, max: 5 } })).toThrow(
            'GridConfig: columns.total.format.bar has min 5 and max 5: the min is below the max'
        );
    });

    it('expect a TypeError for a scale that does not fit', () => {
        expect(check({ scale: [] })).toThrow(/scale is \[\], it is an object/);
        expect(check({ scale: { maxColor: 'green' } })).toThrow(/scale.minColor is undefined, it is a colour/);
        expect(check({ scale: { minColor: 'red' } })).toThrow(/scale.maxColor is undefined/);
        expect(check({ scale: { minColor: 'red', midColor: 'nope', maxColor: 'green' } })).toThrow(/scale.midColor is "nope"/);
        expect(check({ scale: { minColor: 'red', maxColor: 'green', mid: 5 } })).toThrow(/has mid without midColor/);
        expect(check({ scale: { minColor: 'red', maxColor: 'green', min: 9, max: 1 } })).toThrow(/has min 9 and max 1/);
        expect(check({ scale: { minColor: 'red', midColor: 'grey', maxColor: 'green', min: 0, mid: 200, max: 100 } })).toThrow(
            'GridConfig: columns.total.format.scale.mid is 200: the midpoint is between the min and the max'
        );
        expect(check({ scale: { minColor: 'red', maxColor: 'green', middle: 1 } })).toThrow(
            /scale has 'middle', a colour scale has/
        );
    });

    it('expect a TypeError for icons that do not fit', () => {
        expect(check({ icons: {} })).toThrow(/icons.set is undefined, it is 'arrows', 'traffic', 'flags', 'symbols'/);
        expect(check({ icons: { set: 'stars' } })).toThrow(/icons.set is "stars"/);
        expect(check({ icons: { set: 'arrows', thresholds: [50] } })).toThrow(/icons.thresholds is \[50\], it is two numbers/);
        expect(check({ icons: { set: 'arrows', thresholds: ['1', 2] } })).toThrow(/it is two numbers/);
        expect(check({ icons: { set: 'arrows', thresholds: [70, 30] } })).toThrow(
            /thresholds is \[70, 30\]: the first is not above the second/
        );
        expect(check({ icons: { set: 'arrows', thresholds: [-1, 50] } })).toThrow(/in percent they are 0 to 100/);
        expect(check({ icons: { set: 'arrows', thresholds: [10, 500] } })).toThrow(/in percent they are 0 to 100/);
        expect(check({ icons: { set: 'arrows', unit: 'values' } })).toThrow(
            /icons.unit is "values", it is 'percent' or 'number'/
        );
        expect(check({ icons: { set: 'arrows', reverse: 'yes' } })).toThrow(/icons.reverse is "yes", it is true or false/);
        expect(check({ icons: { set: 'arrows', position: 'left' } })).toThrow(
            /icons.position is "left", it is 'before' or 'after'/
        );
        expect(check({ icons: { set: 'arrows', size: 2 } })).toThrow(
            /icons has 'size', an icon set has set, thresholds, unit, reverse, position/
        );
    });
});

describe('bars, scales, icons - the numbers of the grid config dialog', () => {
    it('expect a number with a dot or a comma, nothing as Automatic, any other text as no number', () => {
        expect(parseNumberText('12.5')).toBe(12.5);
        expect(parseNumberText(' -1,5 ')).toBe(-1.5);
        expect(parseNumberText('.5')).toBe(0.5);
        expect(parseNumberText('+7')).toBe(7);
        expect(parseNumberText('1.')).toBe(1);
        expect(parseNumberText('')).toBeUndefined();
        expect(parseNumberText('   ')).toBeUndefined();
        for (const text of ['1 000', '1,000.5', '1e3', '0x10', 'Infinity', '-', 'abc', '1..2']) {
            expect(parseNumberText(text), text).toBeNull();
        }
    });

    it('expect the problems of a column: a text that is no number, min and max, the midpoint, the thresholds', () => {
        const ids = (format: ColumnFormat, typed: Record<string, string> = {}) =>
            valueFillProblems('total', format, typed).map((problem) => problem.id);

        expect(ids({ bar: {}, scale: { minColor: 'red', maxColor: 'green' }, icons: { set: 'arrows' } })).toEqual([]);
        expect(valueFillProblems('total', { bar: {} }, { 'total|bar-min': 'x', 'other|bar-min': 'y' })).toEqual([
            { id: 'columnSettings.bars.problem.notNumber', values: { value: 'x' }, kinds: ['bar'] }
        ]);
        // each problem names the panel it is in: a scale's min and max, an icon set's thresholds
        expect(
            valueFillProblems('total', { scale: { minColor: 'red', maxColor: 'green', min: 5, max: 1 } }, {})[0].kinds
        ).toEqual(['scale']);
        expect(valueFillProblems('total', { icons: { set: 'arrows' } }, { 'total|icons-low': 'x' })[0].kinds).toEqual(['icons']);
        expect(ids({ bar: { min: 5, max: 1 } })).toEqual(['columnSettings.bars.problem.minMax']);
        expect(ids({ scale: { minColor: 'red', maxColor: 'green', min: 5, max: 5 } })).toEqual([
            'columnSettings.bars.problem.minMax'
        ]);
        expect(ids({ scale: { minColor: 'red', midColor: 'grey', maxColor: 'green', max: 10, mid: 20 } })).toEqual([
            'columnSettings.bars.problem.mid'
        ]);
        expect(ids({ icons: { set: 'arrows', thresholds: [50, 40] } })).toEqual(['columnSettings.bars.problem.thresholds']);
        expect(ids({ icons: { set: 'arrows', thresholds: [50, 140] } })).toEqual(['columnSettings.bars.problem.percent']);
        expect(ids({ icons: { set: 'arrows', thresholds: [50, 140], unit: 'number' } })).toEqual([]);
    });
});
