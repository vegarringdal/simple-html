import { assertOptions } from '../../datasource/assertOptions';
import { DateFormatterDDMMYYYY } from '../../datasource/DateFormatterDDMMYYYY';
import { DateFormatterDDMMYYYYTHHMMSS } from '../../datasource/DateFormatterDDMMYYYYTHHMMSS';
import type { Entity } from '../../datasource/entity';
import type { Formatter } from '../../datasource/formatter';
import { type ColorRule, colorRuleOf, type RuleColor } from '../colorRules';
import { type DateFormat, hasValueFormat, type NumberFormat } from '../columnFormat';
import { DEFAULT_BAR_COLOR, DEFAULT_THRESHOLDS, type IconSetName } from '../dataBars';
import type { GridInterface } from '../gridInterface';
import { isHexColor, LIGHT_PALETTE, lightTint, mixColors, readableOn } from '../ruleColors';
import {
    assertSheetName,
    buildXlsx,
    type ExcelOptions,
    excelSerial,
    XLSX_MIME,
    type XlsxConditionalFormat,
    type XlsxDateOrder,
    type XlsxIconSet,
    type XlsxSheet,
    type XlsxStyle,
    type XlsxThreshold,
    type XlsxValue
} from '../xlsx';
import { rangeBlock } from './cellRanges';
import { numberOverrideOf } from './cellText';
import { getCellType } from './getCellType';
import { getColumnLabel } from './getColumnLabel';
import { getLayoutFields } from './getLayoutFields';
import { cellText, downloadBlob, show } from './gridCsv';

/**
 * The grid's side of the Excel export: which rows and fields, their labels, widths and typed values.
 * The file itself is built by xlsx.ts. Reads the interface and the datasource only, so it works
 * without a connected grid too.
 *
 * The rows and fields are picked as for the CSV export (gridCsv.ts), the values are not the texts
 * the cells show but the values themselves, typed: see {@link excelCell}.
 *
 * The colours (`colors`, on by default), in the default theme's light look (ruleColors.ts,
 * LIGHT_PALETTE): a colour rule's text colour, background and bold as the cell's own style (excelRuleStyle -
 * a rule can be a formula over the row, Excel could not test it); a data bar, a colour scale and an icon set
 * as Excel's own conditional formatting of the column (valueFillFormats), drawn by Excel from the values.
 */

/**
 * the methods of GridInterface that export to Excel, for the messages
 */
type ExcelMethod = 'getExcel' | 'downloadExcel';

/**
 * every key of ExcelOptions, for the check of an options object from plain JavaScript
 */
const OPTION_KEYS: readonly (keyof ExcelOptions)[] = ['rows', 'fields', 'sheetName', 'colors'];

/**
 * The .xlsx file of the grid's rows as a Blob, see {@link ExcelOptions}. The rows and their values
 * are read when it is called, before the first await: an edit while the file is zipped is not in it.
 * @param method the GridInterface method called, for the messages
 * @throws (the promise rejects with) a `TypeError` for an options object with a key or a value it
 * does not know
 */
export async function gridExcel(gridInterface: GridInterface<any>, method: ExcelMethod, options: ExcelOptions): Promise<Blob> {
    const bytes = buildXlsx(gridSheet(gridInterface, method, options));
    return new Blob([await bytes], { type: XLSX_MIME });
}

/**
 * Saves the grid's rows as an .xlsx file: a Blob, downloaded by downloadBlob() as the CSV is.
 * @throws (the promise rejects with) a `TypeError` when the filename is not a text, or for options
 * it does not know
 */
export async function downloadGridExcel(gridInterface: GridInterface<any>, filename: string, options: ExcelOptions) {
    if (typeof filename !== 'string' || filename === '') {
        throw new TypeError(
            `downloadExcel(filename, options): the filename comes first and is a text, e.g. downloadExcel('export.xlsx', { rows: 'selected' }), got ${show(filename)}`
        );
    }
    const blob = await gridExcel(gridInterface, 'downloadExcel', options);
    downloadBlob(blob, filename);
}

