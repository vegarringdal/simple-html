import { type ZipOptions, zip } from './zip';

/**
 * An Excel workbook (.xlsx) from plain inputs: no grid, no datasource, no DOM. The grid's
 * `getExcel()` and `downloadExcel()` pick the rows, the fields and the values (see
 * gridFunctions/gridExcel.ts) and build the file with this.
 *
 * The format is SpreadsheetML of ECMA-376 (Office Open XML, Transitional), what Excel writes: a ZIP
 * (zip.ts) of these parts.
 *
 * | part | |
 * | --- | --- |
 * | `[Content_Types].xml` | the content type of each part (Part 2, Open Packaging Conventions) |
 * | `_rels/.rels` | the package's relationship to the workbook |
 * | `xl/workbook.xml` | the sheet, and the `_xlnm._FilterDatabase` name of its autofilter |
 * | `xl/_rels/workbook.xml.rels` | the workbook's relationships to the sheet and the styles |
 * | `xl/worksheets/sheet1.xml` | the cells, column widths, the frozen header row, the autofilter |
 * | `xl/styles.xml` | the fonts and number formats the cells use |
 *
 * `docProps/` (title, author ...) is optional in a package and left out.
 *
 * One sheet: a header row with the labels, bold, frozen, with an autofilter over the header and
 * every row - then a plain row per row given. No outline, no group rows, no totals.
 *
 * The cells are typed, so Excel can sum, sort and filter them: a number is a number cell, a date an
 * Excel serial date with a date format, a boolean a boolean cell, text an inline string. Text is
 * never a formula in this format (a formula is an `<f>` element, which is never written), so a
 * value a user typed, `=HYPERLINK(...)`, is shown as the text it is.
 */

/**
 * What `gridInterface.getExcel()` and `gridInterface.downloadExcel()` export. Every option is
 * optional, and the object is plain JSON - it can be stored, or come from a menu of your own.
 *
 * | option | default | |
 * | --- | --- | --- |
 * | `rows` | `'all'` | `'all'`: every row the filter lets through, in the sort order. `'selected'`: the selected rows. `'range'`: the rows of the selected range of cells |
 * | `fields` | the layout (`'range'`: the range's) | the fields to export, in order |
 * | `sheetName` | `'Sheet1'` | the name of the sheet |
 *
 * The file always has the header row (the column labels, bold), frozen, with an autofilter over it
 * and every row, and is always a flat list: a row per data row, no group rows, no outline, no totals.
 *
 * An option with a value it does not know (`rows: 'some'`, `sheetName: 'a/b'`), or a key it does
 * not know (`header`: the header row is always there), throws a `TypeError`.
 *
 * @example
 * ```ts
 * import type { ExcelOptions } from '@simple-html/grid';
 *
 * // the selected rows, two fields, on a sheet named People
 * const options: ExcelOptions = { rows: 'selected', fields: ['name', 'born'], sheetName: 'People' };
 * await gridInterface.downloadExcel('people.xlsx', options);
 *
 * // the cells the user selected (the last range), with a header row of their columns
 * await gridInterface.downloadExcel('range.xlsx', { rows: 'range' });
 * ```
 */
export interface ExcelOptions {
    /**
     * Which rows, default `'all'` - the same rows as the CSV export:
     * - `'all'`: every row the filter lets through, in the sort order - `datasource.getDataRows()`.
     *   When grouped, every data row in the grouped order, the rows of collapsed groups included; no
     *   group rows
     * - `'selected'`: the selected rows, in the same order - `datasource.getSelectedRows()`. That is
     *   the selected rows that are displayed: a selected row in a collapsed group is left out, as the
     *   row menu's actions on the selected rows leave it out. Nothing selected gives the header row only
     * - `'range'`: the selected range of cells - the last of `gridInterface.getRanges()`, the one made
     *   last: its data rows top to bottom (a group row in it is left out) and, unless `fields` is
     *   given, its fields left to right. No range gives an empty sheet (no columns, no rows)
     */
    rows?: 'all' | 'selected' | 'range';

    /**
     * The fields to export, in this order, a column each. Default the fields of the layout now, in
     * the order the user sees them: pinned left, center, pinned right, and a column of stacked fields
     * gives an Excel column for each of its fields, top to bottom - `gridInterface.getLayoutFields()`.
     * The hidden columns (`getHiddenFields()`) are not in the layout, so they are left out. With
     * `rows: 'range'` the default is the fields of the range.
     *
     * Any field of the rows can be given, also one that is not in the grid: it gets Excel's default
     * width, a field of the layout the width of its column.
     */
    fields?: string[];

