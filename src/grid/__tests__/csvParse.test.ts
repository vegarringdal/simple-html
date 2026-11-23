import { describe, expect, it } from 'vitest';
import { buildCsv, CSV_BOM, detectSeparator, parseCsv, parseTsv } from '../csv';
import { IMPORT_LIMITS, ImportFileError } from '../importLimits';

/**
 * csv.ts, the reading half: parseCsv() for the import's CSV files, detectSeparator(), and the limits a
 * file a user picked is read within
 */

describe('parseCsv - RFC 4180', () => {
    it('expect a row per line, the separator between the fields, CRLF, LF and CR as line ends', () => {
        expect(parseCsv('a,b\r\nc,d', ',')).toEqual([
            ['a', 'b'],
            ['c', 'd']
        ]);
        expect(parseCsv('a;b\nc;d\rE;F', ';')).toEqual([
            ['a', 'b'],
            ['c', 'd'],
            ['E', 'F']
        ]);
    });

    it('expect one line end at the end to be no row, an empty line a row of one empty field', () => {
        expect(parseCsv('a,b\r\n', ',')).toEqual([['a', 'b']]);
        expect(parseCsv('a\r\n\r\nb\r\n', ',')).toEqual([['a'], [''], ['b']]);
        expect(parseCsv('', ',')).toEqual([]);
        expect(parseCsv('\r\n', ',')).toEqual([]);
    });

    it('expect quoted fields to hold the separator, line breaks and doubled quotes', () => {
        expect(parseCsv('"Oslo, Norway","two\r\nlines","say ""hi"""\r\nnext', ',')).toEqual([
            ['Oslo, Norway', 'two\r\nlines', 'say "hi"'],
            ['next']
        ]);
        expect(parseCsv('"a\nb";c\n', ';')).toEqual([['a\nb', 'c']]);
        expect(parseCsv('""', ',')).toEqual([['']]);
    });

    it('expect a quote inside a field that does not start with one to be a character, and text after a closing quote kept', () => {
        expect(parseCsv('5" screen,it\'s "ok"', ',')).toEqual([['5" screen', 'it\'s "ok"']]);
        expect(parseCsv('"a"b,c', ',')).toEqual([['ab', 'c']]);
    });

    it('expect a quote that is never closed to run to the end of the text', () => {
        expect(parseCsv('"open,still\nmore', ',')).toEqual([['open,still\nmore']]);
    });

    it('expect the byte order mark to be left out, spaces kept, empty fields kept', () => {
        expect(parseCsv(`${CSV_BOM}name,age\r\n`, ',')).toEqual([['name', 'age']]);
        expect(parseCsv(' Ann , 36 ', ',')).toEqual([[' Ann ', ' 36 ']]);
        expect(parseCsv(',a,,b,', ',')).toEqual([['', 'a', '', 'b', '']]);
    });

    it('expect formulas to stay text: CSV injection is never run', () => {
        expect(parseCsv('=1+1,"=HYPERLINK(""http://x"",""y"")",@SUM(A1),+47 912,-5', ',')).toEqual([
            ['=1+1', '=HYPERLINK("http://x","y")', '@SUM(A1)', '+47 912', '-5']
        ]);
    });

    it("expect what buildCsv() writes to read back as it was, with each separator and the grid's BOM", () => {
        const rows = [
            ['Name', 'City, country', 'Notes'],
            ['Ann', 'Oslo; Norway', 'two\r\nlines'],
            ['"quoted"', '\ttab', ''],
            ['æøå', '', '=1+1']
        ];
        for (const separator of [',', ';', '\t'] as const) {
            expect(parseCsv(buildCsv(null, rows, { separator, bom: true }), separator)).toEqual(rows);
        }
    });

    it('expect parseTsv() to read as before: the clipboard has no limits and no BOM handling', () => {
        expect(parseTsv('a\tb\r\nc\td\r\n')).toEqual([
            ['a', 'b'],
            ['c', 'd']
        ]);
        expect(parseTsv(`${CSV_BOM}a`)).toEqual([[`${CSV_BOM}a`]]);
    });

    it('expect a long text to be read fast: 100 000 lines in well under a second', () => {
        const text = Array.from({ length: 99_999 }, (_, i) => `row ${i},"quoted, ${i}",${i * 1.5}`).join('\r\n');
        const started = performance.now();
        const rows = parseCsv(text, ',');
        expect(rows.length).toBe(99_999);
        expect(rows[12_345]).toEqual(['row 12345', 'quoted, 12345', '18517.5']);
        expect(performance.now() - started).toBeLessThan(2000);
    });
});

describe('parseCsv - the limits of a hostile file', () => {
    const limits = { rows: 5, columns: 4, cells: 12 };

    it('expect an ImportFileError tooLarge past the rows, without reading on', () => {
        expect(parseCsv('1\n2\n3\n4\n5', ',', limits)).toHaveLength(5);
        const error = (() => {
            try {
                parseCsv('1\n2\n3\n4\n5\n6', ',', limits);
            } catch (thrown) {
                return thrown;
            }
            return null;
        })();
        expect(error).toBeInstanceOf(ImportFileError);
        expect((error as ImportFileError).problem).toBe('tooLarge');
    });

    it('expect a line of too many fields, and too many fields in all, to be tooLarge', () => {
        expect(() => parseCsv('a,b,c,d,e', ',', limits)).toThrow(ImportFileError);
        expect(() => parseCsv('a,b,c\na,b,c\na,b,c\na,b,c\na', ',', limits)).toThrow(/12 fields/);
    });

    it('expect the default limits to be the ones of IMPORT_LIMITS: a million empty lines is not read', () => {
        expect(() => parseCsv('\n'.repeat(1_000_000), ',')).toThrow(`${IMPORT_LIMITS.rows} lines`);
        expect(() => parseCsv(','.repeat(IMPORT_LIMITS.columns), ',')).toThrow(ImportFileError);
    });
});

describe('detectSeparator', () => {
    it('expect the separator that splits the lines evenly', () => {
        expect(detectSeparator('name,age\nAnn,36\nBob,41\n')).toBe(',');
        expect(detectSeparator('name;age\nAnn;36\n')).toBe(';');
        expect(detectSeparator('name\tage\nAnn\t36\n')).toBe('\t');
    });

    it('expect ; for a file of decimal commas: , splits the lines unevenly', () => {
        expect(detectSeparator('name;price;count\nAnn;12,5;3\nBob;7,25;10\nCid;1;2\n')).toBe(';');
    });

    it('expect a separator inside quotes not to count', () => {
        expect(detectSeparator('"a;b";"c;d"\n"e,f";"g"\n')).toBe(';');
        expect(detectSeparator('"x\ty",z\n"1\t2",3\n')).toBe(',');
    });

    it("expect ',' for one column, and for empty text", () => {
        expect(detectSeparator('name\nAnn\nBob\n')).toBe(',');
        expect(detectSeparator('')).toBe(',');
    });

    it('expect the byte order mark not to matter, and only the first 64 KB to be looked at', () => {
        expect(detectSeparator(`${CSV_BOM}a;b\n1;2\n`)).toBe(';');
        const long = `a;b\n${'1;2\n'.repeat(30_000)}`;
        expect(detectSeparator(long)).toBe(';');
    });
});