/**
 * The sheet of the grid's rows: a column per field with its label and the width of its column in the
 * layout, a row per data row - a flat list, also when the grid is grouped.
 * @throws a `TypeError` for options it does not know
 */
export function gridSheet(gridInterface: GridInterface<any>, method: ExcelMethod, options: ExcelOptions): XlsxSheet {
    assertExcelOptions(method, options);
    const { rows = 'all', sheetName = 'Sheet1', colors = true } = options;
    const datasource = gridInterface.getDatasource();

    // 'range': the cells of the range made last, as the CSV export takes them; no range is no fields
    // and no rows
    const range = rows === 'range' ? gridInterface.getRanges().at(-1) : undefined;
    const block = range ? rangeBlock(gridInterface, range) : { rows: [], fields: [] };
    const fields = options.fields ?? (rows === 'range' ? block.fields : getLayoutFields(gridInterface));

    const widths = layoutWidths(gridInterface);
    const columns = fields.map((field) => ({ label: getColumnLabel({ gridInterface }, field), width: widths.get(field) }));

    // 'all': what the filter lets through, sorted - grouped, the rows of collapsed groups too, no
    // group rows. 'selected': the selected rows that are displayed, in the same order. 'range': the
    // data rows of the range, top to bottom
    const dataRows =
        rows === 'range' ? block.rows : rows === 'selected' ? datasource.getSelectedRows() : datasource.getDataRows();

    const cellOf = fields.map((field) => excelCell(gridInterface, field));
    // the colour rule of each cell of a column with rules, once: its style, and whether a scale is on it
    const configColumns = gridInterface.__getGridConfig().columns;
    const rulesOf = fields.map((field) =>
        colors && configColumns[field]?.format?.rules?.length
            ? dataRows.map((row) => colorRuleOf(gridInterface, field, row))
            : null
    );
    const sheetRows = dataRows.map((row, r) =>
        cellOf.map((cell, i) => {
            const value = cell(row);
            const style = excelRuleStyle(rulesOf[i]?.[r] ?? null);
            return style ? { value, style } : value;
        })
    );
    const conditionalFormats = colors ? fields.flatMap((field, i) => valueFillFormats(gridInterface, field, i, rulesOf[i])) : [];
    return { name: sheetName, columns, rows: sheetRows, conditionalFormats };
}

/**
 * A colour of the grid as Excel writes it: a colour of the palette in the default theme's light look -
 * the text colour or the background - a custom colour as it is
 */
function excelColor(color: RuleColor, part: 'color' | 'background'): string {
    return isHexColor(color) ? color.toLowerCase() : LIGHT_PALETTE[color][part];
}

/**
 * The style of a cell from its colour rule, as the grid shows it in light: the rule's text colour - black
 * or white on a custom background without one, as the grid makes it - its background and bold. null for
 * no rule
 */
export function excelRuleStyle(rule: ColorRule | null): XlsxStyle | null {
    if (!rule) {
        return null;
    }
    const style: XlsxStyle = {};
    if (rule.background) {
        style.fill = excelColor(rule.background, 'background');
    }
    if (rule.color) {
        style.color = excelColor(rule.color, 'color');
    } else if (isHexColor(rule.background)) {
        style.color = readableOn(rule.background);
    }
    if (rule.bold) {
        style.bold = true;
    }
    return style;
}

/** the icon sets of Excel of the grid's: the same icons, Excel's symbols without a circle */
const EXCEL_ICON_SETS: Readonly<Record<IconSetName, XlsxIconSet>> = {
    arrows: '3Arrows',
    traffic: '3TrafficLights1',
    flags: '3Flags',
    symbols: '3Symbols2'
};

/**
 * The colour of a colour scale in Excel: a colour of the palette its background in light, a custom colour
 * its tint in light - what the grid shows, Excel's black text reads on it
 */
function excelScaleColor(color: RuleColor): string {
    return isHexColor(color) ? lightTint(color) : LIGHT_PALETTE[color].background;
}