    /**
     * The name of the sheet, default `'Sheet1'`. Excel's rules: 1 to 31 characters, none of
     * `[ ] : * ? / \`, not starting or ending with `'`, not `History`. A name that breaks one
     * throws a `TypeError`.
     */
    sheetName?: string;
}

/**
 * The order Excel shows a date in: `'YMD'` 2026-11-20, `'DMY'` 20.11.2026.
 */
export type XlsxDateOrder = 'YMD' | 'DMY';

/**
 * A date cell: an Excel serial date (see {@link excelSerial}) with a date format.
 */
export interface XlsxDate {
    /** the date, its local year, month and day - and time of day with `time` - are written */
    date: Date;
    /** `true`: the date and the time of day, to the second (`2026-11-20 13:45:12`); `false` the date only */
    time: boolean;
    /** the order of the date's parts */
    order: XlsxDateOrder;
    /**
     * an Excel number format that replaces the one of `time` and `order`: `'dddd'`, `'yyyy-mm'` - for a
     * column's display format (ColumnConfig.format). A `.` and a `/` are escaped with a backslash:
     * unescaped, a `.` is the decimal mark and a `/` the date separator of the computer's language
     */
    format?: string;
}

/**
 * A number cell with an Excel number format: `{ number: 1234.5, format: '#,##0.00' }`. For a column's
 * display format (ColumnConfig.format). Excel shows the separators of the computer's language: `,` and
 * `.` in the format are the thousands separator and the decimal mark there.
 */
export interface XlsxNumber {
    /** the number, finite */
    number: number;
    /** the Excel number format code */
    format: string;
}

/**
 * The value of a cell:
 * - a number: a number cell, General format. Not a finite number (NaN, Infinity): written as text
 * - an {@link XlsxNumber}: a number cell with a number format
 * - a boolean: a boolean cell, TRUE / FALSE
 * - an {@link XlsxDate}: a date cell
 * - a string: text, with wrapped lines when it has a line break. `''` is no cell
 * - `null`: no cell
 */
export type XlsxCell = string | number | boolean | XlsxDate | XlsxNumber | null;

/**
 * A column of the sheet.
 */
export interface XlsxColumn {
    /** the text of the header row */
    label: string;
    /** the width in px, see {@link excelColumnWidth}. Left out: Excel's default width */
    width?: number;
}

/**
 * The sheet to write.
 */
export interface XlsxSheet {
    /** the sheet's name, see {@link assertSheetName} */
    name: string;
    /** the columns, left to right */
    columns: XlsxColumn[];
    /** the rows under the header row, a cell for each column */
    rows: XlsxCell[][];
}

/**
 * The MIME type of an .xlsx file
 */
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Excel's limits ("Excel specifications and limits"): rows and columns of a sheet, characters in a cell
const MAX_ROWS = 1_048_576;
const MAX_COLUMNS = 16_384;
const MAX_CELL_TEXT = 32_767;

// the namespaces of SpreadsheetML and of the package (ECMA-376 Transitional)
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_RELATIONSHIPS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PACKAGE_RELATIONSHIPS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const NS_CONTENT_TYPES = 'http://schemas.openxmlformats.org/package/2006/content-types';

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

/**
 * The .xlsx file of the sheet: the bytes of the ZIP.
 *
 * @param options how the ZIP is written, for the tests: `deflate: false` stores the parts
 * @throws a `TypeError` for a sheet name Excel does not take, a `RangeError` for more rows or
 * columns than a sheet holds, or a date Excel can not hold (see {@link excelSerial})
 *
 * @example
 * const bytes = await buildXlsx({
 *     name: 'People',
 *     columns: [{ label: 'Name', width: 120 }, { label: 'Born' }],
 *     rows: [['Ann', { date: new Date(2001, 4, 17), time: false, order: 'YMD' }]]
 * });
 * new Blob([bytes], { type: XLSX_MIME });
 */
export async function buildXlsx(sheet: XlsxSheet, options: ZipOptions = {}): Promise<Uint8Array<ArrayBuffer>> {
    const encoder = new TextEncoder();
    const parts = xlsxParts(sheet).map((part) => ({ name: part.name, data: encoder.encode(part.text) }));
    return zip(parts, options);
}

