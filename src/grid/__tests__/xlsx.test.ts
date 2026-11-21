// @vitest-environment happy-dom

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    assertSheetName,
    buildXlsx,
    cellReference,
    columnName,
    excelColumnWidth,
    excelSerial,
    type XlsxCell,
    type XlsxColumn,
    type XlsxSheet,
    xlsxParts
} from '../xlsx';
import { parseXml, readParts } from './zipTestHelpers';

/**
 * xlsx.ts: the parts of the workbook (well-formed XML, the namespaces), the cells of each type, the
 * cell references, the frozen header row, the autofilter, the column widths and the sheet name rules.
 * The .xlsx files the grid downloads are also read by openpyxl, see the export guide.
 */

// the dates are local: a time zone with summer time, so the days it changes are tested. Node reads
// TZ again when it is set
const originalTimeZone = process.env.TZ;
beforeAll(() => {
    process.env.TZ = 'Europe/Oslo';
});
afterAll(() => {
    // process.env holds text: undefined would be the TZ 'undefined'
    if (originalTimeZone === undefined) {
        delete process.env.TZ;
    } else {
        process.env.TZ = originalTimeZone;
    }
});

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_PACKAGE_RELATIONSHIPS = 'http://schemas.openxmlformats.org/package/2006/relationships';

/**
 * the parts of the workbook of the sheet, parsed, read back from the ZIP
 */
async function workbook(sheet: Partial<XlsxSheet> & { rows: XlsxCell[][] }) {
    const columns: XlsxColumn[] = sheet.columns ?? (sheet.rows[0] ?? []).map((_, i) => ({ label: `Column ${i + 1}` }));
    const parts = readParts(await buildXlsx({ name: 'Sheet1', ...sheet, columns }));
    const docs: Record<string, Document> = {};
    for (const [name, text] of Object.entries(parts)) {
        docs[name] = parseXml(text);
    }
    const worksheet = docs['xl/worksheets/sheet1.xml'];
    const styles = docs['xl/styles.xml'];

    /** the <c> of a cell, null when there is none */
    const cell = (reference: string) => worksheet.querySelector(`c[r="${reference}"]`);

    /** the style of a cell: its number format code (General for 0), bold, wrapped */
    const styleOf = (reference: string) => {
        const index = Number(cell(reference)?.getAttribute('s') ?? 0);
        const xf = styles.querySelectorAll('cellXfs > xf')[index];
        const numFmtId = xf.getAttribute('numFmtId');
        const format =
            numFmtId === '0' ? 'General' : styles.querySelector(`numFmt[numFmtId="${numFmtId}"]`)?.getAttribute('formatCode');
        const font = styles.querySelectorAll('fonts > font')[Number(xf.getAttribute('fontId'))];
        return {
            format,
            bold: font.querySelector('b') !== null,
            wrap: xf.querySelector('alignment')?.getAttribute('wrapText') === '1'
        };
    };

    /** the value of a cell as written: its type and the <v>, or the inline string */
    const cellValue = (reference: string) => {
        const c = cell(reference);
        const type = c?.getAttribute('t');
        return type === 'inlineStr'
            ? { type, text: c?.querySelector('is > t')?.textContent }
            : { type, v: c?.querySelector('v')?.textContent };
    };

    return { parts, docs, worksheet, cell, styleOf, cellValue };
}

