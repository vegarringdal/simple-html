/**
 * CSV text from plain inputs: no grid, no datasource, no DOM. The grid's `getCsv()` and `downloadCsv()`
 * pick the rows, the fields and the texts (see gridFunctions/gridCsv.ts) and build the file with this.
 * The clipboard of the cell ranges (gridFunctions/rangeClipboard.ts) writes tab separated text with it,
 * and reads it back with parseTsv(). The import reads CSV files with parseCsv() and detectSeparator().
 *
 * The format is RFC 4180 (https://www.rfc-editor.org/rfc/rfc4180): a line per record, ended with CRLF;
 * a field is put in double quotes when it holds the separator, a double quote, CR or LF, and a double
 * quote in it is doubled. Spaces are part of a field, they are kept as they are.
 */

import { IMPORT_LIMITS, ImportFileError, type ImportLimits } from './importLimits';

/**
 * The separators {@link CsvOptions} can use: `','` (RFC 4180), `';'` (what Excel expects in a locale
 * with a decimal comma, Norwegian for one) and `'\t'` (tab separated text).
 */
export type CsvSeparator = ',' | ';' | '\t';

/**
 * @internal
 * every separator, for checking an option that comes from plain JavaScript
 */
export const CSV_SEPARATORS: readonly CsvSeparator[] = [',', ';', '\t'];

/**
 * What `gridInterface.getCsv()` and `gridInterface.downloadCsv()` export, and how. Every option is
 * optional, and the object is plain JSON - it can be stored, or come from a menu of your own.
 *
 * | option | default | |
 * | --- | --- | --- |
 * | `rows` | `'all'` | `'all'`: every row the filter lets through, in the sort order. `'selected'`: the selected rows. `'range'`: the rows of the selected range of cells |
 * | `fields` | the layout (`'range'`: the range's) | the fields to export, in order |
 * | `header` | `true` | a first line with the column labels |
 * | `formatted` | `true` | the values as the grid shows them; `false` the values themselves |
 * | `separator` | `','` | `';'` for Excel in a locale with a decimal comma |
 * | `bom` | `true` for `downloadCsv()`, `false` for `getCsv()` | a UTF-8 byte order mark first |
 * | `escapeFormulas` | `true` | text that starts with `=`, `+`, `-`, `@` ... gets a `'` in front |
 *
 * An option with a value it does not know (`rows: 'some'`, `separator: '|'`), or a key it does not
 * know, throws a `TypeError`.
 *
 * @example
 * ```ts
 * import type { CsvOptions } from '@simple-html/grid';
 *
 * // for Excel in Norway: a semicolon between the fields, and the BOM so it reads æøå
 * const forExcel: CsvOptions = { separator: ';', bom: true };
 * const text = gridInterface.getCsv(forExcel);
 *
 * // the selected rows, two fields, the values as they are stored
 * gridInterface.downloadCsv('selected.csv', { rows: 'selected', fields: ['name', 'born'], formatted: false });
 *
 * // the cells the user selected (the last range), with a header line of their columns
 * gridInterface.downloadCsv('range.csv', { rows: 'range' });
 * ```
 */
export interface CsvOptions {
    /**
     * Which rows, default `'all'`:
     * - `'all'`: every row the filter lets through, in the sort order - `datasource.getDataRows()`.
     *   When grouped, every data row in the grouped order, the rows of collapsed groups included; no
     *   group rows
     * - `'selected'`: the selected rows, in the same order - `datasource.getSelectedRows()`. That is
     *   the selected rows that are displayed: a selected row in a collapsed group is left out, as the
     *   row menu's actions on the selected rows leave it out. Nothing selected gives the header only
     * - `'range'`: the selected range of cells - the last of `gridInterface.getRanges()`, the one made
     *   last: its data rows top to bottom (a group row in it is left out) and, unless `fields` is
     *   given, its fields left to right. No range gives an empty text (no fields, no rows)
     */
    rows?: 'all' | 'selected' | 'range';

    /**
     * The fields to export, in this order, a column each. Default the fields of the layout now, in
     * the order the user sees them: pinned left, center, pinned right, and a column of stacked fields
     * gives a CSV column for each of its fields, top to bottom - `gridInterface.getLayoutFields()`.
     * The hidden columns (`getHiddenFields()`) are not in the layout, so they are left out. With
     * `rows: 'range'` the default is the fields of the range.
     *
     * Any field of the rows can be given, also one that is not in the grid.
     */
    fields?: string[];