/**
 * The parts of the .xlsx file, the XML text of each, in the order they go into the ZIP.
 * @throws as {@link buildXlsx}
 */
export function xlsxParts(sheet: XlsxSheet): { name: string; text: string }[] {
    assertSheetName(sheet.name, 'buildXlsx()');
    if (sheet.columns.length > MAX_COLUMNS) {
        throw new RangeError(`An Excel sheet has at most ${MAX_COLUMNS} columns, got ${sheet.columns.length}`);
    }
    if (sheet.rows.length + 1 > MAX_ROWS) {
        throw new RangeError(`An Excel sheet has at most ${MAX_ROWS} rows, the header row and ${sheet.rows.length} rows is more`);
    }

    const styles = new Styles();
    const worksheet = worksheetXml(sheet, styles);
    // the autofilter's range, '' for a sheet without columns: there is nothing to filter
    const filterRange = sheet.columns.length ? `A1:${cellReference(sheet.columns.length - 1, sheet.rows.length + 1)}` : '';

    return [
        { name: '[Content_Types].xml', text: contentTypesXml() },
        { name: '_rels/.rels', text: packageRelsXml() },
        { name: 'xl/workbook.xml', text: workbookXml(sheet.name, filterRange) },
        { name: 'xl/_rels/workbook.xml.rels', text: workbookRelsXml() },
        { name: 'xl/worksheets/sheet1.xml', text: worksheet },
        { name: 'xl/styles.xml', text: styles.xml() }
    ];
}

/**
 * Checks a sheet name against Excel's rules: 1 to 31 characters (counted as UTF-16 code units, the
 * stricter count), none of `[ ] : * ? / \`, not starting or ending with `'`, not `History` (Excel
 * keeps that name for itself), and no character XML can not hold (control characters).
 *
 * @param where what the name was given to, for the message
 * @throws a `TypeError` that says which rule the name breaks
 */
export function assertSheetName(name: unknown, where: string): asserts name is string {
    const fail = (rule: string) => {
        throw new TypeError(`${where}: the sheet name ${rule}, got ${JSON.stringify(name)}`);
    };
    if (typeof name !== 'string' || name === '') {
        fail('is a text of 1 to 31 characters');
        return;
    }
    if (name.length > 31) {
        fail('is at most 31 characters');
    }
    if (/[[\]:*?/\\]/.test(name)) {
        fail('can not have any of [ ] : * ? / \\');
    }
    if (name.startsWith("'") || name.endsWith("'")) {
        fail("can not start or end with '");
    }
    if (name.toLowerCase() === 'history') {
        fail('can not be History, Excel keeps that name');
    }
    if (withoutInvalidXml(name) !== name) {
        fail('can not have control characters');
    }
}

/**
 * The Excel serial date of a date: the days since 1899-12-30, the time of day as the fraction of a
 * day. Excel's 1900 date system, the default of a workbook. The date's LOCAL year, month, day and time
 * are written - Excel has no time zones, a cell shows the date as it is written, so the user sees the
 * date the grid showed them, in any time zone. A day with a change to or from summer time is a day
 * like any other.
 *
 * - `time: false`: the day only, a whole number - the time of day is left out
 * - `time: true`: the time of day to the second, as the grid shows it: milliseconds are left out
 * - Excel counts a 29 February 1900 that never was (Lotus 1-2-3 did): from 1900-03-01 on the serial is
 *   the days since 1899-12-30, before it the days since 1899-12-31 (1900-01-01 is 1)
 * - `null` for a date Excel can not hold: before 1900-01-01, after 9999-12-31, or an invalid Date
 *
 * @example
 * excelSerial(new Date(2026, 10, 20, 18, 0), false); // 46346
 * excelSerial(new Date(2026, 10, 20, 18, 0), true); // 46346.75
 * excelSerial(new Date(1899, 11, 31), false); // null
 */
export function excelSerial(date: Date, time: boolean): number | null {
    const year = date.getFullYear();
    // checked first: Date.UTC() takes a year 0-99 as 1900-1999
    if (Number.isNaN(year) || year < 1900 || year > 9999) {
        return null;
    }
    let days = (Date.UTC(year, date.getMonth(), date.getDate()) - Date.UTC(1899, 11, 30)) / 86_400_000;
    // 1900-03-01 is day 61 in both counts; the days before it are one less in Excel's
    if (days < 61) {
        days -= 1;
    }
    if (!time) {
        return days;
    }
    return days + (date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds()) / 86_400;
}