describe('xlsx - the parts', () => {
    it('expect the six parts, each well-formed XML in its namespace', async () => {
        const { parts, docs } = await workbook({ rows: [['Ann', 1]] });
        expect(Object.keys(parts)).toEqual([
            '[Content_Types].xml',
            '_rels/.rels',
            'xl/workbook.xml',
            'xl/_rels/workbook.xml.rels',
            'xl/worksheets/sheet1.xml',
            'xl/styles.xml'
        ]);
        const root = (name: string) => docs[name].documentElement;
        expect(root('[Content_Types].xml').localName).toBe('Types');
        expect(root('[Content_Types].xml').namespaceURI).toBe('http://schemas.openxmlformats.org/package/2006/content-types');
        expect(root('_rels/.rels').namespaceURI).toBe(NS_PACKAGE_RELATIONSHIPS);
        expect(root('xl/_rels/workbook.xml.rels').namespaceURI).toBe(NS_PACKAGE_RELATIONSHIPS);
        expect(root('xl/workbook.xml').localName).toBe('workbook');
        expect(root('xl/worksheets/sheet1.xml').localName).toBe('worksheet');
        expect(root('xl/styles.xml').localName).toBe('styleSheet');
        for (const name of ['xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/styles.xml']) {
            expect(root(name).namespaceURI).toBe(NS_MAIN);
        }
    });

    it('expect the content types and the relationships to name the parts there are', async () => {
        const { docs, parts } = await workbook({ rows: [] });
        const overrides = Array.from(docs['[Content_Types].xml'].querySelectorAll('Override'), (o) => o.getAttribute('PartName'));
        expect(overrides).toEqual(['/xl/workbook.xml', '/xl/worksheets/sheet1.xml', '/xl/styles.xml']);
        for (const name of overrides) {
            expect(parts[name?.slice(1) ?? '']).toBeDefined();
        }

        const office = docs['_rels/.rels'].querySelector('Relationship');
        expect(office?.getAttribute('Type')).toBe(
            'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument'
        );
        expect(office?.getAttribute('Target')).toBe('xl/workbook.xml');

        const sheet = docs['xl/workbook.xml'].querySelector('sheet');
        const relationships = Array.from(docs['xl/_rels/workbook.xml.rels'].querySelectorAll('Relationship'));
        const sheetRelationship = relationships.find((r) => r.getAttribute('Id') === sheet?.getAttribute('r:id'));
        expect(sheetRelationship?.getAttribute('Target')).toBe('worksheets/sheet1.xml');
        expect(relationships.map((r) => r.getAttribute('Target'))).toEqual(['worksheets/sheet1.xml', 'styles.xml']);
    });

    it('expect the elements of the sheet in the order of the schema, no outline, no formula', async () => {
        const { worksheet, parts } = await workbook({ columns: [{ label: 'A', width: 100 }], rows: [['x']] });
        expect(Array.from(worksheet.documentElement.children, (child) => child.localName)).toEqual([
            'dimension',
            'sheetViews',
            'cols',
            'sheetData',
            'autoFilter'
        ]);
        expect(parts['xl/worksheets/sheet1.xml']).not.toMatch(/outline|<f[ >]/i);
    });
});

