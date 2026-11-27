import { IMPORT_LIMITS, ImportFileError, type ImportLimits } from './importLimits';
import { type UnzipEntry, unzipEntries, unzipEntry } from './unzip';

/**
 * Reads an Excel workbook (.xlsx): the names of its sheets, and the cells of a sheet - for the import
 * (importFile.ts). No grid, no datasource. The other half of xlsx.ts, which writes them: a ZIP
 * (unzip.ts) of SpreadsheetML parts, ECMA-376. The parts it reads:
 *
 * | part | |
 * | --- | --- |
 * | `_rels/.rels` | where the workbook is (`officeDocument`), `xl/workbook.xml` when it does not say |
 * | `xl/workbook.xml` | the sheets, in their order, and the 1904 date system (`workbookPr date1904`) |
 * | `xl/_rels/workbook.xml.rels` | the part of each sheet, the shared strings and the styles |
 * | `xl/sharedStrings.xml` | the texts a cell of the type `s` points to |
 * | `xl/styles.xml` | the number format of each cell format: which cells hold a date |
 * | `xl/worksheets/sheet1.xml` ... | the cells |
 *
 * The values of the cells, typed:
 *
 * - a number: a number - or a `Date` when its number format is a date or a time (Excel keeps a date as
 *   the days since 1899-12-30, see {@link excelDate})
 * - a text (`s` shared, `inlineStr`, `str` a formula's text): a string; the escape `_x0041_` of
 *   ST_Xstring is read as the character, CR LF as LF. A rich text is its runs, without the phonetic
 *   guide
 * - a boolean (`b`): `true` / `false`
 * - an error (`e`): its text, `#N/A`
 * - a date written as text (`d`, ISO 8601): a `Date`
 * - no value: `null`. A formula is never run: its cached value is what is read
 *
 * The rows are the sheet's rows: row 1 is the first, a row with no cells is `[]`, so `rows[4]` is Excel's
 * row 5. Each row has a cell for each column up to its last cell with a value, `null` where there is none.
 *
 * The file came from a user: the parts are read with `DOMParser` as XML (no html, no scripts, nothing
 * ever put in the page), a part with a `<!DOCTYPE` is not read at all (entities could make it expand -
 * an .xlsx part never has one), and the ZIP, the rows, the columns and the cells stop at the limits
 * (importLimits.ts).
 */

/**
 * A value of a cell as the import reads it from a file: text, a number, a boolean or a `Date` - or `null`
 * for an empty cell. A CSV file gives text only, an .xlsx file each type its cells have.
 */
export type ImportCell = string | number | boolean | Date | null;

/**
 * A workbook as it is read: the names of the sheets first, a sheet's cells when they are asked for
 */
export interface XlsxWorkbook {
    /** the names of the worksheets, in the order of the workbook's tabs. A chart sheet is not one */
    sheets: string[];
    /**
     * the rows of a sheet, see the top of the file. A sheet is read once, asking again gives the same rows
     * @param index the sheet, an index into `sheets`
     * @throws an `ImportFileError` past a limit, for a part that is missing or not XML
     */
    readSheet(index: number): Promise<ImportCell[][]>;
}

// the namespace of the relationships of a part (r:id), ECMA-376 Part 1
const NS_RELATIONSHIPS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/**
 * Excel's built-in number formats that are dates or times (ECMA-376 Part 1, 18.8.30): 14-22 the dates and
 * times, 45-47 minutes and seconds, 27-36 and 50-58 the dates of the East Asian languages
 */
const BUILT_IN_DATE_FORMATS = new Set([
    14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58
]);

/** the largest serial date: 9999-12-31, Excel's last day */
const MAX_SERIAL = 2_958_465;

/**
 * the error of a workbook that is not read
 */
function broken(why: string): ImportFileError {
    return new ImportFileError('broken', `The file is not an Excel workbook that can be read: ${why}`);
}

/**
 * Opens an .xlsx file: reads the ZIP's directory, the workbook, its relationships, the shared strings
 * and the styles. The cells of a sheet are read by {@link XlsxWorkbook.readSheet}.
 *
 * @param bytes the file
 * @param limits the most it reads, IMPORT_LIMITS by default: `unzippedSize` for all the parts together,
 * `rows`, `columns` and `cells` for a sheet
 * @throws an `ImportFileError`: `'broken'` for a ZIP that holds no workbook, a part that is not
 * well-formed XML (or has a DOCTYPE); `'tooLarge'` past a limit; `'unsupported'` without
 * `DecompressionStream('deflate-raw')`
 *
 * @example
 * const workbook = await readXlsx(new Uint8Array(await file.arrayBuffer()));
 * workbook.sheets; // ['People', 'Cities']
 * const rows = await workbook.readSheet(0); // [['Name', 'Born'], ['Ann', Date 2001-05-17]]
 */
