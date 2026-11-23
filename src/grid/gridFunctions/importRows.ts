import type { EntityUnion } from '../../datasource/dataSource';
import { formatDate } from '../../datasource/dateFormatterParts';
import type { FieldType } from '../../datasource/field';
import type { Formatter } from '../../datasource/formatter';
import { getText, type TextId } from '../../texts';
import { readonlyOf } from '../columnFormat';
import type { GridInterface } from '../gridInterface';
import type { ImportCell } from '../xlsxRead';
import { getCellType } from './getCellType';
import { getColumnLabel } from './getColumnLabel';
import { getLayoutFields } from './getLayoutFields';
import { writeCellValue } from './lookupColumn';

/**
 * The grid's side of the import: rows of cells - from a file (importFile.ts), from the clipboard, from
 * code - become new rows of the datasource. The import dialog (importDialog.ts) and
 * `gridInterface.importRows()` use it. Reads the interface and the datasource only, so it works without
 * a connected grid too. See guides/23-import.md.
 *
 * - **Columns to fields**: each column of the rows goes to a field, or is skipped (`ImportOptions.fields`).
 *   With a header row they are matched by name (headerFields): a header cell that is the label of a
 *   column or the name or label of a field, in any case; else by position (positionFields), from a field
 *   of the layout on. Only the fields a user could type into a new row: no readonly column
 * - **The values**, read as a user types them (readCell): through the field's formatter - a lookup
 *   column's label as the value of its row - with what a file has that typing has not: numbers with
 *   thousands separators and a decimal mark of the file (`decimalMark`), dates as ISO, `31.12.2026` and
 *   with `/` (`dateOrder`), typed cells of a workbook. A text that is not a value of the field's type
 *   is a problem, its cell is left empty - never a value guessed from part of it
 * - **The validation** runs on each row before it is added (DataContainer.__checkRow), with the rules of
 *   the fields: its messages are problems too
 * - **The rows** are added as new rows, at once (`datasource.addNewRows()`), validated - the grid shows
 *   the errors on the cells - and one step of the undo history: undo takes them out again (marks them for
 *   deletion, as Delete does a new row), redo brings them back. A row with values that could not be read
 *   gets them as its row error (`__rowError`): its row number shows them. Rows with problems can be
 *   skipped instead (`invalidRows: 'skip'`). A row with nothing in it is left out
 */

/**
 * How `gridInterface.importRows()` reads the rows. Every option is optional.
 *
 * | option | default | |
 * | --- | --- | --- |
 * | `header` | `false` | the first row that is not empty names the columns, it is not imported |
 * | `fields` | by the header's names, or by position | the field of each column, `null` skips it |
 * | `decimalMark` | each number column's own | how numbers in text are written: `'.'` 1,234.5 or `','` 1 234,5 |
 * | `dateOrder` | `'DMY'` | how a date with `/` is written: `'DMY'` 31/12/2026, `'MDY'` 12/31/2026 |
 * | `invalidRows` | `'import'` | `'skip'` leaves out the rows with problems |
 *
 * @example
 * ```ts
 * import type { ImportOptions } from '@simple-html/grid';
 *
 * // the first row names the columns; a column named Notes is skipped, there is no such field
 * const byName: ImportOptions = { header: true };
 *
 * // no header: the first column is the name, the third the age, the second is skipped
 * const byPosition: ImportOptions = { fields: ['name', null, 'age'], decimalMark: ',', invalidRows: 'skip' };
 * ```
 */
export interface ImportOptions {
    /**
     * `true`: the first row that is not empty is a header - its cells name the columns, it is not
     * imported. Without `fields` each column goes to the field it names: the label of a column of the
     * grid, or the name or the label of a field of the datasource, in any case, spaces around it
     * ignored. A name that is none of them is skipped, and so is a second column with the name of the
     * same field. Default `false`: every row is data.
     */
    header?: boolean;