describe('xlsx - the cells', () => {
    it('expect a number cell: the number as it is, General format', async () => {
        const { cellValue, styleOf, cell } = await workbook({ rows: [[12.5, -3, 0.1 + 0.2, 1e21, 0]] });
        expect(cellValue('A2')).toEqual({ type: 'n', v: '12.5' });
        expect(cellValue('B2')).toEqual({ type: 'n', v: '-3' });
        expect(cellValue('C2')).toEqual({ type: 'n', v: '0.30000000000000004' });
        expect(cellValue('D2')).toEqual({ type: 'n', v: '1e+21' });
        expect(cellValue('E2')).toEqual({ type: 'n', v: '0' });
        expect(styleOf('A2')).toEqual({ format: 'General', bold: false, wrap: false });
        expect(cell('A2')?.hasAttribute('s')).toBe(false);
    });

    it('expect a number that is not finite written as text', async () => {
        const { cellValue } = await workbook({ rows: [[Number.NaN, Number.POSITIVE_INFINITY]] });
        expect(cellValue('A2')).toEqual({ type: 'inlineStr', text: 'NaN' });
        expect(cellValue('B2')).toEqual({ type: 'inlineStr', text: 'Infinity' });
    });

    it('expect a boolean cell, 1 and 0', async () => {
        const { cellValue } = await workbook({ rows: [[true, false]] });
        expect(cellValue('A2')).toEqual({ type: 'b', v: '1' });
        expect(cellValue('B2')).toEqual({ type: 'b', v: '0' });
    });

    it('expect a date cell: the serial of the local day, the time left out, a date format', async () => {
        const { cellValue, styleOf } = await workbook({
            rows: [
                [
                    { date: new Date(2026, 10, 20, 13, 45, 12), time: false, order: 'YMD' },
                    { date: new Date(2026, 10, 20, 23, 59, 59), time: false, order: 'DMY' }
                ]
            ]
        });
        expect(cellValue('A2')).toEqual({ type: 'n', v: '46346' });
        expect(styleOf('A2').format).toBe('yyyy-mm-dd');
        expect(cellValue('B2')).toEqual({ type: 'n', v: '46346' });
        // the . of a date is escaped: a bare . is the decimal point of a number format
        expect(styleOf('B2').format).toBe('dd\\.mm\\.yyyy');
    });

    it('expect a datetime cell: the time of day as the fraction, to the second, a date and time format', async () => {
        const { cellValue, styleOf } = await workbook({
            rows: [
                [
                    { date: new Date(2026, 10, 20, 18, 0, 0), time: true, order: 'YMD' },
                    { date: new Date(2026, 10, 20, 13, 45, 12, 999), time: true, order: 'YMD' },
                    { date: new Date(2026, 10, 20, 13, 45, 12), time: true, order: 'DMY' }
                ]
            ]
        });
        expect(cellValue('A2')).toEqual({ type: 'n', v: '46346.75' });
        // the milliseconds are left out, as the grid shows the time
        expect(Number(cellValue('B2').v)).toBe(46346 + (13 * 3600 + 45 * 60 + 12) / 86400);
        expect(styleOf('A2').format).toBe('yyyy-mm-dd hh:mm:ss');
        expect(styleOf('C2').format).toBe('dd\\.mm\\.yyyy hh:mm:ss');
    });

    it('expect a text cell: an inline string, escaped, spaces kept', async () => {
        const { cellValue, parts, cell } = await workbook({
            rows: [['  Tom & "Jerry" <b>x</b>  ', 'Ærøskøbing 😀', '=HYPERLINK("x")']]
        });
        expect(cellValue('A2')).toEqual({ type: 'inlineStr', text: '  Tom & "Jerry" <b>x</b>  ' });
        expect(parts['xl/worksheets/sheet1.xml']).toContain(
            '<t xml:space="preserve">  Tom &amp; &quot;Jerry&quot; &lt;b&gt;x&lt;/b&gt;  </t>'
        );
        expect(cellValue('B2').text).toBe('Ærøskøbing 😀');
        // never a formula: an inline string has no <f>
        expect(cellValue('C2')).toEqual({ type: 'inlineStr', text: '=HYPERLINK("x")' });
        expect(cell('C2')?.querySelector('f')).toBeNull();
    });

    it('expect a text with line breaks wrapped, CR LF and CR as LF', async () => {
        const { cellValue, styleOf } = await workbook({ rows: [['line 1\r\nline 2\rline 3\nline 4', 'one line']] });
        expect(cellValue('A2').text).toBe('line 1\nline 2\nline 3\nline 4');
        expect(styleOf('A2').wrap).toBe(true);
        expect(styleOf('B2').wrap).toBe(false);
    });

    it('expect the characters XML can not hold left out, a tab kept', async () => {
        const { cellValue, parts } = await workbook({
            rows: [['a\u0000b\u0001c\u0008d\u000be\u001ff\tg￾h\uD800i', '\u0001\u0002']]
        });
        expect(cellValue('A2').text).toBe('abcdef\tghi');
        // nothing left: no cell
        expect(parts['xl/worksheets/sheet1.xml']).not.toContain('r="B2"');
    });

    it('expect _xHHHH_ in a text escaped, so Excel reads it as it is and not as a character', async () => {
        const { parts } = await workbook({ rows: [['_x0041_ and _x00e6_ but not _x41_ or x0041_']] });
        expect(parts['xl/worksheets/sheet1.xml']).toContain('>_x005F_x0041_ and _x005F_x00e6_ but not _x41_ or x0041_</t>');
    });

    it('expect a text longer than a cell holds cut at 32 767 characters, not in a surrogate pair', async () => {
        const { cellValue } = await workbook({ rows: [['a'.repeat(40_000), `${'a'.repeat(32_766)}😀`]] });
        expect(cellValue('A2').text?.length).toBe(32_767);
        expect(cellValue('B2').text).toBe('a'.repeat(32_766));
    });

    it("expect no cell for a blank: null and ''", async () => {
        const { worksheet, cell } = await workbook({ rows: [[null, '', 'x']] });
        expect(cell('A2')).toBeNull();
        expect(cell('B2')).toBeNull();
        expect(cell('C2')).not.toBeNull();
        expect(worksheet.querySelector('row[r="2"]')?.children.length).toBe(1);
    });

    it('expect the header row: the labels, bold, a row 1 cell per column', async () => {
        const { cellValue, styleOf } = await workbook({
            columns: [{ label: 'Name' }, { label: 'Notes\nmore' }, { label: '' }],
            rows: [['Ann', 'x', 'y']]
        });
        expect(cellValue('A1')).toEqual({ type: 'inlineStr', text: 'Name' });
        expect(styleOf('A1')).toEqual({ format: 'General', bold: true, wrap: false });
        expect(styleOf('B1')).toEqual({ format: 'General', bold: true, wrap: true });
        expect(styleOf('A2').bold).toBe(false);
    });

    it('expect the styles numbered once each: one number format per date format, from id 164', async () => {
        const { docs } = await workbook({
            rows: [
                [
                    { date: new Date(2026, 0, 1), time: false, order: 'YMD' },
                    { date: new Date(2026, 0, 2), time: false, order: 'YMD' },
                    { date: new Date(2026, 0, 2), time: true, order: 'YMD' }
                ]
            ]
        });
        const styles = docs['xl/styles.xml'];
        expect(Array.from(styles.querySelectorAll('numFmt'), (n) => n.getAttribute('numFmtId'))).toEqual(['164', '165']);
        // default, bold header, date, datetime
        expect(styles.querySelectorAll('cellXfs > xf').length).toBe(4);
        expect(styles.querySelector('cellXfs')?.getAttribute('count')).toBe('4');
        // Excel keeps the first two fills for itself
        expect(Array.from(styles.querySelectorAll('patternFill'), (f) => f.getAttribute('patternType'))).toEqual([
            'none',
            'gray125'
        ]);
    });
});

