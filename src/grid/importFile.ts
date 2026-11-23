import { CSV_SEPARATORS, type CsvSeparator, detectSeparator, parseCsv } from './csv';
import { IMPORT_LIMITS, ImportFileError, type ImportLimits } from './importLimits';
import { type ImportCell, readXlsx, type XlsxWorkbook } from './xlsxRead';

/**
 * A file for the import: a CSV file or an Excel workbook (.xlsx), read into rows of cells - no grid, no
 * datasource. The import dialog (gridFunctions/importDialog.ts) and {@link readImportFile} read files with
 * it, `gridInterface.importRows()` adds the rows to the grid.
 *
 * What a file is, is read from its first bytes, not its name: a ZIP (`PK`) is a workbook, the signature
 * of a compound file is an .xls workbook (Excel 97-2003, or an .xlsx file protected by a password) that is
 * not read, anything else is text - unless it has NUL characters, which no text has.
 */

/**
 * A file read by {@link readImportFile}: its rows, and what it was read as.
 */
export interface ImportTable {
    /** `'csv'` for text (`.csv`, `.tsv`, `.txt` ...), `'xlsx'` for an Excel workbook */
    format: 'csv' | 'xlsx';
    /** the names of the worksheets of a workbook, in the order of its tabs; `[]` for CSV */
    sheets: string[];
    /** the sheet read, an index into `sheets`; 0 for CSV */
    sheet: number;
    /** the separator of a CSV file: the one given, else the one found ({@link ReadImportFileOptions}); `null` for a workbook */
    separator: CsvSeparator | null;
    /**
     * The rows, a cell for each column - see {@link ImportCell}. A CSV file gives a text for every
     * field, `''` for an empty one. A workbook gives the cells typed (text, numbers, booleans, a `Date`
     * for a cell with a date format), `null` for an empty cell; its rows are the sheet's rows,
     * `rows[4]` is Excel's row 5 - a row with nothing in it is `[]`.
     */
    rows: ImportCell[][];
}

/**
 * How {@link readImportFile} reads a file. Every option is optional.
 */
export interface ReadImportFileOptions {
    /** the sheet of a workbook to read: its index (from 0) or its name. Default the first. Not used for CSV */
    sheet?: number | string;
    /** the separator of a CSV file: `','`, `';'` or `'\t'`. Default the one that splits the first lines evenly, see the import guide */
    separator?: CsvSeparator;
}

/**
 * A file opened for the import dialog: CSV text, or a workbook whose sheets are read when asked for
 */
export type ImportSource = { format: 'csv'; text: string } | { format: 'xlsx'; workbook: XlsxWorkbook };

// the signatures of the first bytes: a ZIP's local file header, a compound file (.xls)
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];
const COMPOUND_FILE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

/**
 * Reads a CSV file or an Excel workbook (.xlsx) into rows of cells, for `gridInterface.importRows()` or
 * code of your own. The same reader as the grid's import dialog, with the same limits ({@link IMPORT_LIMITS}).
 *
 * - **CSV**: UTF-8 (a byte order mark is left out), UTF-16 with its byte order mark, else Windows-1252 -
 *   what Excel saves as "CSV" in a Western language, æøå included. RFC 4180: fields in quotes can
 *   hold the separator, quotes and line breaks. The separator is found from the first lines, unless it
 *   is given. Every field is text, as it is written - `=1+1` is the text `=1+1`, never a formula
 * - **.xlsx**: the cells of one sheet, typed - text, numbers, booleans, a `Date` for a cell with a date
 *   format. A formula is never run: its value as Excel saved it is read. Needs the browser's
 *   `DecompressionStream('deflate-raw')`
 * - **.xls** (Excel 97-2003) is not read: save it as .xlsx or CSV
 *
 * @param file the file: from an `<input type="file">`, a drop, `fetch()` - any `Blob`
 * @param options which sheet, which separator, see {@link ReadImportFileOptions}
 * @throws (the promise rejects with) an {@link ImportFileError} for a file it does not read: over a limit,
 * an .xls file, a damaged or unknown file, a browser that can not inflate a workbook. A `RangeError` for a
 * sheet the workbook does not have
 *
 * @sample import
 * @example
 * ```ts
 * import { readImportFile } from '@simple-html/grid';
 *
 * const input = document.querySelector<HTMLInputElement>('#file')!;
 * input.onchange = async () => {
 *     const table = await readImportFile(input.files![0]);
 *     // the first row names the columns: matched to the fields by label or name
 *     gridInterface.importRows(table.rows, { header: true });
 * };
 * ```
 */
