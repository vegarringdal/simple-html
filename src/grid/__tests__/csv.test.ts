import { describe, expect, it } from 'vitest';
import { buildCsv, CSV_BOM, csvField, escapeFormula, rawValueText } from '../csv';

/**
 * The CSV text itself (RFC 4180), from plain inputs. What the grid puts in - rows, fields, labels,
 * formatting - is tested in gridCsv.test.ts.
 */

const NO_BOM = { separator: ',', bom: false } as const;

describe('csv - csvField: quoting (RFC 4180)', () => {
    it('expect plain text as it is', () => {
        expect(csvField('Ann', ',')).toBe('Ann');
        expect(csvField('', ',')).toBe('');
    });

    it('expect a value with the separator in quotes', () => {
        expect(csvField('Oslo, Norway', ',')).toBe('"Oslo, Norway"');
    });

    it('expect a double quote doubled, and the value in quotes', () => {
        expect(csvField('say "hi"', ',')).toBe('"say ""hi"""');
        expect(csvField('"', ',')).toBe('""""');
    });

    it('expect a value with CR, LF or CRLF in quotes, the line break kept', () => {
        expect(csvField('a\rb', ',')).toBe('"a\rb"');
        expect(csvField('a\nb', ',')).toBe('"a\nb"');
        expect(csvField('a\r\nb', ',')).toBe('"a\r\nb"');
    });

    it('expect leading and trailing spaces kept, without quotes (spaces are part of a field)', () => {
        expect(csvField('  Ann  ', ',')).toBe('  Ann  ');
    });

    it("expect ';' as separator: a value with ';' in quotes, one with ',' not", () => {
        expect(csvField('a;b', ';')).toBe('"a;b"');
        expect(csvField('12,5', ';')).toBe('12,5');
    });

    it('expect a tab separator: a value with a tab in quotes', () => {
        expect(csvField('a\tb', '\t')).toBe('"a\tb"');
        expect(csvField('a,b', '\t')).toBe('a,b');
    });
});

describe('csv - buildCsv', () => {
    it('expect the header line first, every line ended with CRLF', () => {
        const text = buildCsv(
            ['Name', 'Age'],
            [
                ['Ann', '30'],
                ['Bob', '40']
            ],
            NO_BOM
        );
        expect(text).toBe('Name,Age\r\nAnn,30\r\nBob,40\r\n');
    });

    it('expect no header line for null', () => {
        expect(buildCsv(null, [['Ann', '30']], NO_BOM)).toBe('Ann,30\r\n');
    });

    it('expect the header only when there are no rows', () => {
        expect(buildCsv(['Name', 'Age'], [], NO_BOM)).toBe('Name,Age\r\n');
        expect(buildCsv(null, [], NO_BOM)).toBe('');
    });

    it('expect empty values as nothing between the separators', () => {
        expect(buildCsv(null, [['', 'b', '']], NO_BOM)).toBe(',b,\r\n');
    });

    it('expect a record of one empty field as "" - an empty line is read as no field at all', () => {
        expect(buildCsv(['Name'], [['Ann'], [''], ['Bob']], NO_BOM)).toBe('Name\r\nAnn\r\n""\r\nBob\r\n');
    });

    it('expect no fields to give no lines', () => {
        expect(buildCsv([], [[], []], NO_BOM)).toBe('');
        expect(buildCsv([], [[], []], { separator: ',', bom: true })).toBe(CSV_BOM);
    });

    it('expect the fields quoted where they need it, the labels too', () => {
        const text = buildCsv(
            ['Name, first', 'Note'],
            [
                ['Ann', 'line 1\r\nline 2'],
                ['"Bob"', 'x']
            ],
            NO_BOM
        );
        expect(text).toBe('"Name, first",Note\r\nAnn,"line 1\r\nline 2"\r\n"""Bob""",x\r\n');
    });

    it("expect ';' between the fields", () => {
        const text = buildCsv(['Name', 'Price'], [['Ann; Bob', '12,5']], { separator: ';', bom: false });
        expect(text).toBe('Name;Price\r\n"Ann; Bob";12,5\r\n');
    });

    it('expect unicode as it is: æøå, emoji, CJK', () => {
        const text = buildCsv(['Navn'], [['Ærlig Østby Åse'], ['😀'], ['東京']], NO_BOM);
        expect(text).toBe('Navn\r\nÆrlig Østby Åse\r\n😀\r\n東京\r\n');
    });

    it('expect the BOM (U+FEFF) first with bom, and not without it', () => {
        expect(CSV_BOM).toBe('﻿');
        expect(buildCsv(['Navn'], [['Åse']], { separator: ',', bom: true })).toBe('﻿Navn\r\nÅse\r\n');
        expect(buildCsv(['Navn'], [['Åse']], NO_BOM).startsWith('﻿')).toBe(false);
    });

    it('expect the BOM to be the bytes EF BB BF in UTF-8', () => {
        expect(Array.from(new TextEncoder().encode(CSV_BOM))).toEqual([0xef, 0xbb, 0xbf]);
    });

    it('expect the texts not to be escaped by buildCsv - that is done before', () => {
        expect(buildCsv(null, [['=1+1']], NO_BOM)).toBe('=1+1\r\n');
    });
});

describe('csv - escapeFormula (OWASP CSV injection)', () => {
    it.each([
        ['=1+1', "'=1+1"],
        ['+1', "'+1"],
        ['-1', "'-1"],
        ['@SUM(A1)', "'@SUM(A1)"],
        ['\tx', "'\tx"],
        ['\rx', "'\rx"],
        ['\nx', "'\nx"],
        ['＝1+1', "'＝1+1"],
        ['＋1', "'＋1"],
        ['－1', "'－1"],
        ['＠x', "'＠x"]
    ])('expect %j to get a quote in front', (text, escaped) => {
        expect(escapeFormula(text)).toBe(escaped);
    });

    it('expect other text as it is, a formula character later in the text too', () => {
        expect(escapeFormula('Ann')).toBe('Ann');
        expect(escapeFormula('')).toBe('');
        expect(escapeFormula('a=b')).toBe('a=b');
        expect(escapeFormula(' =1')).toBe(' =1');
        expect(escapeFormula("'=1")).toBe("'=1");
    });

    it('expect an escaped value with the separator still quoted by buildCsv', () => {
        expect(buildCsv(null, [[escapeFormula('=HYPERLINK("x","y")')]], NO_BOM)).toBe('"\'=HYPERLINK(""x"",""y"")"\r\n');
    });
});

describe('csv - rawValueText', () => {
    it('expect blanks as nothing: null, undefined, an invalid Date', () => {
        expect(rawValueText(null)).toBe('');
        expect(rawValueText(undefined)).toBe('');
        expect(rawValueText('')).toBe('');
        expect(rawValueText(new Date('not a date'))).toBe('');
    });

    it('expect a Date as an ISO string (UTC)', () => {
        expect(rawValueText(new Date(Date.UTC(2026, 10, 20, 8, 15)))).toBe('2026-11-20T08:15:00.000Z');
    });

    it('expect a number with a dot, a boolean as true/false, text as it is', () => {
        expect(rawValueText(12.5)).toBe('12.5');
        expect(rawValueText(-5)).toBe('-5');
        expect(rawValueText(0)).toBe('0');
        expect(rawValueText(true)).toBe('true');
        expect(rawValueText(false)).toBe('false');
        expect(rawValueText('  Ann ')).toBe('  Ann ');
    });
});