describe('xlsx - serial dates', () => {
    it('expect the days since 1899-12-30 from 1900-03-01 on', () => {
        expect(excelSerial(new Date(2026, 10, 20), false)).toBe(46346);
        expect(excelSerial(new Date(1900, 2, 1), false)).toBe(61);
        expect(excelSerial(new Date(2000, 0, 1), false)).toBe(36526);
        expect(excelSerial(new Date(9999, 11, 31), false)).toBe(2958465);
    });

    it('expect the days before 1900-03-01 one less: Excel counts a 1900-02-29 that never was', () => {
        expect(excelSerial(new Date(1900, 0, 1), false)).toBe(1);
        expect(excelSerial(new Date(1900, 1, 28), false)).toBe(59);
        expect(excelSerial(new Date(1900, 1, 28, 12), true)).toBe(59.5);
    });

    it('expect null for a date Excel can not hold: before 1900, after 9999, invalid', () => {
        expect(excelSerial(new Date(1899, 11, 31), false)).toBeNull();
        expect(excelSerial(new Date(10000, 0, 1), false)).toBeNull();
        expect(excelSerial(new Date(Number.NaN), true)).toBeNull();
        // year 50: Date.UTC() would take it as 1950
        const year50 = new Date(2000, 0, 1);
        year50.setFullYear(50);
        expect(excelSerial(year50, false)).toBeNull();
    });

    it('expect the local day and time on the days summer time starts and ends', () => {
        // Europe/Oslo: 2026-03-29 02:00 is 03:00, 2026-10-25 03:00 is 02:00 - days of 23 and 25 hours
        expect(new Date(2026, 2, 29, 12).getTimezoneOffset()).toBe(-120);
        expect(new Date(2026, 2, 28, 12).getTimezoneOffset()).toBe(-60);

        expect(excelSerial(new Date(2026, 2, 29), false)).toBe(46110);
        expect(excelSerial(new Date(2026, 2, 29, 23, 30), false)).toBe(46110);
        expect(excelSerial(new Date(2026, 2, 29, 12), true)).toBe(46110.5);
        expect(excelSerial(new Date(2026, 9, 25), false)).toBe(46320);
        expect(excelSerial(new Date(2026, 9, 25, 23), true)).toBe(46320 + 23 / 24);
        // the day after has a whole number of days to the day before, though the hours between differ
        expect(excelSerial(new Date(2026, 2, 30), false)).toBe(46111);
        expect(excelSerial(new Date(2026, 9, 26), false)).toBe(46321);
    });

    it('expect a buildXlsx() date cell Excel can not hold to throw a RangeError', async () => {
        await expect(
            buildXlsx({
                name: 'Sheet1',
                columns: [{ label: 'A' }],
                rows: [[{ date: new Date(1899, 0, 1), time: false, order: 'YMD' }]]
            })
        ).rejects.toThrow(RangeError);
    });
});