/**
 * The colour of a data bar in Excel, which draws it as a gradient to white: a colour of the palette
 * halfway between its text colour and its background in light - a stronger colour than the grid's tint,
 * as Excel's own bars - a custom colour as it is
 */
function excelBarColor(color: RuleColor): string {
    return isHexColor(color) ? color.toLowerCase() : mixColors(LIGHT_PALETTE[color].color, LIGHT_PALETTE[color].background, 0.5);
}

/** a value of the format as Excel's threshold: the number, else Excel's own */
const fixedOr = (value: number | undefined, otherwise: XlsxThreshold): XlsxThreshold =>
    value === undefined ? otherwise : { type: 'number', value };

/**
 * Excel's own conditional formatting of a number column's data bar, colour scale and icon set
 * (`ColumnFormat.bar`, `scale`, `icons`), as the grid draws them - Excel computes them from the column's
 * values:
 * - the bar from `min` to `max`, left out the column's smallest and largest value with 0
 *   (`MIN(0,MIN(...))`). Excel's bar starts at the low end: a negative value is not drawn left of an axis
 * - the scale's colours at `min`, `mid` and `max`, left out the smallest, halfway and the largest. Not on
 *   the cells whose colour rule has a background: it wins, as in the grid
 * - the icons from the thresholds, percent of the range or numbers, reversed with `reverse`
 * @param rules the colour rule of each row, null for a column without rules
 */
function valueFillFormats(
    gridInterface: GridInterface<any>,
    field: string,
    column: number,
    rules: (ColorRule | null)[] | null
): XlsxConditionalFormat[] {
    const format = gridInterface.__getGridConfig().columns[field]?.format;
    if (
        gridInterface.getDatasource().getField(field).type !== 'number' ||
        gridInterface.__getLookupColumn(field) ||
        format?.checkbox
    ) {
        return [];
    }
    const formats: XlsxConditionalFormat[] = [];
    const { bar, scale, icons } = format ?? {};
    if (bar) {
        formats.push({
            kind: 'dataBar',
            column,
            min: fixedOr(bar.min, { type: 'lowestOrZero' }),
            max: fixedOr(bar.max, { type: 'highestOrZero' }),
            color: excelBarColor(bar.color ?? DEFAULT_BAR_COLOR)
        });
    }
    if (scale) {
        const stops = [{ at: fixedOr(scale.min, { type: 'lowest' }), color: excelScaleColor(scale.minColor) }];
        if (scale.midColor) {
            stops.push({ at: fixedOr(scale.mid, { type: 'middle' }), color: excelScaleColor(scale.midColor) });
        }
        stops.push({ at: fixedOr(scale.max, { type: 'highest' }), color: excelScaleColor(scale.maxColor) });
        const each: XlsxConditionalFormat = { kind: 'colorScale', column, stops };
        if (rules?.some((rule) => rule?.background)) {
            each.rows = rules.flatMap((rule, row) => (rule?.background ? [] : [row]));
        }
        formats.push(each);
    }
    if (icons) {
        const [low, high] = icons.thresholds ?? DEFAULT_THRESHOLDS;
        const type = icons.unit === 'number' ? 'number' : 'percent';
        formats.push({
            kind: 'iconSet',
            column,
            set: EXCEL_ICON_SETS[icons.set],
            thresholds: [
                { type, value: low },
                { type, value: high }
            ],
            reverse: icons.reverse === true
        });
    }
    return formats;
}