    /**
     * The field of each column, by position: `['name', null, 'age']` - `null` (or a field that can not
     * be imported, below) skips the column. Default: with `header`, the fields the header names; without,
     * the fields of the layout from the first one on, as a paste of a block of cells.
     *
     * A field can be imported when a user could type into it on a new row: any field of the datasource
     * but a column that is readonly (`ColumnConfig.readonly`, the user's `format.readonly`). The
     * `isReadonly` hook is not asked: it decides about the rows that are there.
     */
    fields?: (string | null)[];

    /**
     * How a number written as text has its decimals: `'.'` (`1234.5`, `1,234.5`) or `','` (`1234,5`,
     * `1 234,5`, `1.234,5`). Spaces and `'` between the digits are left out, and so is the other mark,
     * between groups of three digits. Default each number field's own: `','` when its formatter writes
     * 1.5 as `1,5` (`numberComma`), else `'.'`. A number cell of a workbook is a number already.
     */
    decimalMark?: '.' | ',';

    /**
     * How a date written with `/` is ordered: `'DMY'` (31/12/2026, default) or `'MDY'` (12/31/2026, the
     * US). `2026-12-31` and `31.12.2026` are always read, with a time `13:45` or `13:45:12` after them; a
     * date in any other form is read by the field's formatter. A date cell of a workbook is a date already.
     */
    dateOrder?: 'DMY' | 'MDY';

    /**
     * The rows with problems - a value that is not of its field's type, a validation rule a value breaks:
     * `'import'` (default) adds them - a value that could not be read is left empty and listed in the
     * row's error, the validation errors show on the cells - or `'skip'`, which leaves them out.
     */
    invalidRows?: 'import' | 'skip';
}

/**
 * A problem of a cell of the rows given to `gridInterface.importRows()`: a value that is not of its
 * field's type, or a validation rule the value breaks.
 */
export interface ImportProblem {
    /** the row, an index into the rows given: `rows[row]`. For a sheet, Excel's row number is `row + 1` */
    row: number;
    /** the field the cell went to */
    field: string;
    /** the cell as it was given */
    value: ImportCell;
    /**
     * `'value'`: the cell is not a value of the field's type - the new row has the field empty.
     * `'rule'`: the value breaks a validation rule of the field (`FieldConfig.validate`)
     */
    kind: 'value' | 'rule';
    /** what is wrong, in the grid's texts: `Not a number: abc`, a validation message */
    message: string;
}

/**
 * What `gridInterface.importRows()` did.
 */
export interface ImportResult<T> {
    /** the new rows, in the order of the rows given */
    rows: EntityUnion<T>[];
    /** every problem found, of the rows added and of the rows skipped, in the order of the rows */
    problems: ImportProblem[];
    /** how many rows with problems were left out, with `invalidRows: 'skip'` */
    skipped: number;
}

/**
 * A row of the rows given, read: the values of the new row, and its problems
 */
export interface ImportRow {
    /** the index of the row in the rows given */
    index: number;
    /** the values by field, as the new row gets them */
    values: Record<string, unknown>;
    /** what could not be read, and the rules broken */
    problems: ImportProblem[];
}

/**
 * The rows given, read - what the dialog shows before the import, and what importRows() adds
 */
export interface ImportPlan {
    /** the index of the header row, -1 for none */
    header: number;
    /** the field of each column, null skips it */
    fields: (string | null)[];
    /** the data rows that are not empty, read */
    rows: ImportRow[];
}

/** what each option of ImportOptions takes, for the check of an options object from plain JavaScript */
const OPTION_CHECKS: Record<keyof ImportOptions, { valid: (value: unknown) => boolean; takes: string }> = {
    header: { valid: (value) => typeof value === 'boolean', takes: 'true or false' },
    fields: {
        valid: (value) => Array.isArray(value) && value.every((field) => field === null || typeof field === 'string'),
        takes: 'an array of fields, null for a column to skip'
    },
    decimalMark: { valid: (value) => value === '.' || value === ',', takes: "'.' or ','" },
    dateOrder: { valid: (value) => value === 'DMY' || value === 'MDY', takes: "'DMY' or 'MDY'" },
    invalidRows: { valid: (value) => value === 'import' || value === 'skip', takes: "'import' or 'skip'" }
};

