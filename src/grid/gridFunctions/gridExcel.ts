import { assertOptions } from '../../datasource/assertOptions';
import { DateFormatterDDMMYYYY } from '../../datasource/DateFormatterDDMMYYYY';
import { DateFormatterDDMMYYYYTHHMMSS } from '../../datasource/DateFormatterDDMMYYYYTHHMMSS';
import type { Entity } from '../../datasource/entity';
import type { Formatter } from '../../datasource/formatter';
import type { GridInterface } from '../gridInterface';
import {
    assertSheetName,
    buildXlsx,
    type ExcelOptions,
    excelSerial,
    XLSX_MIME,
    type XlsxCell,
    type XlsxDateOrder,
    type XlsxSheet
} from '../xlsx';
import { rangeBlock } from './cellRanges';
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
 */

/**
 * the methods of GridInterface that export to Excel, for the messages
 */
type ExcelMethod = 'getExcel' | 'downloadExcel';

/**
 * every key of ExcelOptions, for the check of an options object from plain JavaScript
 */
const OPTION_KEYS: readonly (keyof ExcelOptions)[] = ['rows', 'fields', 'sheetName'];

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
    const { rows = 'all', sheetName = 'Sheet1' } = options;
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
    return { name: sheetName, columns, rows: dataRows.map((row) => cellOf.map((cell) => cell(row))) };
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
 * | `boolean` | `true` / `false` | a boolean, TRUE / FALSE |
 * | any | null, undefined, `''`, an invalid `Date` | no cell |
 * | any | anything else | text: what the cell shows, the formatter's text |
 *
 * So a text field holding a number gives text, a number field holding the text `'12'` gives text too:
 * the value is not of the field's type. A date Excel can not hold (before 1900) is the text the cell
 * shows. A number column's `numberOverride` is followed, as in the cells: `BLANK_TO_ZERO` writes 0 for
 * a blank, `ZERO_TO_BLANK` no cell for 0.
 */
function excelCell(gridInterface: GridInterface<any>, field: string): (row: Entity) => XlsxCell {
    const datasource = gridInterface.getDatasource();
    const column = gridInterface.__getGridConfig().columns[field];
    const fieldType = datasource.getField(field).type;
    // a column with dynamicCellTypeColumn takes the type from the row
    const dynamic = !!column?.dynamicCellTypeColumn;
    // as the cells: numberOverride follows the field's type, not the cell's
    const numberOverride = fieldType === 'number' ? column?.numberOverride : undefined;
    // the text the cell shows, for a value that is not of the cell's type
    const shownText = cellText(gridInterface, field, true);

    return (row) => {
        const type = dynamic ? getCellType({ gridInterface }, field, row) : fieldType;
        const value = row[field];

        if (value === null || value === undefined || value === '') {
            return numberOverride === 'BLANK_TO_ZERO' ? 0 : null;
        }
        if (type === 'number' && typeof value === 'number' && Number.isFinite(value)) {
            return numberOverride === 'ZERO_TO_BLANK' && value === 0 ? null : value;
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
                return { date: value, time, order: dateOrder(datasource.getFormatter(field, type)) };
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
    const { rows, fields, sheetName } = options as ExcelOptions;
    if (rows !== undefined && rows !== 'all' && rows !== 'selected' && rows !== 'range') {
        throw new TypeError(`${method}(): rows is 'all', 'selected' or 'range', got ${show(rows)}`);
    }
    if (fields !== undefined && !(Array.isArray(fields) && fields.every((field) => typeof field === 'string'))) {
        throw new TypeError(`${method}(): fields is a list of field names, got ${show(fields)}`);
    }
    if (sheetName !== undefined) {
        assertSheetName(sheetName, `${method}()`);
    }
}