    /**
     * A first line with the label of each column, default `true`: the label the grid's header shows -
     * the column's `label`, else the datasource field's `label`, else the field name prettified
     * (`first_name` is `First Name`).
     */
    header?: boolean;

    /**
     * Default `true`: each value as the grid shows it, the text of the field's formatter - `12,5` with
     * the `numberComma` formatter, a date as `2026-11-20` (or as its formatter writes it), a boolean
     * as `true` / `false`. A column's `numberOverride` (`ZERO_TO_BLANK`, `BLANK_TO_ZERO`) and
     * `dynamicCellTypeColumn` are followed, as in the cells.
     *
     * `false`: the values as they are stored - a number with a dot (`String(12.5)`), a `Date` as
     * `toISOString()` (UTC: a date at midnight in Norway is the day before at 23:00 or 22:00), a
     * boolean as `true` / `false`, a blank (null, undefined, `''`, an invalid Date) as nothing.
     */
    formatted?: boolean;

    /**
     * Between the fields, default `','` (RFC 4180). Excel uses the list separator of the computer's
     * locale when it opens a .csv file: in a locale with a decimal comma (Norwegian, German ...) that
     * is `';'`, and a file with `','` opens with every row in one column. Use `';'` for those users.
     * `'\t'` gives tab separated text.
     */
    separator?: CsvSeparator;

    /**
     * Writes a UTF-8 byte order mark (`﻿`) first. Excel needs it to read the file as UTF-8,
     * without it `æøå` show up garbled. Default `true` for `downloadCsv()`, `false` for `getCsv()` -
     * text for code of your own does not want it.
     */
    bom?: boolean;

    /**
     * Default `true`: text that starts with `=`, `+`, `-`, `@`, a tab, CR or LF (or the full width
     * `＝ ＋ － ＠`) gets a `'` in front, so a spreadsheet shows it as text and does not run it as a
     * formula. A value a user typed, `=HYPERLINK("http://evil.example", "click")`, would else run on
     * the computer of whoever opens the file - "CSV injection",
     * https://owasp.org/www-community/attacks/CSV_Injection.
     *
     * Only text is escaped: a value that is text in the row (a string, or an object), and the labels.
     * A number, a boolean, a `Date` and a blank never are, whatever their formatter writes - `-5`
     * stays `-5`. The value decides, not the field's type: keep the numbers of a number field as
     * numbers, one holding the text `'-5'` is written as `'-5`. Text that only looks like a formula
     * gets the `'` too: a phone number `+47 912 34 567` is written `'+47 912 34 567`.
     *
     * The `'` is part of the text in the file, a program that reads it gets it too. OWASP notes that
     * the escaping is not reliable in Excel once the file is saved and opened again, so treat a file
     * of data users typed with care anyway.
     *
     * `false` writes the text as it is: for a file that is read by a program, not opened in a
     * spreadsheet.
     */
    escapeFormulas?: boolean;
}

/**
 * The first character of a UTF-8 file with a byte order mark: U+FEFF, the bytes EF BB BF
 */
export const CSV_BOM = '﻿';

/**
 * The line end of RFC 4180
 */
const CRLF = '\r\n';

/**
 * What a spreadsheet takes as the start of a formula (OWASP, CSV injection): = + - @, tab, CR, LF, and
 * the full width = + - @ (U+FF1D, U+FF0B, U+FF0D, U+FF20)
 */
const FORMULA_START = ['=', '+', '-', '@', '\t', '\r', '\n', '＝', '＋', '－', '＠'];

/**
 * A text with a `'` in front when a spreadsheet would take it as a formula: it starts with
 * `=`, `+`, `-`, `@`, a tab, CR or LF, or a full width `＝ ＋ － ＠`. Other text is returned as it is.
 *
 * @example
 * escapeFormula('=1+1'); // "'=1+1"
 * escapeFormula('Ann'); // 'Ann'
 */
export function escapeFormula(text: string): string {
    return FORMULA_START.some((start) => text.startsWith(start)) ? `'${text}` : text;
}

/**
 * A value as it is stored, as text: `''` for null, undefined, `''` and an invalid Date, a `Date` as
 * `toISOString()` (UTC), anything else with `String()` - a number with a dot, `true` / `false`.
 *
 * @example
 * rawValueText(12.5); // '12.5'
 * rawValueText(new Date(Date.UTC(2026, 10, 20))); // '2026-11-20T00:00:00.000Z'
 * rawValueText(null); // ''
 */