/**
 * A width in px as the `width` of Excel's `<col>` element, ECMA-376 Part 1, 18.3.1.13: the pixels as
 * characters of the widest digit, `Truncate((px - 5) / 7 * 100 + 0.5) / 100`, then the characters as
 * the width, `Truncate((characters * 7 + 5) / 7 * 256) / 256`. 7 px is the widest digit of Calibri 11
 * (the font of the sheet) at 96 dpi, 5 px the cell's margins and grid line. Excel at 96 dpi shows the
 * column as wide as the px; on a screen of another scale it scales the column with the font.
 *
 * At least 0 and at most 255, Excel's widest column.
 *
 * @example
 * excelColumnWidth(61); // 8.7109375 - 8 characters, the example of the standard
 * excelColumnWidth(100); // 14.28125 - 13.57 characters
 */
export function excelColumnWidth(px: number): number {
    const digit = 7;
    const characters = Math.trunc(((px - 5) / digit) * 100 + 0.5) / 100;
    const width = Math.trunc(((characters * digit + 5) / digit) * 256) / 256;
    return Math.min(Math.max(width, 0), 255);
}

/**
 * The name of a column: `A` for 0, `Z` for 25, `AA` for 26, `AAA` for 702 (column 703).
 * @param index from 0
 */
export function columnName(index: number): string {
    let name = '';
    for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
        name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
    }
    return name;
}

/**
 * The reference of a cell: `A1` for column 0, row 1.
 * @param column from 0
 * @param row from 1, as Excel numbers the rows
 */
export function cellReference(column: number, row: number): string {
    return `${columnName(column)}${row}`;
}

/**
 * Text as XML text, for an element or an attribute in double quotes: `& < > "` as entities.
 */
