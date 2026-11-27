/**
 * The limits of a file the grid imports (readImportFile, the import dialog), and the error it gives for
 * a file it does not read. A file a user picks can be anything - a CSV of a million empty lines, a ZIP
 * of a few kilobytes that inflates to gigabytes (a "zip bomb"), XML that is not well-formed - so every
 * reader stops at these limits, before it holds more than they allow in memory.
 */

/**
 * The most a file the grid imports may hold. A file over a limit is not read: {@link readImportFile}
 * rejects with an {@link ImportFileError} of the problem `'tooLarge'`, the import dialog says so.
 *
 * | limit | |
 * | --- | --- |
 * | `fileSize` | 20 MB: the bytes of the file |
 * | `unzippedSize` | 100 MB: an .xlsx file is a ZIP, the parts read from it inflated - all of them together |
 * | `rows` | 100 000 rows of a sheet or a CSV file, a header row included |
 * | `columns` | 1 000 columns |
 * | `cells` | 1 000 000 cells: the CSV fields, the cells of the sheet that have a value |
 */
export const IMPORT_LIMITS = {
    /** the bytes of the file, 20 MB: checked before a byte is read */
    fileSize: 20 * 1024 * 1024,
    /** the parts of an .xlsx file read, inflated - all of them together, 100 MB */
    unzippedSize: 100 * 1024 * 1024,
    /** the rows of a sheet or a CSV file, a header row included */
    rows: 100_000,
    /** the columns of a sheet or a CSV file */
    columns: 1_000,
    /** the cells: the fields of a CSV file, the cells of a sheet that have a value */
    cells: 1_000_000
} as const;

/**
 * The limits a reader works with: {@link IMPORT_LIMITS}, or smaller ones in the tests
 */
export type ImportLimits = { -readonly [Key in keyof typeof IMPORT_LIMITS]: number };

/**
 * Why a file can not be imported, {@link ImportFileError}'s `problem`:
 *
 * - `'tooLarge'`: over one of the {@link IMPORT_LIMITS}
 * - `'xls'`: an Excel 97-2003 workbook (.xls, a binary format): save it as .xlsx or CSV
 * - `'broken'`: neither CSV nor an .xlsx workbook, or damaged: a ZIP that does not hold a workbook, a
 *   part that is not well-formed XML, a ZIP that is encrypted or uses ZIP64, data that does not inflate
 *   to its size and CRC
 * - `'unsupported'`: the browser can not inflate the parts of an .xlsx file - it has no
 *   `DecompressionStream('deflate-raw')` (Chrome 103, Firefox 113, Safari 16.4 have it). CSV works there
 */
export type ImportFileProblem = 'tooLarge' | 'xls' | 'broken' | 'unsupported';

/**
 * The error {@link readImportFile} rejects with when it does not read a file. `problem` says why, the
 * message says it in English with the detail (which limit, which part of the workbook).
 *
 * @example
 * ```ts
 * import { ImportFileError, readImportFile } from '@simple-html/grid';
 *
 * declare const file: File;
 *
 * try {
 *     const table = await readImportFile(file);
 *     gridInterface.importRows(table.rows, { header: true });
 * } catch (error) {
 *     if (error instanceof ImportFileError && error.problem === 'tooLarge') {
 *         alert('The file is too large');
 *     }
 * }
 * ```
 */
export class ImportFileError extends Error {
    /** why the file was not read */
    public readonly problem: ImportFileProblem;

    /**
     * @param problem why the file was not read
     * @param message what was wrong, in English
     */
    constructor(problem: ImportFileProblem, message: string) {
        super(message);
        this.name = 'ImportFileError';
        this.problem = problem;
    }
}