export async function readImportFile(file: Blob, options: ReadImportFileOptions = {}): Promise<ImportTable> {
    const { sheet = 0, separator } = options;
    if (separator !== undefined && !CSV_SEPARATORS.includes(separator)) {
        throw new TypeError(`readImportFile(): separator is ',', ';' or '\\t', not ${JSON.stringify(separator)}`);
    }
    const source = await openImportFile(file);
    if (source.format === 'csv') {
        return { format: 'csv', sheets: [], sheet: 0, ...readCsvText(source.text, separator) };
    }
    const sheets = source.workbook.sheets;
    const index = typeof sheet === 'string' ? sheets.indexOf(sheet) : sheet;
    if (!Number.isInteger(index) || index < 0 || index >= sheets.length) {
        throw new RangeError(
            `readImportFile(): the workbook has no sheet ${JSON.stringify(sheet)}, its sheets are ${JSON.stringify(sheets)}`
        );
    }
    return { format: 'xlsx', sheets, sheet: index, separator: null, rows: await source.workbook.readSheet(index) };
}

/**
 * @internal
 * Opens a file for the import: its text, or its workbook (the sheets are read when asked for)
 * @param limits the most it reads, IMPORT_LIMITS by default
 * @throws an `ImportFileError`, see readImportFile
 */
export async function openImportFile(file: Blob, limits: ImportLimits = IMPORT_LIMITS): Promise<ImportSource> {
    if (file.size > limits.fileSize) {
        throw new ImportFileError('tooLarge', `The file is ${file.size} bytes, more than ${limits.fileSize}`);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (startsWith(bytes, ZIP_SIGNATURE)) {
        return { format: 'xlsx', workbook: await readXlsx(bytes, limits) };
    }
    if (startsWith(bytes, COMPOUND_FILE_SIGNATURE)) {
        throw new ImportFileError('xls', 'An Excel 97-2003 workbook (.xls), or one protected by a password, is not read');
    }
    return { format: 'csv', text: decodeText(bytes) };
}

/**
 * @internal
 * CSV text as rows: with the separator given, else the one detectSeparator() finds
 * @throws an `ImportFileError` (`'tooLarge'`) past the limits
 */
export function readCsvText(
    text: string,
    separator?: CsvSeparator,
    limits: ImportLimits = IMPORT_LIMITS
): { separator: CsvSeparator; rows: ImportCell[][] } {
    const used = separator ?? detectSeparator(text);
    return { separator: used, rows: parseCsv(text, used, limits) };
}

/** true when the bytes start with these */
function startsWith(bytes: Uint8Array, signature: number[]): boolean {
    return signature.every((byte, i) => bytes[i] === byte);
}

/**
 * The bytes of a text file as text: UTF-8 or UTF-16 by its byte order mark, else UTF-8 when the bytes are
 * UTF-8, else Windows-1252 (Excel's "CSV" in a Western language). The byte order mark is left out
 * @throws an `ImportFileError` (`'broken'`) for bytes with a NUL: no text has one, a binary file does
 */
function decodeText(bytes: Uint8Array): string {
    if (startsWith(bytes, [0xef, 0xbb, 0xbf])) {
        return withoutNul(new TextDecoder('utf-8').decode(bytes.subarray(3)));
    }
    if (startsWith(bytes, [0xff, 0xfe])) {
        return withoutNul(new TextDecoder('utf-16le').decode(bytes.subarray(2)));
    }
    if (startsWith(bytes, [0xfe, 0xff])) {
        return withoutNul(new TextDecoder('utf-16be').decode(bytes.subarray(2)));
    }
    try {
        return withoutNul(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch (error) {
        if (error instanceof ImportFileError) {
            throw error;
        }
        return withoutNul(new TextDecoder('windows-1252').decode(bytes));
    }
}

/**
 * the text, when it has no NUL character
 * @throws an `ImportFileError` (`'broken'`) when it has one
 */
function withoutNul(text: string): string {
    if (text.includes('\0')) {
        throw new ImportFileError('broken', 'The file is not text (it has NUL characters), nor an .xlsx workbook');
    }
    return text;
}