/**
 * A function that gives the Excel cell of a field of a row: the value itself, typed by the cell's
 * type (the field's, or the row's with `dynamicCellTypeColumn`):
 *
 * | the cell's type | the value | the cell |
 * | --- | --- | --- |
 * | `number` | a finite number | a number, General format: every digit, as the grid shows it |
 * | `date` | a valid `Date` | a serial date, its local day, formatted `yyyy-mm-dd` (`dd.mm.yyyy` with a DDMMYYYY formatter) |
 * | `datetime` | a valid `Date` | a serial date with the time to the second, `yyyy-mm-dd hh:mm:ss` |
 *
 * A column's display format (`ColumnConfig.format`) gives the cell an Excel number format like it,
 * where Excel has one - see excelDateFormat and excelNumberFormat. The value stays the value.
 * | `boolean` | `true` / `false` | a boolean, TRUE / FALSE |
 * | any | null, undefined, `''`, an invalid `Date` | no cell |
 * | any | anything else | text: what the cell shows, the formatter's text |
 *
 * So a text field holding a number gives text, a number field holding the text `'12'` gives text too:
 * the value is not of the field's type. A date Excel can not hold (before 1900) is the text the cell
 * shows. A number column's `numberOverride` is followed, as in the cells: `BLANK_TO_ZERO` writes 0 for
 * a blank, `ZERO_TO_BLANK` no cell for 0. A lookup column (`ColumnConfig.editor`) is the label its cell
 * shows, text - also for a number field.
 */
function excelCell(gridInterface: GridInterface<any>, field: string): (row: Entity) => XlsxValue {
    // the text the cell shows, for a value that is not of the cell's type
    const shownText = cellText(gridInterface, field, true);
    if (gridInterface.__getLookupColumn(field)) {
        return (row) => shownText(row) || null;
    }

    const datasource = gridInterface.getDatasource();
    const column = gridInterface.__getGridConfig().columns[field];
    const fieldType = datasource.getField(field).type;
    // a column with dynamicCellTypeColumn takes the type from the row
    const dynamic = !!column?.dynamicCellTypeColumn;
    // as the cells: numberOverride follows the field's type, not the cell's - the user's from the column
    // settings first (numberOverrideOf)
    const numberOverride = fieldType === 'number' ? numberOverrideOf(column) : undefined;
    // the column's display format as an Excel number format, undefined where Excel has none. A column
    // with dynamicCellTypeColumn is a text field: it has no date or number format. The template and the
    // link of a text column are not exported: the cell is its value, as copy and the CSV export have it
    const format = column?.format && hasValueFormat(column.format) ? column.format : undefined;
    const numberFormat = format?.number ? excelNumberFormat(format.number) : undefined;
    const dateFormat = format?.date ? excelDateFormat(format.date) : undefined;
    const number = (value: number): XlsxValue => (numberFormat ? { number: value, format: numberFormat } : value);

    return (row) => {
        const type = dynamic ? getCellType({ gridInterface }, field, row) : fieldType;
        const value = row[field];

        if (value === null || value === undefined || value === '') {
            return numberOverride === 'BLANK_TO_ZERO' ? number(0) : null;
        }
        if (type === 'number' && typeof value === 'number' && Number.isFinite(value)) {
            return numberOverride === 'ZERO_TO_BLANK' && value === 0 ? null : number(value);
        }
        if (type === 'boolean' && typeof value === 'boolean') {
            return value;
        }
        if ((type === 'date' || type === 'datetime') && value instanceof Date) {
            if (Number.isNaN(value.getTime())) {
                return null;
            }
            const time = type === 'datetime';
            if (excelSerial(value, time) !== null) {
                const order = dateOrder(datasource.getFormatter(field, type));
                return dateFormat ? { date: value, time, order, format: dateFormat } : { date: value, time, order };
            }
        }
        return shownText(row) || null;
    };
}

/**
 * The order of a date in Excel: day first for the built-in DDMMYYYY formatters, as the grid shows it,
 * else year first (ISO), whatever a formatter of your own shows
 */
function dateOrder(formatter: Formatter): XlsxDateOrder {
    return formatter === DateFormatterDDMMYYYY || formatter === DateFormatterDDMMYYYYTHHMMSS ? 'DMY' : 'YMD';
}

/**
 * The Excel number formats of the date display formats Excel can show. A `.` and a `/` are escaped:
 * unescaped they are the decimal mark and the date separator of the computer's language. `dddd` is the
 * day's name in Excel's language. Not here, so the date in the field's order (dateOrder): `medium`,
 * `long` and `full` (the names and their order are Intl's, in the language of `format.locale`), the
 * weeks, the quarter and the days until - Excel's number formats have none of them
 */