/**
 * Checks the options of `gridInterface.importRows()`: TypeScript catches a wrong one, plain JavaScript
 * and JSON do not - a misspelt option would be ignored without a word. Left out or undefined is the default
 * @throws a `TypeError` naming the option and what it takes
 */
export function assertImportOptions(options: unknown) {
    if (options === null || typeof options !== 'object' || Array.isArray(options)) {
        throw new TypeError(`importRows(): options is an object, not ${JSON.stringify(options)}`);
    }
    for (const [key, value] of Object.entries(options)) {
        const check = OPTION_CHECKS[key as keyof ImportOptions];
        if (!check) {
            throw new TypeError(`importRows(): '${key}' is not an option, they are ${Object.keys(OPTION_CHECKS).join(', ')}`);
        }
        if (value !== undefined && !check.valid(value)) {
            throw new TypeError(`importRows(): ${key} takes ${check.takes}, not ${JSON.stringify(value)}`);
        }
    }
}

/**
 * A blank cell: nothing in it, or text of spaces only
 */
export function isBlankCell(cell: ImportCell | undefined): boolean {
    return cell === null || cell === undefined || (typeof cell === 'string' && cell.trim() === '');
}

/**
 * The fields the import can write, in the order a picker lists them: the fields of the layout, then the
 * other columns of the config (hidden, or not in the layout) - not a readonly column (ImportOptions.fields)
 */
export function importFields(gridInterface: GridInterface<any>): string[] {
    const columns = gridInterface.__getGridConfig().columns;
    const fields = [...new Set([...getLayoutFields(gridInterface), ...Object.keys(columns)])];
    return fields.filter((field) => !readonlyOf(columns[field]));
}

/**
 * name as it is compared: trimmed, the spaces in it as one, in lower case
 */
