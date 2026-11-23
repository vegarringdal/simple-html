// @vitest-environment happy-dom

import { beforeAll, describe, expect, it } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import { GridInterface } from '../gridInterface';
import { openImportFile, readImportFile } from '../importFile';
import { IMPORT_LIMITS, ImportFileError } from '../importLimits';
import { buildXlsx } from '../xlsx';
import { zip } from '../zip';
import { stubCanvas } from './gridTestHelpers';

/**
 * importFile.ts, readImportFile(): what a file is (by its bytes, not its name), the encodings of a CSV
 * file, the sheet of a workbook, and the files it does not read. Then the grid's own exports read back:
 * getCsv() and getExcel() of a grid, imported into another, give the same rows
 */

beforeAll(() => {
    stubCanvas();
});

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

describe('readImportFile - CSV', () => {
    it('expect UTF-8 with or without its BOM, the separator found', async () => {
        const table = await readImportFile(new File(['﻿name;city\r\nÅse;Tromsø\r\n'], 'x.csv'));
        expect(table).toEqual({
            format: 'csv',
            sheets: [],
            sheet: 0,
            separator: ';',
            rows: [
                ['name', 'city'],
                ['Åse', 'Tromsø']
            ]
        });
        expect((await readImportFile(new Blob(['a,b\n1,2']))).rows).toEqual([
            ['a', 'b'],
            ['1', '2']
        ]);
    });

    it("expect Windows-1252 - Excel's CSV in Norwegian - when the bytes are not UTF-8", async () => {
        // 'Åse;Tromsø' in Windows-1252: Å is C5, ø is F8
        const bytes = new Uint8Array([0xc5, 0x73, 0x65, 0x3b, 0x54, 0x72, 0x6f, 0x6d, 0x73, 0xf8]);
        expect((await readImportFile(new Blob([bytes]))).rows).toEqual([['Åse', 'Tromsø']]);
    });

    it('expect UTF-16 by its byte order mark: Excel\'s "Unicode text", tab separated', async () => {
        const text = 'name\tage\r\nÅse\t36\r\n';
        const le = new Uint8Array(2 + text.length * 2);
        le.set([0xff, 0xfe]);
        for (let i = 0; i < text.length; i++) {
            le[2 + i * 2] = text.charCodeAt(i) & 0xff;
            le[3 + i * 2] = text.charCodeAt(i) >> 8;
        }
        const be = new Uint8Array(le.length);
        be.set([0xfe, 0xff]);
        for (let i = 2; i < le.length; i += 2) {
            be[i] = le[i + 1];
            be[i + 1] = le[i];
        }
        for (const bytes of [le, be]) {
            const table = await readImportFile(new Blob([bytes]));
            expect(table.separator).toBe('\t');
            expect(table.rows).toEqual([
                ['name', 'age'],
                ['Åse', '36']
            ]);
        }
    });

    it('expect the separator given to win', async () => {
        const table = await readImportFile(new Blob(['a;b,c\n']), { separator: ',' });
        expect(table.rows).toEqual([['a;b', 'c']]);
        await expect(readImportFile(new Blob(['a']), { separator: '|' as never })).rejects.toThrow(TypeError);
    });

    it('expect a binary file (a NUL), an .xls file and a file over the size limit not to be read', async () => {
        expect(await problemOf(readImportFile(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 1])])))).toBe('broken');
        const xls = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
        expect(await problemOf(readImportFile(new File([xls], 'old.xls')))).toBe('xls');
        // the size is checked before a byte is read
        const huge = new Blob([new Uint8Array(IMPORT_LIMITS.fileSize + 1)]);
        expect(await problemOf(readImportFile(huge))).toBe('tooLarge');
        expect(await problemOf(openImportFile(new Blob(['abcdef']), { ...IMPORT_LIMITS, fileSize: 5 }))).toBe('tooLarge');
    });
});

describe('readImportFile - Excel', () => {
    it('expect the first sheet by default, another by index or name - by its bytes, whatever its name', async () => {
        const bytes = await buildXlsx({ name: 'People', columns: [{ label: 'Name' }], rows: [['Ann']] });
        const table = await readImportFile(new File([bytes], 'people.csv'));
        expect(table).toEqual({ format: 'xlsx', sheets: ['People'], sheet: 0, separator: null, rows: [['Name'], ['Ann']] });
        expect((await readImportFile(new Blob([bytes]), { sheet: 'People' })).sheet).toBe(0);
        await expect(readImportFile(new Blob([bytes]), { sheet: 'Other' })).rejects.toThrow(RangeError);
        await expect(readImportFile(new Blob([bytes]), { sheet: 1 })).rejects.toThrow(RangeError);
    });

    it('expect a ZIP that is no workbook (an .ods, a .docx) to be broken', async () => {
        const ods = await zip([
            { name: 'mimetype', data: new TextEncoder().encode('application/vnd.oasis.opendocument.spreadsheet') }
        ]);
        expect(await problemOf(readImportFile(new Blob([ods])))).toBe('broken');
    });
});

describe('the grid exports, the grid imports', () => {
    interface Person {
        id: number;
        name: string;
        born: Date | null;
        age: number | null;
        price: number | null;
        active: boolean | null;
    }
    const people: Person[] = [
        { id: 1, name: 'Åse, "the first"', born: new Date(2001, 4, 17), age: 36, price: 1234.5, active: true },
        { id: 2, name: '=1+1', born: null, age: -3, price: 0.25, active: false },
        { id: 3, name: 'two\nlines', born: new Date(1999, 11, 31), age: null, price: null, active: null }
    ];
    const grid = () => {
        const datasource = new Datasource<Person>({
            key: 'id',
            fields: {
                id: 'number',
                born: 'date',
                age: 'number',
                price: { type: 'number', formatter: 'numberComma' },
                active: 'boolean'
            }
        });
        const gridInterface = new GridInterface<Person>(
            {
                readonly: false,
                layout: {
                    center: ['name', 'born', 'age', 'price', 'active'].map((field) => ({ fields: [field], width: 100 }))
                }
            },
            datasource
        );
        return { datasource, gridInterface };
    };
    const values = (rows: Person[]) =>
        rows.map(({ name, born, age, price, active }) => ({ name, born: born?.toDateString() ?? null, age, price, active }));

    it('expect getExcel() of a grid, imported by its header, to give the same values', async () => {
        const from = grid();
        from.datasource.setData(people.map((person) => ({ ...person })));
        const table = await readImportFile(await from.gridInterface.getExcel());
        const to = grid();
        to.datasource.setData([]);
        const result = to.gridInterface.importRows(table.rows, { header: true });
        expect(result.problems).toEqual([]);
        expect(values(result.rows)).toEqual(values(people));
    });

    for (const separator of [',', ';', '\t'] as const) {
        it(`expect getCsv() of a grid (separator ${JSON.stringify(separator)}), imported, to give the same values - a formula with its ' kept`, async () => {
            const from = grid();
            from.datasource.setData(people.map((person) => ({ ...person })));
            const table = await readImportFile(new Blob([from.gridInterface.getCsv({ separator, bom: true })]));
            expect(table.separator).toBe(separator);
            const to = grid();
            to.datasource.setData([]);
            const result = to.gridInterface.importRows(table.rows, { header: true });
            expect(result.problems).toEqual([]);
            // escapeFormulas: the CSV has '=1+1, and the import keeps the text as it is
            expect(values(result.rows)).toEqual(
                values(people.map((person) => (person.id === 2 ? { ...person, name: "'=1+1" } : person)))
            );
        });
    }
});
