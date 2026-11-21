import { assertOptions } from '../../datasource/assertOptions';
import type { Entity } from '../../datasource/entity';
import { buildCsv, CSV_SEPARATORS, type CsvOptions, escapeFormula, rawValueText } from '../csv';
import type { GridInterface } from '../gridInterface';
import { rangeBlock } from './cellRanges';
import { getCellType } from './getCellType';
import { getColumnLabel } from './getColumnLabel';
import { getLayoutFields } from './getLayoutFields';

/**
 * The grid's side of the CSV export: which rows and fields, their labels and texts. The file itself
 * is built by csv.ts. Reads the interface and the datasource only, so it works without a connected
 * grid too.
 */

/**
 * the methods of GridInterface that export, for the messages, and whether each writes a BOM by
 * default: a file for Excel wants one, text for code does not
 */
const BOM_BY_DEFAULT = { getCsv: false, downloadCsv: true };

type CsvMethod = keyof typeof BOM_BY_DEFAULT;

/**
 * every key of CsvOptions, for the check of an options object from plain JavaScript
 */
const OPTION_KEYS: readonly (keyof CsvOptions)[] = [
    'rows',
    'fields',
    'header',
    'formatted',
    'separator',
    'bom',
    'escapeFormulas'
];

/**
 * the options that are booleans
 */
const BOOLEAN_KEYS: readonly (keyof CsvOptions)[] = ['header', 'formatted', 'bom', 'escapeFormulas'];

/**
 * How long downloadCsv() keeps the file's object URL before it frees it. The download starts after
 * click() returns, so the URL is not revoked right away; 40 seconds is what FileSaver.js waits.
 */
export const REVOKE_URL_AFTER_MS = 40_000;

/**
 * The CSV text of the grid's rows, see {@link CsvOptions}.
 * @param method the GridInterface method called, for the messages and the default of `bom`
 * @throws a `TypeError` for an options object with a key or a value it does not know
 */
export function gridCsv(gridInterface: GridInterface<any>, method: CsvMethod, options: CsvOptions): string {
    assertCsvOptions(method, options);
    const { rows = 'all', header = true, formatted = true, separator = ',', escapeFormulas = true } = options;
    const bom = options.bom ?? BOM_BY_DEFAULT[method];
    const datasource = gridInterface.getDatasource();

    // 'range': the cells of the range made last, no range is no fields and no rows
    const range = rows === 'range' ? gridInterface.getRanges().at(-1) : undefined;
    const block = range ? rangeBlock(gridInterface, range) : { rows: [], fields: [] };
    const fields = options.fields ?? (rows === 'range' ? block.fields : getLayoutFields(gridInterface));

    // the text with a formula escaped, see escapeFormulas
    const safeText = (text: string) => (escapeFormulas ? escapeFormula(text) : text);

    // the labels are text, a formula in one is escaped too
    const labels = header ? fields.map((field) => safeText(getColumnLabel({ gridInterface }, field))) : null;

    // 'all': what the filter lets through, sorted - grouped, the rows of collapsed groups too, no
    // group rows. 'selected': the selected rows that are displayed, in the same order. 'range': the
    // data rows of the range, top to bottom
    const dataRows =
        rows === 'range' ? block.rows : rows === 'selected' ? datasource.getSelectedRows() : datasource.getDataRows();

    const textOf = fields.map((field) => cellText(gridInterface, field, formatted));
    const records = dataRows.map((row) =>
        fields.map((field, i) => {
            const text = textOf[i](row);
            return mayHoldFormula(row[field]) ? safeText(text) : text;
        })
    );

    return buildCsv(labels, records, { separator, bom });
}

/**
 * Saves the grid's rows as a CSV file: a Blob, downloaded with the click of an `<a download>`. The
 * link is not put in the page (an `a` element does not need to be to download, and a modal dialog
 * makes the page inert). Its object URL is freed after REVOKE_URL_AFTER_MS.
 * @throws a `TypeError` when the filename is not a text, or for options it does not know
 */