export function rawValueText(value: unknown): string {
    if (value === null || value === undefined) {
        return '';
    }
    if (value instanceof Date) {
        // toISOString() throws a RangeError for an invalid Date
        return Number.isNaN(value.getTime()) ? '' : value.toISOString();
    }
    return String(value);
}

/**
 * One field of a record: in double quotes when it holds the separator, a double quote, CR or LF,
 * with every double quote doubled (RFC 4180, rules 6 and 7). Else as it is, spaces included.
 */
export function csvField(text: string, separator: CsvSeparator): string {
    const quote = text.includes(separator) || text.includes('"') || text.includes('\r') || text.includes('\n');
    return quote ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * The CSV text: the header line (when given), then a line per row, every line ended with CRLF. The
 * fields are quoted where they need it, see {@link csvField}. The texts are written as they are given:
 * formatting and formula escaping are done before.
 *
 * A record of one empty field is written as `""`: an empty line is read as no fields at all by many
 * programs. A record of no fields has no line, so no fields at all give an empty text (the BOM only).
 *
 * @param header the labels, a field each; `null` for no header line
 * @param rows the rows, a text for each field
 * @param options.separator between the fields
 * @param options.bom a UTF-8 byte order mark first
 *
 * @example
 * buildCsv(['Name', 'City'], [['Ann', 'Oslo, Norway']], { separator: ',', bom: false });
 * // 'Name,City\r\nAnn,"Oslo, Norway"\r\n'
 */
export function buildCsv(header: string[] | null, rows: string[][], options: { separator: CsvSeparator; bom: boolean }): string {
    const records = (header ? [header, ...rows] : rows).filter((record) => record.length > 0);
    const lines = records.map((record) => {
        if (record.length === 1 && record[0] === '') {
            return '""';
        }
        return record.map((text) => csvField(text, options.separator)).join(options.separator);
    });
    const text = lines.map((line) => line + CRLF).join('');
    return options.bom ? CSV_BOM + text : text;
}

/**
 * Tab separated text as a block of cells: what Excel and Google Sheets put on the clipboard for a range
 * of cells, and what the grid puts there itself (buildCsv() with `'\t'`).
 *
 * - a line per row, ended by CRLF, LF or CR; one line end at the very end is not a row (Excel ends
 *   what it copies with one)
 * - a tab between the cells
 * - a cell that starts with a double quote is quoted: it goes on to the next quote that is not doubled,
 *   and can hold tabs and line breaks. `""` in it is one `"`. What comes after the closing quote, up to
 *   the next tab or line end, is added to the cell as it is
 * - a quote in a cell that does not start with one is a character like the others
 *
 * Rows can have different numbers of cells, the text says how many each has.
 *
 * @returns the rows, a text for each cell. `[]` for empty text, and for a line end only
 *
 * @example
 * parseTsv('a\tb\r\nc\td\r\n'); // [['a', 'b'], ['c', 'd']]
 * parseTsv('"two\nlines"\t"say ""hi"""'); // [['two\nlines', 'say "hi"']]
 */
export function parseTsv(text: string): string[][] {
    return parseFields(text, '\t', null);
}

/**
 * CSV text as rows of fields, RFC 4180 as Excel, Google Sheets and the grid write it - the import reads
 * a .csv file with it (importFile.ts). parseTsv() with another separator, and:
 *
 * - a UTF-8 byte order mark first (U+FEFF, what downloadCsv() and Excel write) is left out
 * - a field in double quotes can hold the separator, line breaks (CRLF, LF and CR are kept as they are)
 *   and `""` for a `"`; a quote in a field that does not start with one is a character like the others
 * - spaces are part of a field, kept as they are; every field is text - `=1+1` is the text `=1+1`
 * - one line end at the very end is not a row, an empty line is a row of one empty field
 *
 * The text of a file a user picked can be anything: the rows, the fields of a row and the fields in all
 * are counted while reading, and it stops at the limits (IMPORT_LIMITS) - a file of a million empty
 * lines is not turned into a million rows first.
 *
 * @param separator between the fields, see {@link detectSeparator}
 * @param limits the most rows, columns and fields (`cells`) it reads, IMPORT_LIMITS by default
 * @throws an `ImportFileError` (`'tooLarge'`) past a limit
 *
 * @example
 * parseCsv('name;age\r\n"Ann; Oslo";36\r\n', ';'); // [['name', 'age'], ['Ann; Oslo', '36']]
 */
export function parseCsv(
    text: string,
    separator: CsvSeparator,
    limits: Pick<ImportLimits, 'rows' | 'columns' | 'cells'> = IMPORT_LIMITS
): string[][] {
    return parseFields(text.startsWith(CSV_BOM) ? text.slice(1) : text, separator, limits);
}

/**
 * The separator of CSV text: the one of `,` `;` and tab that splits the first lines (up to 64 KB) into
 * the same number of fields, more than one. The candidate that does it for the most lines wins, then the
 * one with the most fields - a `;` file with decimal commas (`Ann;12,5`) has as many fields on every line
 * with `;`, a different number with `,`. A tie goes to tab, then `;`. `','` when none splits a line: a
 * file of one column.
 *
 * @example
 * detectSeparator('name;age\nAnn;12,5\n'); // ';'
 * detectSeparator('name,age\nAnn,36\n'); // ','
 */
export function detectSeparator(text: string): CsvSeparator {
    // the first 64 KB, without the line that may be cut off at the end
    const sample = text.length > 65_536 ? text.slice(0, text.lastIndexOf('\n', 65_536) + 1 || 65_536) : text;
    let best: { separator: CsvSeparator; lines: number; fields: number } = { separator: ',', lines: 0, fields: 1 };
    for (const separator of ['\t', ';', ','] as const) {
        const rows = parseFields(sample.startsWith(CSV_BOM) ? sample.slice(1) : sample, separator, null).slice(0, 50);
        const fields = rows[0]?.length ?? 0;
        if (fields < 2) {
            continue;
        }
        const lines = rows.filter((row) => row.length === fields).length;
        if (lines > best.lines || (lines === best.lines && fields > best.fields)) {
            best = { separator, lines, fields };
        }
    }
    return best.separator;
}

/**
 * The reader of parseTsv() and parseCsv(): see parseTsv for the rules. Fast on large text: the runs of
 * plain characters are sliced out, not added one by one
 * @param limits stops at them, null for none (the clipboard)
 */
function parseFields(
    text: string,
    separator: string,
    limits: Pick<ImportLimits, 'rows' | 'columns' | 'cells'> | null
): string[][] {
    // without the line end at the end
    let end = text.length;
    if (text.endsWith('\r\n')) {
        end = end - 2;
    } else if (text.endsWith('\n') || text.endsWith('\r')) {
        end = end - 1;
    }
    if (end <= 0) {
        return [];
    }

    const separatorCode = separator.charCodeAt(0);
    const tooLarge = (what: string) => {
        throw new ImportFileError('tooLarge', `The text has more than ${what}`);
    };
    const rows: string[][] = [];
    let row: string[] = [];
    let cells = 0;
    let i = 0;
    while (true) {
        let cell = '';
        if (text[i] === '"') {
            i++;
            while (i < end) {
                const quote = text.indexOf('"', i);
                if (quote === -1 || quote >= end) {
                    cell = cell + text.slice(i, end);
                    i = end;
                    break;
                }
                cell = cell + text.slice(i, quote);
                if (text[quote + 1] === '"') {
                    cell = `${cell}"`;
                    i = quote + 2;
                    continue;
                }
                i = quote + 1;
                break;
            }
        }
        // up to the separator or a line end
        let stop = i;
        while (stop < end) {
            const code = text.charCodeAt(stop);
            if (code === separatorCode || code === 13 || code === 10) {
                break;
            }
            stop++;
        }
        if (stop > i) {
            cell = cell + text.slice(i, stop);
            i = stop;
        }
        row.push(cell);
        cells++;
        if (limits && (cells > limits.cells || row.length > limits.columns)) {
            tooLarge(cells > limits.cells ? `${limits.cells} fields` : `${limits.columns} fields on a line`);
        }

        if (i >= end) {
            rows.push(row);
            return rows;
        }
        if (text.charCodeAt(i) === separatorCode) {
            i++;
            continue;
        }
        // a line end: CRLF, LF or CR
        i = i + (text[i] === '\r' && text[i + 1] === '\n' ? 2 : 1);
        rows.push(row);
        row = [];
        if (limits && rows.length >= limits.rows) {
            tooLarge(`${limits.rows} lines`);
        }
    }
}