function nameKey(text: string): string {
    return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * The fields a header row names, a field for each of its cells (ImportOptions.header): the label of a
 * column as the grid shows it, the field's name or the datasource field's label - in any case, spaces
 * around ignored. A field once: a second cell with its name is skipped, and so is a name that is none.
 * `null` when no cell names a field - then it is no header
 */
export function headerFields(gridInterface: GridInterface<any>, header: ImportCell[]): (string | null)[] | null {
    const byName = new Map<string, string>();
    // the label the grid shows wins over a name: added last
    for (const field of importFields(gridInterface).reverse()) {
        byName.set(nameKey(field), field);
        byName.set(nameKey(gridInterface.getDatasource().getField(field).label), field);
        byName.set(nameKey(getColumnLabel({ gridInterface }, field)), field);
    }
    const used = new Set<string>();
    const fields = header.map((cell) => {
        const field = isBlankCell(cell) ? undefined : byName.get(nameKey(cellText(cell)));
        if (!field || used.has(field)) {
            return null;
        }
        used.add(field);
        return field;
    });
    return used.size ? fields : null;
}

/**
 * The fields by position (ImportOptions.fields): the columns go to the fields of the layout from `start`
 * on, left to right - as a paste puts a block of cells. A column on a readonly field, or past the last
 * field, is skipped
 * @param width the number of columns
 * @param start the field of the first column, default the first of the layout
 */
export function positionFields(gridInterface: GridInterface<any>, width: number, start?: string): (string | null)[] {
    const layout = getLayoutFields(gridInterface);
    const importable = new Set(importFields(gridInterface));
    const from = Math.max(0, start === undefined ? 0 : layout.indexOf(start));
    return Array.from({ length: width }, (_, i) => {
        const field = layout[from + i];
        return field !== undefined && importable.has(field) ? field : null;
    });
}

/**
 * The rows given, read and checked, without adding them: the header (ImportOptions.header), the fields of
 * the columns, and each data row that is not empty with its values and problems - see the top of the file
 * @param start the field the columns start at without a header and without `fields`
 */
export function planImport(
    gridInterface: GridInterface<any>,
    rows: ImportCell[][],
    options: ImportOptions,
    start?: string
): ImportPlan {
    const first = rows.findIndex((row) => !row.every(isBlankCell));
    const header = options.header && first !== -1 ? first : -1;
    const width = Math.max(0, ...rows.map((row) => row.length));
    const importable = new Set(importFields(gridInterface));
    const given =
        options.fields ??
        (header !== -1 ? headerFields(gridInterface, rows[header]) : null) ??
        positionFields(gridInterface, width, start);
    // a field that can not be imported, or the same field again, skips the column
    const used = new Set<string>();
    const fields = given.map((field) => {
        if (typeof field !== 'string' || !importable.has(field) || used.has(field)) {
            return null;
        }
        used.add(field);
        return field;
    });

    const container = gridInterface.getDatasource().getDataContainer();
    const read: ImportRow[] = [];
    rows.forEach((cells, index) => {
        if (index <= header || cells.every(isBlankCell)) {
            return;
        }
        const values: Record<string, unknown> = {};
        const problems: ImportProblem[] = [];
        fields.forEach((field, column) => {
            if (field === null) {
                return;
            }
            const cell = cells[column] ?? null;
            const { value, problem } = readCell(gridInterface, field, cell, values, options);
            // a lookup column with `set` fills its other fields too, as the user picking it
            writeCellValue(gridInterface, values as never, field, value);
            if (problem) {
                problems.push({ row: index, field, value: cell, kind: 'value', message: problem });
            }
        });
        // the rules of every field, also of a field the file does not have (a required one)
        for (const [field, messages] of container.__checkRow(values)) {
            for (const message of messages) {
                problems.push({ row: index, field, value: cells[fields.indexOf(field)] ?? null, kind: 'rule', message });
            }
        }
        read.push({ index, values, problems });
    });
    return { header, fields, rows: read };
}

/**
 * Adds the rows read as new rows, see the top of the file
 * @param plan what planImport() read
 * @param options.scrollTo the first new row selected, the grid scrolls to it - default true
 */
export function addImportedRows<T>(
    gridInterface: GridInterface<T>,
    plan: ImportPlan,
    options: ImportOptions & { scrollTo?: boolean }
): ImportResult<T> {
    const datasource = gridInterface.getDatasource();
    const container = datasource.getDataContainer();
    const keep = options.invalidRows === 'skip' ? plan.rows.filter((row) => !row.problems.length) : plan.rows;
    // what is typed in a cell is a step of its own, the import one of its own
    container.__history.endTyping();
    const added = datasource.addNewRows(
        keep.map((row) => row.values as Partial<T>),
        { scrollTo: options.scrollTo ?? true }
    );
    container.__recordAdded(added);

    // the values that could not be read, on the row number: their cells are empty. The broken rules show
    // on the cells
    added.forEach((row, i) => {
        const unread = keep[i].problems.filter((problem) => problem.kind === 'value');
        if (unread.length) {
            const lines = unread.map((problem) => `${getColumnLabel({ gridInterface }, problem.field)}: ${problem.message}`);
            row.__rowError = text(gridInterface, 'import.rowError', { problems: lines.join(', ') });
        }
    });
    // the errors on the cells, as an edit shows them
    datasource.validate(added);
    return { rows: added, problems: plan.rows.flatMap((row) => row.problems), skipped: plan.rows.length - keep.length };
}

/**
 * Imports the rows: planImport(), then addImportedRows() - `gridInterface.importRows()`
 */
export function importRows<T>(
    gridInterface: GridInterface<T>,
    rows: ImportCell[][],
    options: ImportOptions = {}
): ImportResult<T> {
    return addImportedRows(gridInterface, planImport(gridInterface, rows, options), options);
}

/** a text of the grid, without a connected grid (gridText needs one) */
function text(gridInterface: GridInterface<any>, id: TextId, values?: Readonly<Record<string, unknown>>): string {
    return getText(id, gridInterface.__getGridConfig().texts, values);
}

/**
 * A cell as text, for a text field or a field's formatter: a number with `String()`, a boolean as
 * `true` / `false`, a date as `2026-11-20` - with its time `T13:45:00` when it has one
 */
export function cellText(cell: ImportCell): string {
    if (cell === null) {
        return '';
    }
    if (cell instanceof Date) {
        const midnight = cell.getHours() === 0 && cell.getMinutes() === 0 && cell.getSeconds() === 0;
        return formatDate(cell, 'YMD', !midnight);
    }
    return String(cell);
}

/**
 * Reads the value of a cell for a field: see the top of the file
 * @param row the values of the new row so far: a column whose type another column gives
 * (dynamicCellTypeColumn) reads it
 * @returns the value, and the problem when the cell has no value of the field's type - the value is
 * null then
 */
export function readCell(
    gridInterface: GridInterface<any>,
    field: string,
    cell: ImportCell,
    row: Record<string, unknown>,
    options: ImportOptions
): { value: unknown; problem: string | null } {
    if (isBlankCell(cell)) {
        return { value: null, problem: null };
    }
    const type: FieldType = getCellType({ gridInterface }, field, row as never);
    const lookup = gridInterface.__getLookupColumn(field);
    const formatter = lookup?.formatter ?? gridInterface.getDatasource().getFormatter(field, type);
    const problem = (id: TextId) => ({ value: null, problem: text(gridInterface, id, { text: cellText(cell) }) });

    // a lookup column takes the label the cells show, as a paste
    if (lookup || type === 'text') {
        return { value: formatter.parse(cellText(cell)), problem: null };
    }
    if (type === 'number') {
        const value = readNumber(cell, formatter, options.decimalMark ?? decimalMarkOf(formatter));
        return value === null ? problem('import.problem.number') : { value, problem: null };
    }
    if (type === 'boolean') {
        const value = readBoolean(cell, formatter);
        return value === null ? problem('import.problem.boolean') : { value, problem: null };
    }
    const value = readDate(cell, formatter, options.dateOrder ?? 'DMY');
    return value === null ? problem('import.problem.date') : { value, problem: null };
}

/**
 * The decimal mark of a number field's formatter: `','` when it writes 1.5 with a comma
 */
export function decimalMarkOf(formatter: Formatter): '.' | ',' {
    return formatter.format(1.5).includes(',') ? ',' : '.';
}

/** a number as JavaScript reads it, after the separators are taken out */
const PLAIN_NUMBER = /^[+-]?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i;

/**
 * A number from a cell: a number cell as it is; text without its spaces and `'` (thousands separators),
 * the other mark than `decimalMark` only between groups of three digits - once and not between groups
 * (`12,5` with a decimal dot) it is the decimal mark, as typing reads it - then through the formatter.
 * null for what is no number - `12 kg`, `1.2.3`, `=1+1`
 */
export function readNumber(cell: ImportCell, formatter: Formatter, decimalMark: '.' | ','): number | null {
    if (typeof cell === 'number') {
        return Number.isFinite(cell) ? cell : null;
    }
    if (typeof cell !== 'string') {
        return null;
    }
    let plain = cell.trim().replace(/[\s   '’]/g, '');
    let mark: string = decimalMark;
    let thousands: string = decimalMark === ',' ? '.' : ',';
    // the other mark once, not between groups of three digits (12,5 with a decimal dot): the decimal mark
    // of the text - as typing reads it
    const groups = (separator: string) => new RegExp(`^[+-]?\\d{1,3}(\\${separator}\\d{3})+$`);
    if (!plain.includes(mark) && plain.split(thousands).length === 2 && !groups(thousands).test(plain)) {
        [mark, thousands] = [thousands, mark];
    }
    const [whole, ...decimals] = plain.split(mark);
    // 1.234.567,5: the thousands separator between groups of three digits only
    if (decimals.length > 1 || (whole.includes(thousands) && !groups(thousands).test(whole))) {
        return null;
    }
    plain = whole.replaceAll(thousands, '') + (decimals.length ? `.${decimals[0]}` : '');
    if (!PLAIN_NUMBER.test(plain)) {
        return null;
    }
    const value = formatter.parse(plain);
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * A boolean from a cell: a boolean as it is, 1 and 0, the text `true` / `false` / `1` / `0` or what the
 * formatter writes for true and false (`yes` / `no`) - in any case. null for anything else
 */
export function readBoolean(cell: ImportCell, formatter: Formatter): boolean | null {
    if (typeof cell === 'boolean') {
        return cell;
    }
    if (typeof cell === 'number') {
        return cell === 1 ? true : cell === 0 ? false : null;
    }
    if (typeof cell !== 'string') {
        return null;
    }
    const value = cell.trim().toLowerCase();
    if (value === 'true' || value === '1' || value === formatter.format(true).toLowerCase()) {
        return true;
    }
    if (value === 'false' || value === '0' || value === formatter.format(false).toLowerCase()) {
        return false;
    }
    return null;
}

// the dates the import reads itself: ISO (an offset or Z makes it an instant), with dots (day first), with
// slashes (in the dateOrder) - each with a time of day after a space or a T
const ISO_DATE = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?(Z|[+-]\d{2}:?\d{2})?$/;
const DOT_DATE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const SLASH_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

/**
 * A date from a cell: a valid `Date` as it is; text as ISO `2026-12-31`, `31.12.2026` or with `/` in the
 * order given, with a time of day after it - local time, an ISO date with `Z` or an offset is that
 * instant; else as the formatter reads it, when it writes the date back as the text (so a part it does
 * not read is not taken as a day). null for what is no date - `31.02.2026` too
 */
export function readDate(cell: ImportCell, formatter: Formatter, dateOrder: 'DMY' | 'MDY'): Date | null {
    if (cell instanceof Date) {
        return Number.isNaN(cell.getTime()) ? null : cell;
    }
    if (typeof cell !== 'string') {
        return null;
    }
    const text = cell.trim();
    const iso = ISO_DATE.exec(text);
    if (iso?.[7]) {
        const instant = new Date(text);
        return Number.isNaN(instant.getTime()) ? null : instant;
    }
    const dots = DOT_DATE.exec(text);
    const slashes = SLASH_DATE.exec(text);
    let parts: (string | undefined)[] | null = null;
    if (iso) {
        parts = iso.slice(1, 7);
    } else if (dots) {
        parts = [dots[3], dots[2], dots[1], ...dots.slice(4, 7)];
    } else if (slashes) {
        const [day, month] = dateOrder === 'DMY' ? [slashes[1], slashes[2]] : [slashes[2], slashes[1]];
        parts = [slashes[3], month, day, ...slashes.slice(4, 7)];
    }
    if (parts) {
        const [year, month, day, hours, minutes, seconds] = parts.map((part) => Number(part ?? 0));
        const date = new Date(year, month - 1, day, hours, minutes, seconds);
        // no day past the end of the month, no 25 o'clock: the Date would move on, the text is wrong
        const exact =
            date.getFullYear() === year &&
            date.getMonth() === month - 1 &&
            date.getDate() === day &&
            date.getHours() === hours &&
            date.getMinutes() === minutes;
        return exact && seconds < 60 ? date : null;
    }
    const value = formatter.parse(text);
    return value instanceof Date && !Number.isNaN(value.getTime()) && formatter.format(value) === text ? value : null;
}