export function downloadGridCsv(gridInterface: GridInterface<any>, filename: string, options: CsvOptions) {
    if (typeof filename !== 'string' || filename === '') {
        throw new TypeError(
            `downloadCsv(filename, options): the filename comes first and is a text, e.g. downloadCsv('export.csv', { rows: 'selected' }), got ${show(filename)}`
        );
    }
    const text = gridCsv(gridInterface, 'downloadCsv', options);

    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_URL_AFTER_MS);
}

/**
 * A function that gives the text of a field of a row: the text the grid's cell shows (as
 * renderRowCell builds it), or the value as it is stored. The clipboard of the cell ranges copies the
 * text the cells show with it too (rangeClipboard.ts).
 */
export function cellText(gridInterface: GridInterface<any>, field: string, formatted: boolean): (row: Entity) => string {
    if (!formatted) {
        return (row) => rawValueText(row[field]);
    }

    const datasource = gridInterface.getDatasource();
    const column = gridInterface.__getGridConfig().columns[field];
    const formatter = datasource.getFormatter(field);
    // a column with dynamicCellTypeColumn takes the type, and so the formatter, from the row
    const dynamic = !!column?.dynamicCellTypeColumn;
    // as the cells: numberOverride follows the field's type, not the cell's
    const numberOverride = datasource.getField(field).type === 'number' ? column?.numberOverride : undefined;

    return (row) => {
        const cellFormatter = dynamic ? datasource.getFormatter(field, getCellType({ gridInterface }, field, row)) : formatter;
        // a formatter of plain JavaScript can give something else than text
        const text = String(cellFormatter.format(row[field]) ?? '');
        if (numberOverride === 'BLANK_TO_ZERO' && text === '') {
            return '0';
        }
        if (numberOverride === 'ZERO_TO_BLANK' && text === '0') {
            return '';
        }
        return text;
    };
}

/**
 * Can the value's text be a formula someone put there: text, or an object holding text. A number, a
 * boolean, a Date and a blank (null, undefined) can not - their text is the formatter's, `-5` stays `-5`.
 */
function mayHoldFormula(value: unknown): boolean {
    return !(
        value === null ||
        value === undefined ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value instanceof Date
    );
}

/**
 * The options are checked: plain JavaScript, or options stored as JSON, would else export something
 * else without a word - `{ row: 'selected' }` every row.
 * @throws a `TypeError` naming the option and what it takes
 */
function assertCsvOptions(method: CsvMethod, options: unknown): asserts options is CsvOptions {
    assertOptions(method, options, `${method}({ rows: 'selected' })`);
    if (typeof options !== 'object' || options === null || Array.isArray(options)) {
        throw new TypeError(`${method}() takes an options object, e.g. ${method}({ rows: 'selected' }), got ${show(options)}`);
    }
    for (const key of Object.keys(options)) {
        if (!OPTION_KEYS.includes(key as keyof CsvOptions)) {
            throw new TypeError(`${method}(): unknown option '${key}', the options are ${OPTION_KEYS.join(', ')}`);
        }
    }
    const { rows, fields, separator } = options as CsvOptions;
    if (rows !== undefined && rows !== 'all' && rows !== 'selected' && rows !== 'range') {
        throw new TypeError(`${method}(): rows is 'all', 'selected' or 'range', got ${show(rows)}`);
    }
    if (fields !== undefined && !(Array.isArray(fields) && fields.every((field) => typeof field === 'string'))) {
        throw new TypeError(`${method}(): fields is a list of field names, got ${show(fields)}`);
    }
    if (separator !== undefined && !CSV_SEPARATORS.includes(separator)) {
        throw new TypeError(`${method}(): separator is ',', ';' or '\\t', got ${show(separator)}`);
    }
    for (const key of BOOLEAN_KEYS) {
        const value = (options as CsvOptions)[key];
        if (value !== undefined && typeof value !== 'boolean') {
            throw new TypeError(`${method}(): ${key} is true or false, got ${show(value)}`);
        }
    }
}

/**
 * a value for a message: text in quotes, the rest as String() writes it
 */
function show(value: unknown): string {
    if (typeof value === 'string') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map(show).join(', ')}]`;
    }
    return String(value);
}
