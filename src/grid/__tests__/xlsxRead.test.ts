// @vitest-environment happy-dom

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { IMPORT_LIMITS, ImportFileError, type ImportLimits } from '../importLimits';
import { unzipEntries, unzipEntry } from '../unzip';
import { buildXlsx, excelSerial, type XlsxSheet } from '../xlsx';
import { excelDate, isDateFormatCode, readXlsx } from '../xlsxRead';
import { zip } from '../zip';

/**
 * xlsxRead.ts and unzip.ts: what the grid's own writer writes reads back as it was (export -> import),
 * the parts other writers write (shared strings, rich text, prefixes, the 1904 date system, a second
 * sheet), and files made to hurt: a zip bomb, a ZIP that lies about its sizes, XML that is broken or
 * has a DOCTYPE, too many rows, columns or cells
 */

// the dates are local: a time zone with summer time, so its days are tested. Node reads TZ again when set
const originalTimeZone = process.env.TZ;
beforeAll(() => {
    process.env.TZ = 'Europe/Oslo';
});
afterAll(() => {
    process.env.TZ = originalTimeZone;
});
afterEach(() => {
    vi.unstubAllGlobals();
});

const encoder = new TextEncoder();
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PR = 'http://schemas.openxmlformats.org/package/2006/relationships';

/** a ZIP of these parts, by name */
function zipParts(parts: Record<string, string>, deflate = true) {
    return zip(
        Object.entries(parts).map(([name, text]) => ({ name, data: encoder.encode(text) })),
        { deflate, date: new Date(2026, 10, 22) }
    );
}