export function xmlEscape(text: string): string {
    return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

/**
 * every character XML 1.0 can not hold (2.2 Characters: Char is tab, LF, CR, U+0020-U+D7FF,
 * U+E000-U+FFFD and U+10000-U+10FFFF): the control characters, U+FFFE, U+FFFF and a lone surrogate
 */
const INVALID_XML = /[^\t\n\r -퟿-�\u{10000}-\u{10FFFF}]/gu;

/**
 * The text without the characters XML 1.0 can not hold (control characters ...)
 */
export function withoutInvalidXml(text: string): string {
    return text.replace(INVALID_XML, '');
}

/**
 * The text of a cell as it goes into the file, and whether its lines are wrapped:
 * - CR LF and a lone CR are LF, the line break of a cell (an XML reader makes them LF anyway,
 *   XML 1.0 2.11)
 * - the characters XML can not hold are left out
 * - cut after 32 767 characters, what a cell holds
 * - `_x` followed by 4 hex digits and `_` would be read as a character (`_x0041_` is `A`, the
 *   escape of the type ST_Xstring, ECMA-376 Part 1, 22.9.2.19): its `_` is written as `_x005F_`,
 *   the escape of `_`, so the text is read back as it is
 * - XML escaped
 */
export function cellText(text: string): { xml: string; wrap: boolean } {
    let clean = withoutInvalidXml(text.replaceAll('\r\n', '\n').replaceAll('\r', '\n'));
    if (clean.length > MAX_CELL_TEXT) {
        clean = clean.slice(0, MAX_CELL_TEXT);
        // not half a surrogate pair
        if (/[\uD800-\uDBFF]$/.test(clean)) {
            clean = clean.slice(0, -1);
        }
    }
    const xml = xmlEscape(clean.replace(/_(?=x[0-9A-Fa-f]{4}_)/g, '_x005F_'));
    return { xml, wrap: clean.includes('\n') };
}

/**
 * The cell formats (`cellXfs` of styles.xml) the sheet uses, numbered as the cells' `s` refers to them.
 * 0 is the default: Calibri 11, General.
 */
class Styles {
    /** the custom number formats, the first is id 164: the ids below are Excel's built-in formats */
    private numberFormats: string[] = [];
    /** the cell formats, by a key of what they are */
    private formats = new Map<string, number>([['false|false|0', 0]]);
    private xfs: { bold: boolean; wrap: boolean; numFmtId: number }[] = [{ bold: false, wrap: false, numFmtId: 0 }];

    /**
     * the index of the cell format: bold (font 1) or not, wrapped lines, and a number format code
     * (`yyyy-mm-dd`), General without
     */
    index(bold: boolean, wrap: boolean, formatCode?: string): number {
        let numFmtId = 0;
        if (formatCode) {
            let i = this.numberFormats.indexOf(formatCode);
            if (i === -1) {
                i = this.numberFormats.push(formatCode) - 1;
            }
            numFmtId = 164 + i;
        }
        const key = `${bold}|${wrap}|${numFmtId}`;
        let index = this.formats.get(key);
        if (index === undefined) {
            index = this.xfs.push({ bold, wrap, numFmtId }) - 1;
            this.formats.set(key, index);
        }
        return index;
    }

    /**
     * styles.xml. Excel keeps the first two fills for itself (none and gray125), they are there.
     */
    xml(): string {
        const font = (bold: boolean) => `<font>${bold ? '<b/>' : ''}<sz val="11"/><name val="Calibri"/><family val="2"/></font>`;
        const numFmts = this.numberFormats.length
            ? `<numFmts count="${this.numberFormats.length}">${this.numberFormats
                  .map((code, i) => `<numFmt numFmtId="${164 + i}" formatCode="${xmlEscape(code)}"/>`)
                  .join('')}</numFmts>`
            : '';
        const xfs = this.xfs
            .map(({ bold, wrap, numFmtId }) => {
                const apply = `${numFmtId ? ' applyNumberFormat="1"' : ''}${bold ? ' applyFont="1"' : ''}${wrap ? ' applyAlignment="1"' : ''}`;
                const attributes = `numFmtId="${numFmtId}" fontId="${bold ? 1 : 0}" fillId="0" borderId="0" xfId="0"${apply}`;
                return wrap ? `<xf ${attributes}><alignment wrapText="1"/></xf>` : `<xf ${attributes}/>`;
            })
            .join('');
        return (
            XML_DECLARATION +
            `<styleSheet xmlns="${NS_MAIN}">` +
            numFmts +
            `<fonts count="2">${font(false)}${font(true)}</fonts>` +
            '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
            '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
            '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
            `<cellXfs count="${this.xfs.length}">${xfs}</cellXfs>` +
            '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
            '</styleSheet>'
        );
    }
}

/**
 * The number format of a date cell. The `.` of a DMY date is escaped with `\`: unescaped, a `.` is the
 * decimal point of a number format. `-`, `:` and the space are shown as they are. `mm` after `hh` is
 * the minutes, else the month.
 */
function dateFormatCode(time: boolean, order: XlsxDateOrder): string {
    const date = order === 'DMY' ? 'dd\\.mm\\.yyyy' : 'yyyy-mm-dd';
    return time ? `${date} hh:mm:ss` : date;
}

/**
 * The XML of a cell, `''` for none (a blank)
 * @param bold the header row's bold font
 */
function cellXml(value: XlsxCell, reference: string, styles: Styles, bold: boolean): string {
    if (value === null || value === undefined || value === '') {
        return '';
    }
    const style = (wrap: boolean, formatCode?: string) => {
        const index = styles.index(bold, wrap, formatCode);
        return index ? ` s="${index}"` : '';
    };

    if (typeof value === 'number' && Number.isFinite(value)) {
        // String() writes the shortest text that reads back as the same number: an xsd:double
        return `<c r="${reference}"${style(false)} t="n"><v>${String(value)}</v></c>`;
    }
    if (typeof value === 'boolean') {
        return `<c r="${reference}"${style(false)} t="b"><v>${value ? 1 : 0}</v></c>`;
    }
    if (typeof value === 'object' && 'number' in value) {
        return `<c r="${reference}"${style(false, value.format)} t="n"><v>${String(value.number)}</v></c>`;
    }
    if (typeof value === 'object') {
        const serial = excelSerial(value.date, value.time);
        if (serial === null) {
            throw new RangeError(
                `buildXlsx(): ${reference} has a date Excel can not hold (before 1900 or after 9999, or invalid)`
            );
        }
        const format = value.format ?? dateFormatCode(value.time, value.order);
        return `<c r="${reference}"${style(false, format)} t="n"><v>${String(serial)}</v></c>`;
    }
    // text, and a number that is not finite
    const text = cellText(String(value));
    if (text.xml === '') {
        return '';
    }
    return `<c r="${reference}"${style(text.wrap)} t="inlineStr"><is><t xml:space="preserve">${text.xml}</t></is></c>`;
}

/**
 * xl/worksheets/sheet1.xml. The elements in the order of the schema (CT_Worksheet): dimension,
 * sheetViews, cols, sheetData, autoFilter.
 */
function worksheetXml(sheet: XlsxSheet, styles: Styles): string {
    const columnCount = sheet.columns.length;
    const range = columnCount ? `A1:${cellReference(columnCount - 1, sheet.rows.length + 1)}` : 'A1';

    // the header row frozen: ySplit is the number of rows above the split when the pane is frozen,
    // the rows under it (from A2) scroll in the bottom left pane
    const views =
        '<sheetViews><sheetView workbookViewId="0">' +
        '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
        '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/>' +
        '</sheetView></sheetViews>';

    const cols = sheet.columns
        .map((column, i) =>
            typeof column.width === 'number' && Number.isFinite(column.width)
                ? `<col min="${i + 1}" max="${i + 1}" width="${excelColumnWidth(column.width)}" customWidth="1"/>`
                : ''
        )
        .join('');

    const rows: string[] = [];
    const header = sheet.columns.map((column, i) => cellXml(column.label, cellReference(i, 1), styles, true));
    rows.push(`<row r="1">${header.join('')}</row>`);
    sheet.rows.forEach((row, r) => {
        const cells: string[] = [];
        for (let i = 0; i < columnCount; i++) {
            cells.push(cellXml(row[i] ?? null, cellReference(i, r + 2), styles, false));
        }
        rows.push(`<row r="${r + 2}">${cells.join('')}</row>`);
    });

    return (
        XML_DECLARATION +
        `<worksheet xmlns="${NS_MAIN}">` +
        `<dimension ref="${range}"/>` +
        views +
        (cols ? `<cols>${cols}</cols>` : '') +
        `<sheetData>${rows.join('')}</sheetData>` +
        (columnCount ? `<autoFilter ref="${range}"/>` : '') +
        '</worksheet>'
    );
}

/**
 * xl/workbook.xml: the one sheet, and the hidden name `_xlnm._FilterDatabase` Excel gives the range of
 * a sheet's autofilter (Excel and other writers write it with the autoFilter element).
 * @param filterRange the autofilter's range, `''` for none
 */
function workbookXml(sheetName: string, filterRange: string): string {
    // an absolute reference, A1:C3 is $A$1:$C$3, after the sheet name in single quotes, a ' in it doubled
    const absolute = filterRange.replace(/([A-Z]+)(\d+)/g, (_, column, row) => `$${column}$${row}`);
    const reference = `'${sheetName.replaceAll("'", "''")}'!${absolute}`;
    const definedNames = filterRange
        ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">${xmlEscape(reference)}</definedName></definedNames>`
        : '';
    return (
        XML_DECLARATION +
        `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_RELATIONSHIPS}">` +
        '<bookViews><workbookView/></bookViews>' +
        `<sheets><sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/></sheets>` +
        definedNames +
        '</workbook>'
    );
}

/**
 * [Content_Types].xml: the .rels and .xml parts by their extension, the main parts by name
 */
function contentTypesXml(): string {
    const type = 'application/vnd.openxmlformats-officedocument.spreadsheetml';
    return (
        XML_DECLARATION +
        `<Types xmlns="${NS_CONTENT_TYPES}">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        `<Override PartName="/xl/workbook.xml" ContentType="${type}.sheet.main+xml"/>` +
        `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="${type}.worksheet+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="${type}.styles+xml"/>` +
        '</Types>'
    );
}

/**
 * _rels/.rels: the package's main part is the workbook
 */
function packageRelsXml(): string {
    return (
        XML_DECLARATION +
        `<Relationships xmlns="${NS_PACKAGE_RELATIONSHIPS}">` +
        `<Relationship Id="rId1" Type="${NS_RELATIONSHIPS}/officeDocument" Target="xl/workbook.xml"/>` +
        '</Relationships>'
    );
}

/**
 * xl/_rels/workbook.xml.rels: the sheet (rId1, the r:id of the sheet element) and the styles
 */
function workbookRelsXml(): string {
    return (
        XML_DECLARATION +
        `<Relationships xmlns="${NS_PACKAGE_RELATIONSHIPS}">` +
        `<Relationship Id="rId1" Type="${NS_RELATIONSHIPS}/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="${NS_RELATIONSHIPS}/styles" Target="styles.xml"/>` +
        '</Relationships>'
    );
}