export async function readXlsx(bytes: Uint8Array, limits: ImportLimits = IMPORT_LIMITS): Promise<XlsxWorkbook> {
    // part names are not case sensitive (Open Packaging Conventions, Part 2)
    const entries = new Map<string, UnzipEntry>(unzipEntries(bytes).map((entry) => [entry.name.toLowerCase(), entry]));
    let budget = limits.unzippedSize;

    // a part as XML, null when the ZIP has no such part. Every part read counts against unzippedSize
    const readPart = async (path: string): Promise<Document | null> => {
        const entry = entries.get(path.toLowerCase());
        if (!entry) {
            return null;
        }
        const data = await unzipEntry(bytes, entry, budget);
        budget -= data.length;
        return parseXml(data, path);
    };

    const packageRels = relationships(await readPart('_rels/.rels'), '');
    const workbookPath = packageRels.find((rel) => rel.type.endsWith('/officeDocument'))?.target ?? 'xl/workbook.xml';
    const workbook = await readPart(workbookPath);
    if (!workbook) {
        throw broken(`it has no ${workbookPath}`);
    }
    const folder = workbookPath.slice(0, workbookPath.lastIndexOf('/') + 1);
    const rels = relationships(await readPart(`${folder}_rels/${workbookPath.slice(folder.length)}.rels`), folder);
    const relOfType = (type: string) => rels.find((rel) => rel.type.endsWith(`/${type}`))?.target;

    const date1904 = ['1', 'true'].includes(
        childrenNamed(workbook.documentElement, 'workbookPr')[0]?.getAttribute('date1904') ?? ''
    );
    const sheets: { name: string; path: string }[] = [];
    for (const sheet of childrenNamed(childrenNamed(workbook.documentElement, 'sheets')[0], 'sheet')) {
        const id = sheet.getAttributeNS(NS_RELATIONSHIPS, 'id') ?? sheet.getAttribute('r:id');
        const rel = rels.find((each) => each.id === id && each.type.endsWith('/worksheet'));
        if (rel) {
            sheets.push({ name: sheet.getAttribute('name') ?? '', path: rel.target });
        }
    }
    if (!sheets.length) {
        throw broken('it has no worksheet');
    }

    const sharedStringsPath = relOfType('sharedStrings');
    const sharedStrings = sharedStringsPath ? readSharedStrings(await readPart(sharedStringsPath)) : [];
    const stylesPath = relOfType('styles');
    const dateStyles = stylesPath ? readDateStyles(await readPart(stylesPath)) : new Set<number>();

    const read = new Map<number, ImportCell[][]>();
    return {
        sheets: sheets.map((sheet) => sheet.name),
        readSheet: async (index) => {
            const done = read.get(index);
            if (done) {
                return done;
            }
            const sheet = sheets[index];
            const xml = sheet ? await readPart(sheet.path) : null;
            if (!xml) {
                throw broken(`the sheet ${index + 1} has no part`);
            }
            const rows = readRows(xml, { sharedStrings, dateStyles, date1904 }, limits);
            read.set(index, rows);
            return rows;
        }
    };
}

/**
 * The text of a part as XML: UTF-8, or UTF-16 with its byte order mark. A DOCTYPE is not read - its
 * entities could make a few bytes expand to gigabytes, and SpreadsheetML has none
 * @throws an `ImportFileError` (`'broken'`) for a DOCTYPE, or what is not well-formed XML
 */
function parseXml(data: Uint8Array, path: string): Document {
    const utf16 = data[0] === 0xff && data[1] === 0xfe ? 'utf-16le' : data[0] === 0xfe && data[1] === 0xff ? 'utf-16be' : null;
    const text = new TextDecoder(utf16 ?? 'utf-8').decode(data);
    if (/<!DOCTYPE/i.test(text)) {
        throw broken(`${path} has a DOCTYPE`);
    }
    const xml = new DOMParser().parseFromString(text, 'application/xml');
    if (xml.getElementsByTagName('parsererror').length) {
        throw broken(`${path} is not well-formed XML`);
    }
    return xml;
}

/**
 * The element children of an element with this local name, in any namespace (a part can use a prefix:
 * `<x:row>`). `[]` for no element
 */
function childrenNamed(element: Element | undefined, name: string): Element[] {
    if (!element) {
        return [];
    }
    return Array.from(element.children).filter((child) => child.localName === name);
}

/**
 * The relationships of a .rels part: id, type and target - the target as a path in the ZIP, resolved
 * from the folder of the part it belongs to. An external target (a link) is left out
 * @param folder the folder of the part the relationships are of, `xl/`, ending with `/`; '' for the package
 */