/** the parts of a workbook of these sheets (name and the sheetData xml), with shared strings and styles */
function workbookParts(
    sheets: { name: string; data: string; state?: string }[],
    extra: { sharedStrings?: string[]; numFmts?: string; cellXfs?: string; workbookPr?: string } = {}
): Record<string, string> {
    const parts: Record<string, string> = {
        '_rels/.rels': `${XML}<Relationships xmlns="${NS_PR}"><Relationship Id="rId1" Type="${NS_R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
        'xl/workbook.xml': `${XML}<workbook xmlns="${NS}" xmlns:r="${NS_R}">${extra.workbookPr ?? ''}<sheets>${sheets
            .map(
                (sheet, i) =>
                    `<sheet name="${sheet.name}" sheetId="${i + 1}" r:id="rId${i + 1}"${sheet.state ? ` state="${sheet.state}"` : ''}/>`
            )
            .join('')}</sheets></workbook>`,
        'xl/_rels/workbook.xml.rels': `${XML}<Relationships xmlns="${NS_PR}">${sheets
            .map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NS_R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
            .join(
                ''
            )}<Relationship Id="rS" Type="${NS_R}/sharedStrings" Target="/xl/sharedStrings.xml"/><Relationship Id="rT" Type="${NS_R}/styles" Target="styles.xml"/></Relationships>`,
        'xl/sharedStrings.xml': `${XML}<sst xmlns="${NS}">${(extra.sharedStrings ?? []).map((text) => `<si>${text}</si>`).join('')}</sst>`,
        'xl/styles.xml': `${XML}<styleSheet xmlns="${NS}">${extra.numFmts ?? ''}<cellXfs>${extra.cellXfs ?? '<xf numFmtId="0"/>'}</cellXfs></styleSheet>`
    };
    sheets.forEach((sheet, i) => {
        parts[`xl/worksheets/sheet${i + 1}.xml`] =
            `${XML}<worksheet xmlns="${NS}"><sheetData>${sheet.data}</sheetData></worksheet>`;
    });
    return parts;
}

/** the problem of the ImportFileError the promise rejects with */
async function problemOf(promise: Promise<unknown>): Promise<string> {
    try {
        await promise;
    } catch (error) {
        expect(error).toBeInstanceOf(ImportFileError);
        return (error as ImportFileError).problem;
    }
    throw new Error('expected an ImportFileError');
}

/** reads the first sheet */
async function firstSheet(bytes: Uint8Array, limits?: ImportLimits) {
    return (await readXlsx(bytes, limits)).readSheet(0);
}

describe('readXlsx - the grid exports, the grid imports: the same values', () => {
    const sheet: XlsxSheet = {
        name: 'People',
        columns: [
            { label: 'Name' },
            { label: 'Born' },
            { label: 'Login' },
            { label: 'Age' },
            { label: 'Active' },
            { label: 'Balance' },
            { label: 'Notes' }
        ],
        rows: [
            [
                'Ann',
                { date: new Date(2001, 4, 17), time: false, order: 'YMD' },
                { date: new Date(2026, 2, 29, 10, 15, 30), time: true, order: 'DMY' },
                36,
                true,
                { number: 1234.5, format: '#,##0.00' },
                'two\nlines'
            ],
            ['Bob _x0041_', { date: new Date(1900, 1, 28), time: false, order: 'DMY' }, null, -0.1, false, 0, ''],
            [
                '=1+1 & <b>',
                { date: new Date(1900, 2, 1), time: false, order: 'YMD', format: 'dddd' },
                null,
                1e21,
                null,
                null,
                'æøå 日本'
            ]
        ]
    };

    for (const deflate of [true, false]) {
        it(`expect every value back, typed - ${deflate ? 'deflated' : 'stored'}`, async () => {
            const workbook = await readXlsx(await buildXlsx(sheet, { deflate }));
            expect(workbook.sheets).toEqual(['People']);
            const rows = await workbook.readSheet(0);
            expect(rows[0]).toEqual(['Name', 'Born', 'Login', 'Age', 'Active', 'Balance', 'Notes']);
            expect(rows[1]).toEqual([
                'Ann',
                new Date(2001, 4, 17),
                new Date(2026, 2, 29, 10, 15, 30),
                36,
                true,
                1234.5,
                'two\nlines'
            ]);
            // the text that looks like an escape of ST_Xstring, the day before the Lotus 1900-02-29, an
            // empty text is no cell: the row ends with the last value
            expect(rows[2]).toEqual(['Bob _x0041_', new Date(1900, 1, 28), null, -0.1, false, 0]);
            // a formula is text, never run; a date with a format of its own is still a date
            expect(rows[3]).toEqual(['=1+1 & <b>', new Date(1900, 2, 1), null, 1e21, null, null, 'æøå 日本']);
        });
    }

    it('expect each day of a year with summer time to come back the same day, at midnight', async () => {
        const days = Array.from({ length: 366 }, (_, i) => new Date(2024, 0, 1 + i));
        const rows = await firstSheet(
            await buildXlsx({
                name: 'Days',
                columns: [{ label: 'Day' }],
                rows: days.map((date) => [{ date, time: false, order: 'YMD' }])
            })
        );
        expect(rows.slice(1).map((row) => row[0])).toEqual(days);
    });
});

describe('readXlsx - what other writers write', () => {
    it('expect shared strings, rich text without its phonetic guide, inline strings, formula text, errors and ISO dates', async () => {
        const data =
            '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="inlineStr"><is><t>inline</t></is></c></row>' +
            '<row r="2"><c r="A2" t="str"><f>A1&amp;"!"</f><v>Ann!</v></c><c r="B2" t="e"><v>#N/A</v></c><c r="C2" t="d"><v>2026-11-20T13:45:00</v></c><c r="D2" t="b"><v>1</v></c></row>' +
            '<row r="3"><c r="A3" t="s"><v>99</v></c><c r="B3"/><c r="C3" t="n"><v></v></c></row>';
        const rows = await firstSheet(
            await zipParts(
                workbookParts([{ name: 'S', data }], {
                    sharedStrings: [
                        '<t>plain</t>',
                        '<r><t>bold </t></r><r><rPr/><t xml:space="preserve">and more</t></r><rPh><t>ふりがな</t></rPh>'
                    ]
                })
            )
        );
        expect(rows).toEqual([
            ['plain', 'bold and more', 'inline'],
            ['Ann!', '#N/A', new Date(2026, 10, 20, 13, 45), true],
            // a shared string index that is not there, an empty cell, an empty value
            []
        ]);
    });

    it('expect rows and cells without r to follow the ones before, gaps of rows as empty rows', async () => {
        const data =
            '<row><c><v>1</v></c><c><v>2</v></c></row><row r="4"><c r="C4"><v>3</v></c><c><v>4</v></c></row><row><c><v>5</v></c></row>';
        expect(await firstSheet(await zipParts(workbookParts([{ name: 'S', data }])))).toEqual([
            [1, 2],
            [],
            [],
            [null, null, 3, 4],
            [5]
        ]);
    });

    it('expect the sheets in the order of the tabs, a hidden one too, a chart sheet not - each read on its own', async () => {
        const parts = workbookParts([
            { name: 'First', data: '<row r="1"><c r="A1"><v>1</v></c></row>' },
            { name: 'Second', data: '<row r="1"><c r="A1" t="inlineStr"><is><t>two</t></is></c></row>', state: 'hidden' }
        ]);
        // a chart sheet: in the workbook, its relationship is no worksheet
        parts['xl/workbook.xml'] = parts['xl/workbook.xml'].replace(
            '</sheets>',
            '<sheet name="Chart" sheetId="9" r:id="rC"/></sheets>'
        );
        parts['xl/_rels/workbook.xml.rels'] = parts['xl/_rels/workbook.xml.rels'].replace(
            '</Relationships>',
            `<Relationship Id="rC" Type="${NS_R}/chartsheet" Target="chartsheets/sheet1.xml"/></Relationships>`
        );
        const workbook = await readXlsx(await zipParts(parts));
        expect(workbook.sheets).toEqual(['First', 'Second']);
        expect(await workbook.readSheet(1)).toEqual([['two']]);
        expect(await workbook.readSheet(0)).toEqual([[1]]);
        // asked again: the same rows, not read again
        expect(await workbook.readSheet(1)).toBe(await workbook.readSheet(1));
        expect(await problemOf(workbook.readSheet(5))).toBe('broken');
    });

    it('expect the parts of a writer that uses a prefix for the namespace (x:) to be read', async () => {
        const parts = workbookParts([{ name: 'S', data: '' }], { sharedStrings: ['<x:t>prefixed</x:t>'] });
        parts['xl/worksheets/sheet1.xml'] =
            `${XML}<x:worksheet xmlns:x="${NS}"><x:sheetData><x:row r="1"><x:c r="A1" t="s"><x:v>0</x:v></x:c><x:c r="B1"><x:v>7</x:v></x:c></x:row></x:sheetData></x:worksheet>`;
        parts['xl/sharedStrings.xml'] = `${XML}<x:sst xmlns:x="${NS}"><x:si><x:t>prefixed</x:t></x:si></x:sst>`;
        expect(await firstSheet(await zipParts(parts))).toEqual([['prefixed', 7]]);
    });

    it('expect the date formats of the styles: built-in, custom - and a number format to stay a number', async () => {
        const numFmts =
            '<numFmts><numFmt numFmtId="164" formatCode="dd/mm/yyyy\\ hh:mm"/><numFmt numFmtId="165" formatCode="#,##0.00\\ &quot;kr&quot;"/></numFmts>';
        const cellXfs = '<xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="164"/><xf numFmtId="165"/><xf numFmtId="4"/>';
        const serial = excelSerial(new Date(2026, 10, 20, 18, 30), true);
        const data = `<row r="1"><c r="A1" s="1"><v>${Math.floor(serial ?? 0)}</v></c><c r="B1" s="2"><v>${serial}</v></c><c r="C1" s="3"><v>12.5</v></c><c r="D1" s="4"><v>3</v></c><c r="E1" s="1"><v>-5</v></c></row>`;
        expect(await firstSheet(await zipParts(workbookParts([{ name: 'S', data }], { numFmts, cellXfs })))).toEqual([
            // a serial out of range (-5) stays the number
            [new Date(2026, 10, 20), new Date(2026, 10, 20, 18, 30), 12.5, 3, -5]
        ]);
    });

    it('expect the 1904 date system of old Mac workbooks', async () => {
        const data = '<row r="1"><c r="A1" s="1"><v>0</v></c><c r="B1" s="1"><v>44884.5</v></c></row>';
        const parts = workbookParts([{ name: 'S', data }], {
            cellXfs: '<xf numFmtId="0"/><xf numFmtId="22"/>',
            workbookPr: '<workbookPr date1904="1"/>'
        });
        expect(await firstSheet(await zipParts(parts))).toEqual([[new Date(1904, 0, 1), new Date(2026, 10, 20, 12)]]);
    });

    it('expect a workbook without _rels/.rels, shared strings or styles to be read from xl/workbook.xml', async () => {
        const parts = workbookParts([{ name: 'S', data: '<row r="1"><c r="A1"><v>1</v></c></row>' }]);
        delete parts['_rels/.rels'];
        delete parts['xl/sharedStrings.xml'];
        delete parts['xl/styles.xml'];
        expect(await firstSheet(await zipParts(parts))).toEqual([[1]]);
    });
});

describe('excelDate and isDateFormatCode', () => {
    it("expect the reverse of the writer's excelSerial, the Lotus leap day read as 1 March 1900", () => {
        expect(excelDate(46346, false)).toEqual(new Date(2026, 10, 20));
        expect(excelDate(46346.75, false)).toEqual(new Date(2026, 10, 20, 18));
        expect(excelDate(1, false)).toEqual(new Date(1900, 0, 1));
        expect(excelDate(59, false)).toEqual(new Date(1900, 1, 28));
        expect(excelDate(60, false)).toEqual(new Date(1900, 2, 1));
        expect(excelDate(61, false)).toEqual(new Date(1900, 2, 1));
        // rounded to the second, a time that rounds to midnight is the next day
        expect(excelDate(46346.999_999_9, false)).toEqual(new Date(2026, 10, 21));
        expect(excelDate(-1, false)).toBeNull();
        expect(excelDate(2_958_466, false)).toBeNull();
        expect(excelDate(Number.NaN, false)).toBeNull();
    });

    it('expect the date parts outside quotes, escapes, brackets, padding and fills', () => {
        for (const code of [
            'yyyy-mm-dd',
            'd/m/yy',
            'h:mm AM/PM',
            '[h]:mm:ss',
            '[$-414]dd.mm.yyyy',
            'mmm',
            'dd\\.mm\\.yyyy hh:mm:ss'
        ]) {
            expect(isDateFormatCode(code), code).toBe(true);
        }
        for (const code of [
            'General',
            '0.00',
            '#,##0 "days"',
            '[Red]0.0',
            '_-* #,##0.00 _k_r_-;\\-* #,##0.00 _k_r',
            '0.00E+00',
            '@',
            '\\d0'
        ]) {
            expect(isDateFormatCode(code), code).toBe(false);
        }
    });
});

describe('readXlsx and unzip - a file made to hurt', () => {
    const small: ImportLimits = { ...IMPORT_LIMITS, unzippedSize: 2000 };

    it('expect a zip bomb not to be inflated: a part larger than the limit is refused by its size', async () => {
        // 5 MB of spaces deflate to a few KB
        const parts = workbookParts([
            { name: 'S', data: `<row r="1"><c r="A1" t="inlineStr"><is><t>${' '.repeat(5_000_000)}</t></is></c></row>` }
        ]);
        const bytes = await zipParts(parts);
        expect(bytes.length).toBeLessThan(20_000);
        expect(await problemOf(firstSheet(bytes, { ...IMPORT_LIMITS, unzippedSize: 1_000_000 }))).toBe('tooLarge');
        // the limit is for every part read together
        expect(
            await problemOf(
                readXlsx(
                    await zipParts(workbookParts([{ name: 'S', data: '' }], { sharedStrings: ['<t>x</t>'.repeat(300)] })),
                    small
                )
            )
        ).toBe('tooLarge');
    });

    it('expect a ZIP that gives a small size and inflates to more to stop at its size: broken', async () => {
        const bytes = await zipParts({ 'a.xml': 'x'.repeat(100_000) });
        const [entry] = unzipEntries(bytes);
        const lie = { ...entry, size: 1000 };
        expect(await problemOf(unzipEntry(bytes, lie, 1_000_000))).toBe('broken');
    });

    it('expect damaged data - a CRC that does not match, data that is no DEFLATE, a method it does not know - to be broken', async () => {
        const bytes = await zipParts({ 'a.xml': 'hello hello hello hello' });
        const [entry] = unzipEntries(bytes);
        expect(new TextDecoder().decode(await unzipEntry(bytes, entry, 1000))).toBe('hello hello hello hello');
        expect(await problemOf(unzipEntry(bytes, { ...entry, crc: entry.crc ^ 1 }, 1000))).toBe('broken');
        expect(await problemOf(unzipEntry(bytes, { ...entry, method: 12 }, 1000))).toBe('broken');
        const garbage = bytes.slice();
        garbage.fill(0xff, 30 + entry.name.length, 30 + entry.name.length + entry.compressedSize);
        expect(await problemOf(unzipEntry(garbage, entry, 1000))).toBe('broken');
        expect(await problemOf(unzipEntry(bytes, { ...entry, offset: bytes.length + 10 }, 1000))).toBe('broken');
        expect(await problemOf(unzipEntry(bytes, { ...entry, compressedSize: bytes.length }, 1000))).toBe('broken');
    });

    it('expect what is no ZIP, ZIP64 and an encrypted file to be broken', async () => {
        const not = async (bytes: Uint8Array) => {
            try {
                unzipEntries(bytes);
            } catch (error) {
                return (error as ImportFileError).problem;
            }
            return 'read';
        };
        expect(await not(encoder.encode('name,age\nAnn,36\n'))).toBe('broken');
        expect(await not(new Uint8Array(0))).toBe('broken');

        const bytes = await zipParts({ 'a.xml': '<a/>' });
        const end = bytes.length - 22;
        const zip64 = bytes.slice();
        new DataView(zip64.buffer).setUint16(end + 10, 0xffff, true);
        expect(await not(zip64)).toBe('broken');

        const directory = new DataView(bytes.buffer).getUint32(end + 16, true);
        const encrypted = bytes.slice();
        new DataView(encrypted.buffer).setUint16(directory + 8, 1, true);
        expect(await not(encrypted)).toBe('broken');

        const outside = bytes.slice();
        new DataView(outside.buffer).setUint32(end + 16, bytes.length, true);
        expect(await not(outside)).toBe('broken');
    });

    it('expect a ZIP without a workbook, or without a worksheet, to be broken', async () => {
        expect(await problemOf(readXlsx(await zipParts({ mimetype: 'application/vnd.oasis.opendocument.spreadsheet' })))).toBe(
            'broken'
        );
        const parts = workbookParts([]);
        expect(await problemOf(readXlsx(await zipParts(parts)))).toBe('broken');
    });

    it('expect XML that is not well-formed, and a DOCTYPE (entities that expand: billion laughs), to be broken', async () => {
        const parts = workbookParts([{ name: 'S', data: '<row r="1"><c r="A1"><v>1</v></c></row>' }]);
        expect(await problemOf(readXlsx(await zipParts({ ...parts, 'xl/workbook.xml': `${XML}<workbook><sheets>` })))).toBe(
            'broken'
        );
        const laughs =
            '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">]>' +
            `<sst xmlns="${NS}"><si><t>&lol2;</t></si></sst>`;
        expect(await problemOf(readXlsx(await zipParts({ ...parts, 'xl/sharedStrings.xml': laughs })))).toBe('broken');
        const sheet = parts['xl/worksheets/sheet1.xml'].replace('<sheetData>', '<sheetData><row>');
        expect(await problemOf(firstSheet(await zipParts({ ...parts, 'xl/worksheets/sheet1.xml': sheet })))).toBe('broken');
    });

    it('expect the rows, the columns and the cells of a sheet to stop at their limits', async () => {
        const rows = Array.from(
            { length: 6 },
            (_, i) => `<row r="${i + 1}"><c r="A${i + 1}"><v>${i}</v></c><c r="B${i + 1}"><v>${i}</v></c></row>`
        ).join('');
        const bytes = await zipParts(workbookParts([{ name: 'S', data: rows }]));
        expect(await firstSheet(bytes, { ...IMPORT_LIMITS, rows: 6, columns: 2, cells: 12 })).toHaveLength(6);
        expect(await problemOf(firstSheet(bytes, { ...IMPORT_LIMITS, rows: 5 }))).toBe('tooLarge');
        expect(await problemOf(firstSheet(bytes, { ...IMPORT_LIMITS, columns: 1 }))).toBe('tooLarge');
        expect(await problemOf(firstSheet(bytes, { ...IMPORT_LIMITS, cells: 11 }))).toBe('tooLarge');
        // a cell far away: no array of a million rows or 16 384 columns is made for it
        const far = await zipParts(workbookParts([{ name: 'S', data: '<row r="1048576"><c r="XFD1048576"><v>1</v></c></row>' }]));
        expect(await problemOf(firstSheet(far))).toBe('tooLarge');
        const wide = await zipParts(workbookParts([{ name: 'S', data: '<row r="1"><c r="XFD1"><v>1</v></c></row>' }]));
        expect(await problemOf(firstSheet(wide))).toBe('tooLarge');
    });

    it('expect a browser without DecompressionStream to be unsupported - a stored workbook is still read', async () => {
        const deflated = await buildXlsx({ name: 'S', columns: [{ label: 'A' }], rows: [['x'.repeat(200)]] });
        const stored = await buildXlsx({ name: 'S', columns: [{ label: 'A' }], rows: [['x']] }, { deflate: false });
        vi.stubGlobal('DecompressionStream', undefined);
        expect(await problemOf(readXlsx(deflated))).toBe('unsupported');
        expect(await firstSheet(stored)).toEqual([['A'], ['x']]);
    });
});