const EXCEL_DATE_FORMATS: Partial<Record<DateFormat, string>> = {
    iso: 'yyyy-mm-dd',
    norwegian: 'dd\\.mm\\.yyyy',
    norwegianShort: 'dd\\.mm\\.yy',
    us: 'mm\\/dd\\/yyyy',
    uk: 'dd\\/mm\\/yyyy',
    weekday: 'dddd',
    month: 'yyyy-mm',
    year: 'yyyy',
    isoTime: 'yyyy-mm-dd hh:mm',
    isoSeconds: 'yyyy-mm-dd hh:mm:ss',
    norwegianTime: 'dd\\.mm\\.yyyy hh:mm',
    norwegianSeconds: 'dd\\.mm\\.yyyy hh:mm:ss',
    time: 'hh:mm',
    timeSeconds: 'hh:mm:ss'
};

/**
 * The Excel number format of a date display format, undefined where Excel has none: see
 * EXCEL_DATE_FORMATS
 */
export function excelDateFormat(format: DateFormat): string | undefined {
    return EXCEL_DATE_FORMATS[format];
}

/**
 * The Excel number format of a number display format: the decimals, `#,##0` with a thousands
 * separator, `%` with percent (Excel shows the number times 100) - `#,##0.00`, `0.0%`. Excel shows the
 * separators of the computer's language, not the characters of the format. undefined without
 * `decimals`: General, every decimal - a number format of Excel's has a fixed number of them
 */
export function excelNumberFormat(format: NumberFormat): string | undefined {
    if (format.decimals === undefined) {
        return undefined;
    }
    const integer = format.thousands ? '#,##0' : '0';
    const fraction = format.decimals ? `.${'0'.repeat(format.decimals)}` : '';
    return `${integer}${fraction}${format.percent ? '%' : ''}`;
}

/**
 * The width in px of each field in the layout: the width of its column, the first column when a
 * field is in two (pinned with a copy)
 */
function layoutWidths(gridInterface: GridInterface<any>): Map<string, number> {
    const layout = gridInterface.__getGridConfig().layout;
    const widths = new Map<string, number>();
    for (const column of [...layout.left, ...layout.center, ...layout.right]) {
        for (const field of column.fields) {
            if (!widths.has(field)) {
                widths.set(field, column.width);
            }
        }
    }
    return widths;
}

/**
 * The options are checked: plain JavaScript, or options stored as JSON, would else export something
 * else without a word - `{ row: 'selected' }` every row.
 * @throws a `TypeError` naming the option and what it takes
 */
function assertExcelOptions(method: ExcelMethod, options: unknown): asserts options is ExcelOptions {
    assertOptions(method, options, `${method}({ rows: 'selected' })`);
    if (typeof options !== 'object' || options === null || Array.isArray(options)) {
        throw new TypeError(`${method}() takes an options object, e.g. ${method}({ rows: 'selected' }), got ${show(options)}`);
    }
    for (const key of Object.keys(options)) {
        if (!OPTION_KEYS.includes(key as keyof ExcelOptions)) {
            const why = key === 'header' ? ' (an Excel file always has the header row)' : '';
            throw new TypeError(`${method}(): unknown option '${key}'${why}, the options are ${OPTION_KEYS.join(', ')}`);
        }
    }
    const { rows, fields, sheetName, colors } = options as ExcelOptions;
    if (rows !== undefined && rows !== 'all' && rows !== 'selected' && rows !== 'range') {
        throw new TypeError(`${method}(): rows is 'all', 'selected' or 'range', got ${show(rows)}`);
    }
    if (fields !== undefined && !(Array.isArray(fields) && fields.every((field) => typeof field === 'string'))) {
        throw new TypeError(`${method}(): fields is a list of field names, got ${show(fields)}`);
    }
    if (sheetName !== undefined) {
        assertSheetName(sheetName, `${method}()`);
    }
    if (colors !== undefined && typeof colors !== 'boolean') {
        throw new TypeError(`${method}(): colors is true or false, got ${show(colors)}`);
    }
}