function relationships(xml: Document | null, folder: string): { id: string; type: string; target: string }[] {
    return childrenNamed(xml?.documentElement, 'Relationship')
        .filter((rel) => rel.getAttribute('TargetMode') !== 'External')
        .map((rel) => ({
            id: rel.getAttribute('Id') ?? '',
            type: rel.getAttribute('Type') ?? '',
            target: resolvePath(folder, rel.getAttribute('Target') ?? '')
        }));
}

/**
 * A target of a relationship as a path in the ZIP: from the root with a leading `/`, else from `folder`,
 * `..` going a folder up
 */
function resolvePath(folder: string, target: string): string {
    const parts = (target.startsWith('/') ? target.slice(1) : folder + target).split('/');
    const path: string[] = [];
    for (const part of parts) {
        if (part === '..') {
            path.pop();
        } else if (part !== '.' && part !== '') {
            path.push(part);
        }
    }
    return path.join('/');
}

/**
 * The text of a rich text element - a shared string `<si>`, an inline string `<is>`: its `<t>`, or the
 * `<t>` of each run `<r>`. The phonetic guide (`<rPh>`) is no part of the text
 */
function richText(element: Element): string {
    let text = '';
    for (const child of Array.from(element.children)) {
        if (child.localName === 't') {
            text += child.textContent ?? '';
        } else if (child.localName === 'r') {
            for (const run of childrenNamed(child, 't')) {
                text += run.textContent ?? '';
            }
        }
    }
    return xString(text);
}

/**
 * Text as SpreadsheetML writes it (ST_Xstring): `_x0041_` is the character U+0041, so `_x005F_` is a `_`
 * (xlsx.ts writes it for a `_` that would else be read as an escape). A line break is LF: an XML parser
 * makes CR LF a LF, the text is read the same everywhere
 */
function xString(text: string): string {
    return text
        .replace(/_x([0-9A-Fa-f]{4})_/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
        .replace(/\r\n?/g, '\n');
}

/**
 * The texts of `xl/sharedStrings.xml`, in order: a cell of the type `s` has the index of one
 */
function readSharedStrings(xml: Document | null): string[] {
    return childrenNamed(xml?.documentElement, 'si').map(richText);
}

/**
 * The cell formats of `xl/styles.xml` (`cellXfs`, a cell's `s` is an index into them) whose number format
 * is a date or a time: a built-in one (BUILT_IN_DATE_FORMATS), or a format code of its own with a date
 * or time part, see isDateFormatCode
 */
function readDateStyles(xml: Document | null): Set<number> {
    const root = xml?.documentElement;
    const codes = new Map<number, string>();
    for (const format of childrenNamed(childrenNamed(root, 'numFmts')[0], 'numFmt')) {
        codes.set(Number(format.getAttribute('numFmtId')), format.getAttribute('formatCode') ?? '');
    }
    const dates = new Set<number>();
    childrenNamed(childrenNamed(root, 'cellXfs')[0], 'xf').forEach((xf, index) => {
        const id = Number(xf.getAttribute('numFmtId') ?? 0);
        const code = codes.get(id);
        if (code === undefined ? BUILT_IN_DATE_FORMATS.has(id) : isDateFormatCode(code)) {
            dates.add(index);
        }
    });
    return dates;
}

/**
 * true when an Excel number format code shows a date or a time: its first section (before `;`) has a
 * `d`, `m`, `y`, `h` or `s` that is a part of the format - not in quotes (`"days"`), escaped (`\d`), in
 * brackets (`[Red]`, `[$kr-414]`, but `[h]` is elapsed hours), a padding (`_d`) or a fill (`*d`).
 *
 * @example
 * isDateFormatCode('yyyy-mm-dd'); // true
 * isDateFormatCode('#,##0.00 "kr"'); // false
 */
export function isDateFormatCode(code: string): boolean {
    const plain = code
        .replace(/"[^"]*"/g, '')
        .replace(/\\./g, '')
        .replace(/[_*]./g, '')
        .replace(/\[[^\]]*\]/g, (bracket) => (/^\[(h+|m+|s+)\]$/i.test(bracket) ? 'h' : ''));
    return /[dmyhs]/i.test(plain.split(';')[0]);
}

/**
 * The date of an Excel serial date, in local time - the year, month, day and time of day the cell shows:
 * the days since 1899-12-30, the time of day as the fraction of a day, rounded to the second. The reverse
 * of excelSerial() in xlsx.ts:
 *
 * - the 1900 date system: Excel counts a 29 February 1900 that never was, so before 1900-03-01 (serial 61)
 *   a serial is one day less than the days since 1899-12-30 - serial 60, that day, is read as 1900-03-01
 * - the 1904 date system (`date1904`, older Mac workbooks): the days since 1904-01-01
 * - `null` for a serial before 0 or after 9999-12-31, and for one that is no number
 *
 * @example
 * excelDate(46346, false); // 2026-11-20 00:00 local
 * excelDate(46346.75, false); // 2026-11-20 18:00 local
 */