describe('xlsx - references, frozen header, autofilter', () => {
    it('expect the column names A-Z, AA ..., column 703 is AAA, the last is XFD', () => {
        expect(columnName(0)).toBe('A');
        expect(columnName(25)).toBe('Z');
        expect(columnName(26)).toBe('AA');
        expect(columnName(51)).toBe('AZ');
        expect(columnName(52)).toBe('BA');
        expect(columnName(701)).toBe('ZZ');
        expect(columnName(702)).toBe('AAA');
        expect(columnName(16_383)).toBe('XFD');
        expect(cellReference(0, 1)).toBe('A1');
        expect(cellReference(26, 10)).toBe('AA10');
    });

    it('expect a cell reference on every cell, the columns after Z named AA, AB ...', async () => {
        const row = Array.from({ length: 30 }, (_, i) => i);
        const { cell, worksheet } = await workbook({ rows: [row, row] });
        expect(cell('Z2')).not.toBeNull();
        expect(cell('AD3')?.querySelector('v')?.textContent).toBe('29');
        expect(worksheet.querySelector('autoFilter')?.getAttribute('ref')).toBe('A1:AD3');
    });

    it('expect the header row frozen: the pane under row 1, A2 the top left of the scrolling pane', async () => {
        const { worksheet } = await workbook({ rows: [['x']] });
        const pane = worksheet.querySelector('sheetView > pane');
        expect(pane?.getAttribute('ySplit')).toBe('1');
        expect(pane?.getAttribute('xSplit')).toBeNull();
        expect(pane?.getAttribute('topLeftCell')).toBe('A2');
        expect(pane?.getAttribute('activePane')).toBe('bottomLeft');
        expect(pane?.getAttribute('state')).toBe('frozen');
        expect(worksheet.querySelector('sheetView')?.getAttribute('workbookViewId')).toBe('0');
    });

    it('expect the autofilter and the dimension from A1 to the last column and the last row', async () => {
        const { worksheet, docs } = await workbook({
            rows: [
                ['a', 1, true],
                ['b', 2, false],
                ['c', 3, null]
            ]
        });
        expect(worksheet.querySelector('autoFilter')?.getAttribute('ref')).toBe('A1:C4');
        expect(worksheet.querySelector('dimension')?.getAttribute('ref')).toBe('A1:C4');
        // the hidden name Excel gives the autofilter's range
        const name = docs['xl/workbook.xml'].querySelector('definedName');
        expect(name?.getAttribute('name')).toBe('_xlnm._FilterDatabase');
        expect(name?.getAttribute('localSheetId')).toBe('0');
        expect(name?.getAttribute('hidden')).toBe('1');
        expect(name?.textContent).toBe("'Sheet1'!$A$1:$C$4");
    });

    it('expect the autofilter over the header row only when there are no rows', async () => {
        const { worksheet } = await workbook({ columns: [{ label: 'A' }, { label: 'B' }], rows: [] });
        expect(worksheet.querySelector('autoFilter')?.getAttribute('ref')).toBe('A1:B1');
        expect(worksheet.querySelectorAll('row').length).toBe(1);
    });

    it('expect no autofilter without columns, the header row still frozen', async () => {
        const { worksheet, docs } = await workbook({ columns: [], rows: [[], []] });
        expect(worksheet.querySelector('autoFilter')).toBeNull();
        expect(docs['xl/workbook.xml'].querySelector('definedNames')).toBeNull();
        expect(worksheet.querySelector('pane')?.getAttribute('state')).toBe('frozen');
        expect(worksheet.querySelector('dimension')?.getAttribute('ref')).toBe('A1');
    });

    it("expect the sheet name in the workbook and in the filter's range, a ' doubled, escaped", async () => {
        const { docs } = await workbook({ name: "Bob's & Ann's", rows: [['x']] });
        expect(docs['xl/workbook.xml'].querySelector('sheet')?.getAttribute('name')).toBe("Bob's & Ann's");
        expect(docs['xl/workbook.xml'].querySelector('definedName')?.textContent).toBe("'Bob''s & Ann''s'!$A$1:$A$2");
    });
});