export function excelDate(serial: number, date1904: boolean): Date | null {
    if (!Number.isFinite(serial) || serial < 0 || serial > MAX_SERIAL) {
        return null;
    }
    let days = Math.floor(serial);
    let seconds = Math.round((serial - days) * 86_400);
    if (seconds === 86_400) {
        days += 1;
        seconds = 0;
    }
    if (date1904) {
        days += 1462;
    } else if (days < 61) {
        days += 1;
    }
    // local: the Date constructor counts the days and hours on from 1899-12-30 on the calendar, a day
    // with a change of summer time is a day like the others
    return new Date(1899, 11, 30 + days, Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60);
}

/**
 * A date written as text in a cell of the type `d` (ISO 8601): a date and time without a zone is local
 * time, as Excel shows it. `null` for text that is no date
 */
function isoDate(text: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(text);
    if (!match) {
        return null;
    }
    const [, year, month, day, hours = '0', minutes = '0', seconds = '0'] = match;
    if (/(Z|[+-]\d{2}:?\d{2})$/.test(text)) {
        const instant = new Date(text);
        return Number.isNaN(instant.getTime()) ? null : instant;
    }
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes), Number(seconds));
    return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * the column of a cell reference, from 0: `A1` is 0, `AA7` is 26. -1 for what is no reference
 */
function columnOf(reference: string): number {
    const letters = /^([A-Za-z]{1,3})\d+$/.exec(reference)?.[1];
    if (!letters) {
        return -1;
    }
    let column = 0;
    for (const letter of letters.toUpperCase()) {
        column = column * 26 + (letter.charCodeAt(0) - 64);
    }
    return column - 1;
}

/**
 * The rows of a worksheet part, see the top of the file
 * @throws an `ImportFileError` (`'tooLarge'`) for a row past `limits.rows`, a cell past `limits.columns`,
 * more cells with a value than `limits.cells`
 */
function readRows(
    xml: Document,
    workbook: { sharedStrings: string[]; dateStyles: Set<number>; date1904: boolean },
    limits: ImportLimits
): ImportCell[][] {
    const tooLarge = (what: string) => new ImportFileError('tooLarge', `The sheet has more than ${what}`);
    const sheetData = childrenNamed(xml.documentElement, 'sheetData')[0];
    const rows: ImportCell[][] = [];
    let cellCount = 0;
    let rowNumber = 0;
    for (const row of childrenNamed(sheetData, 'row')) {
        // the row's number, else the one after the row before
        const r = Number(row.getAttribute('r'));
        rowNumber = Number.isInteger(r) && r > 0 ? r : rowNumber + 1;
        if (rowNumber > limits.rows) {
            throw tooLarge(`${limits.rows} rows`);
        }
        const cells: ImportCell[] = [];
        let column = -1;
        for (const c of childrenNamed(row, 'c')) {
            // the cell's column, else the one after the cell before
            const at = columnOf(c.getAttribute('r') ?? '');
            column = at >= 0 ? at : column + 1;
            if (column >= limits.columns) {
                throw tooLarge(`${limits.columns} columns`);
            }
            const value = cellValue(c, workbook);
            if (value !== null) {
                cellCount++;
                if (cellCount > limits.cells) {
                    throw tooLarge(`${limits.cells} cells`);
                }
                cells[column] = value;
            }
        }
        // a cell for each column up to the last value, null where there is none
        rows[rowNumber - 1] = Array.from(cells, (cell) => cell ?? null);
    }
    // a row the sheet does not have is a row of no cells
    return Array.from(rows, (row) => row ?? []);
}

/**
 * The value of a cell `<c>`, see the top of the file
 */
function cellValue(c: Element, workbook: { sharedStrings: string[]; dateStyles: Set<number>; date1904: boolean }): ImportCell {
    const type = c.getAttribute('t') ?? 'n';
    if (type === 'inlineStr') {
        const inline = childrenNamed(c, 'is')[0];
        return inline ? richText(inline) : null;
    }
    const v = childrenNamed(c, 'v')[0]?.textContent ?? null;
    if (v === null || v === '') {
        return null;
    }
    switch (type) {
        case 's':
            return workbook.sharedStrings[Number(v)] ?? null;
        case 'str':
            return xString(v);
        case 'b':
            return v === '1' || v === 'true';
        case 'e':
            return v;
        case 'd':
            return isoDate(v) ?? v;
        default: {
            const number = Number(v);
            if (!Number.isFinite(number)) {
                return v;
            }
            if (workbook.dateStyles.has(Number(c.getAttribute('s') ?? 0))) {
                return excelDate(number, workbook.date1904) ?? number;
            }
            return number;
        }
    }
}