describe('xlsx - column widths', () => {
    it("expect the standard's example: 61 px is 8 characters, the width 8.7109375", () => {
        expect(excelColumnWidth(61)).toBe(8.7109375);
        expect(excelColumnWidth(100)).toBe(14.28125);
    });

    it("expect every width from 0 to 1000 px to be that many px again by the standard's width to px formula", () => {
        // ECMA-376 Part 1, 18.3.1.13: px = Truncate(((256 * width + Truncate(128 / 7)) / 256) * 7)
        for (let px = 0; px <= 1000; px++) {
            const width = excelColumnWidth(px);
            expect(Math.trunc(((256 * width + Math.trunc(128 / 7)) / 256) * 7)).toBe(px);
        }
    });

    it('expect at least 0 and at most 255', () => {
        expect(excelColumnWidth(-100)).toBe(0);
        expect(excelColumnWidth(5000)).toBe(255);
    });

    it('expect a <col> per column with a width, none for a column without', async () => {
        const { worksheet } = await workbook({
            columns: [{ label: 'A', width: 61 }, { label: 'B' }, { label: 'C', width: 100 }],
            rows: []
        });
        const cols = Array.from(worksheet.querySelectorAll('cols > col'), (col) => [
            col.getAttribute('min'),
            col.getAttribute('max'),
            col.getAttribute('width'),
            col.getAttribute('customWidth')
        ]);
        expect(cols).toEqual([
            ['1', '1', '8.7109375', '1'],
            ['3', '3', '14.28125', '1']
        ]);
    });

    it('expect no <cols> when no column has a width: it needs a <col>', async () => {
        const { worksheet } = await workbook({ columns: [{ label: 'A' }], rows: [] });
        expect(worksheet.querySelector('cols')).toBeNull();
    });
});

describe('xlsx - the sheet name and the limits', () => {
    it.each(['Sheet1', 'Sales 2026', "Bob's sheet", 'a'.repeat(31), 'Ærø 😀', 'Historyx'])(
        'expect %j to be a sheet name',
        (name) => {
            expect(() => assertSheetName(name, 'test')).not.toThrow();
        }
    );

    it.each([
        ['', 'is a text of 1 to 31 characters'],
        [12, 'is a text of 1 to 31 characters'],
        [null, 'is a text of 1 to 31 characters'],
        ['a'.repeat(32), 'is at most 31 characters'],
        ['a[b', 'can not have any of'],
        ['a]b', 'can not have any of'],
        ['a:b', 'can not have any of'],
        ['a*b', 'can not have any of'],
        ['a?b', 'can not have any of'],
        ['a/b', 'can not have any of'],
        ['a\\b', 'can not have any of'],
        ["'a", "can not start or end with '"],
        ["a'", "can not start or end with '"],
        ['History', 'can not be History'],
        ['history', 'can not be History'],
        ['a\u0001b', 'can not have control characters']
    ])('expect a TypeError for the sheet name %j', (name, message) => {
        expect(() => assertSheetName(name, 'test')).toThrow(TypeError);
        expect(() => assertSheetName(name, 'test')).toThrow(message);
    });

    it('expect a RangeError for more columns or rows than a sheet holds', () => {
        const columns = Array.from({ length: 16_385 }, () => ({ label: 'x' }));
        expect(() => xlsxParts({ name: 'Sheet1', columns, rows: [] })).toThrow(RangeError);
        expect(() => xlsxParts({ name: 'Sheet1', columns: columns.slice(0, 1), rows: new Array(1_048_576).fill([]) })).toThrow(
            RangeError
        );
        expect(() => xlsxParts({ name: 'Sheet1', columns: columns.slice(0, 1), rows: new Array(10).fill([]) })).not.toThrow();
    });
});
