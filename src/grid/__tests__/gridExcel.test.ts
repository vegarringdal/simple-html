// @vitest-environment happy-dom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import { where } from '../../datasource/filterExpression';
import type { GridConfig } from '../gridConfig';
import { REVOKE_URL_AFTER_MS } from '../gridFunctions/gridCsv';
import { GridInterface } from '../gridInterface';
import { MENU_IDS } from '../gridMenus';
import { registerLookup } from '../lookup';
import { excelColumnWidth, XLSX_MIME } from '../xlsx';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { menuEntry, openRowMenu } from './interactionTestHelpers';
import { parseXml, readParts } from './zipTestHelpers';

/**
 * gridInterface.getExcel() and downloadExcel(): which rows and fields, the labels and widths, the
 * typed values, the option checks, the download and the row menu's Export entries. The workbook
 * itself (the XML, the cells, the ZIP) is tested in xlsx.test.ts and zip.test.ts.
 */

// local dates: a time zone with summer time. Node reads TZ again when it is set
const originalTimeZone = process.env.TZ;
beforeAll(() => {
    process.env.TZ = 'Europe/Oslo';
    stubCanvas();
    stubElementSizes();
});
afterAll(() => {
    // process.env holds text: undefined would be the TZ 'undefined'
    if (originalTimeZone === undefined) {
        delete process.env.TZ;
    } else {
        process.env.TZ = originalTimeZone;
    }
});

beforeEach(() => {
    document.body.innerHTML = '';
});

const columns = (...names: string[]): GridConfig => ({
    layout: { center: names.map((name) => ({ fields: [name], width: 100 })) }
});

const people = () => [
    { name: 'Ann', country: 'Norway', age: 30 },
    { name: 'Bob', country: 'Sweden', age: 20 },
    { name: 'Cid', country: 'Norway', age: 50 },
    { name: 'Dan', country: 'Sweden', age: 40 },
    { name: 'Eve', country: 'Denmark', age: 10 }
];

const peopleFields: DatasourceOptions = { fields: { age: 'number' } };

/**
 * selects the rows with these names, by the row keys the selection keeps
 */
const selectNames = (datasource: Datasource, ...names: string[]) => {
    const keys = datasource
        .getAllData()
        .filter((row) => names.includes(row.name))
        .map((row) => row.__KEY);
    datasource.getSelection().setSelectedKeys(keys);
};

/**
 * The sheet of an .xlsx blob, read back: the rows as values (text, number, boolean, null for no
 * cell), the number format of a cell, the column widths, the sheet name, the XML
 */
async function readSheet(blob: Blob) {
    const parts = readParts(new Uint8Array(await blob.arrayBuffer()));
    const sheet = parseXml(parts['xl/worksheets/sheet1.xml']);
    const styles = parseXml(parts['xl/styles.xml']);
    const workbook = parseXml(parts['xl/workbook.xml']);

    const column = (reference: string) =>
        Array.from(/^[A-Z]+/.exec(reference)?.[0] ?? '').reduce((n, letter) => n * 26 + letter.charCodeAt(0) - 64, 0) - 1;
    const rowElements = Array.from(sheet.querySelectorAll('sheetData > row'));
    const width = Math.max(
        0,
        ...rowElements.flatMap((row) => Array.from(row.children, (c) => column(c.getAttribute('r') ?? '') + 1))
    );
    const rows = rowElements.map((row) => {
        const values: (string | number | boolean | null)[] = new Array(width).fill(null);
        for (const c of Array.from(row.children)) {
            const type = c.getAttribute('t');
            const v = c.querySelector('v')?.textContent ?? '';
            values[column(c.getAttribute('r') ?? '')] =
                type === 'inlineStr' ? (c.querySelector('is > t')?.textContent ?? '') : type === 'b' ? v === '1' : Number(v);
        }
        return values;
    });

    /** the number format code of a cell, General for none */
    const formatOf = (reference: string) => {
        const index = Number(sheet.querySelector(`c[r="${reference}"]`)?.getAttribute('s') ?? 0);
        const numFmtId = styles.querySelectorAll('cellXfs > xf')[index].getAttribute('numFmtId');
        return numFmtId === '0' ? 'General' : styles.querySelector(`numFmt[numFmtId="${numFmtId}"]`)?.getAttribute('formatCode');
    };

    const widths = Array.from(sheet.querySelectorAll('cols > col'), (col) => [
        Number(col.getAttribute('min')),
        Number(col.getAttribute('width'))
    ]);
    const sheetName = workbook.querySelector('sheet')?.getAttribute('name');
    return { parts, sheet, rows, formatOf, widths, sheetName };
}

/** the rows of the grid's Excel file */
const excelRows = async (gridInterface: GridInterface<any>, options = {}) =>
    (await readSheet(await gridInterface.getExcel(options))).rows;

describe('getExcel - rows', () => {
    it('expect the header row, then every row, the columns of the layout', async () => {
        const { gridInterface } = await mountGrid(columns('name', 'age'), people(), peopleFields);
        expect(await excelRows(gridInterface)).toEqual([
            ['Name', 'Age'],
            ['Ann', 30],
            ['Bob', 20],
            ['Cid', 50],
            ['Dan', 40],
            ['Eve', 10]
        ]);
    });

    it("expect 'all' to follow the filter and the sort", async () => {
        const { gridInterface, datasource } = await mountGrid(columns('name', 'age'), people(), peopleFields);
        datasource.filter(where('age', 'GREATER_THAN', 15));
        datasource.sort({ attribute: 'age', ascending: false });

        const rows = await excelRows(gridInterface);
        expect(rows.map((row) => row[0])).toEqual(['Name', 'Cid', 'Dan', 'Ann', 'Bob']);
        expect(await excelRows(gridInterface, { rows: 'all' })).toEqual(rows);
    });

    it('expect a flat list when grouped: every data row in the grouped order, collapsed groups too, no group rows', async () => {
        const { gridInterface, datasource } = await mountGrid(columns('name', 'country'), people(), peopleFields);
        gridInterface.setState({ grouping: [{ attribute: 'country', title: 'Country' }], expandedGroups: ['Norway'] });
        // Denmark and Sweden are collapsed: their rows are not displayed, the group rows are
        expect(datasource.getRows().filter((row) => '__group' in row).length).toBe(3);
        expect(datasource.getRows().filter((row) => !('__group' in row)).length).toBe(2);

        const { rows, sheet, parts } = await readSheet(await gridInterface.getExcel());
        expect(rows).toEqual([
            ['Name', 'Country'],
            ['Eve', 'Denmark'],
            ['Ann', 'Norway'],
            ['Cid', 'Norway'],
            ['Bob', 'Sweden'],
            ['Dan', 'Sweden']
        ]);
        // no outline, no group levels, no totals row: a row per data row, the autofilter over them all
        expect(parts['xl/worksheets/sheet1.xml']).not.toMatch(/outline|<f[ >]/i);
        expect(sheet.querySelectorAll('row[hidden], row[collapsed]').length).toBe(0);
        expect(sheet.querySelector('autoFilter')?.getAttribute('ref')).toBe('A1:B6');
    });

    it("expect 'selected': the selected rows in the order of the rows, the header only when none is", async () => {
        const { gridInterface, datasource } = await mountGrid(columns('name', 'age'), people(), peopleFields);
        expect(await excelRows(gridInterface, { rows: 'selected' })).toEqual([['Name', 'Age']]);

        selectNames(datasource, 'Dan', 'Ann');
        datasource.sort({ attribute: 'age', ascending: false });
        expect(await excelRows(gridInterface, { rows: 'selected' })).toEqual([
            ['Name', 'Age'],
            ['Dan', 40],
            ['Ann', 30]
        ]);
    });

    it("expect 'selected' to leave out a selected row the filter or a collapsed group hides, as getSelectedRows() does", async () => {
        const { gridInterface, datasource } = await mountGrid(columns('name', 'country'), people(), peopleFields);
        selectNames(datasource, 'Ann', 'Bob', 'Eve');
        datasource.filter(where('name', 'NOT_EQUAL_TO', 'Eve'));
        gridInterface.setState({ grouping: [{ attribute: 'country', title: 'Country' }], expandedGroups: ['Norway'] });

        expect(await excelRows(gridInterface, { rows: 'selected' })).toEqual([
            ['Name', 'Country'],
            ['Ann', 'Norway']
        ]);
    });

    it('expect no totals row and no group aggregates: a flat list of the data rows, grouped or not', async () => {
        const config: GridConfig = {
            ...columns('name', 'country', 'age'),
            totalsRow: true,
            columns: { age: { aggregate: 'sum' }, name: { aggregate: 'count' } }
        };
        const { element, gridInterface } = await mountGrid(config, people(), peopleFields);
        // the grid shows the totals row
        expect(element.querySelector('.simple-html-grid-totals')).not.toBeNull();

        const all = await excelRows(gridInterface);
        expect(all.length).toBe(6);
        expect(all.at(-1)).toEqual(['Eve', 'Denmark', 10]);

        // grouped: the group rows carry the aggregates in the grid, not in the file
        gridInterface.setState({ grouping: [{ attribute: 'country', title: 'Country' }], expandedGroups: [] });
        const { rows, parts } = await readSheet(await gridInterface.getExcel());
        expect(rows).toEqual([
            ['Name', 'Country', 'Age'],
            ['Eve', 'Denmark', 10],
            ['Ann', 'Norway', 30],
            ['Cid', 'Norway', 50],
            ['Bob', 'Sweden', 20],
            ['Dan', 'Sweden', 40]
        ]);
        expect(parts['xl/worksheets/sheet1.xml']).not.toMatch(/outline|<f[ >]/i);
    });

    it("expect 'range': the cells of the last range of cells, its fields with their labels and widths", async () => {
        const config: GridConfig = {
            layout: {
                center: [
                    { fields: ['name'], width: 100 },
                    { fields: ['country'], width: 120 },
                    { fields: ['age'], width: 70 }
                ]
            }
        };
        const { gridInterface } = await mountGrid(config, people(), peopleFields);
        // no range: no columns, no rows - as the CSV export gives an empty text
        expect(await excelRows(gridInterface, { rows: 'range' })).toEqual([[]]);

        gridInterface.setRanges([
            { fromRow: 0, fromField: 'name', toRow: 0, toField: 'name' },
            { fromRow: 3, fromField: 'age', toRow: 1, toField: 'country' }
        ]);
        const { rows, widths } = await readSheet(await gridInterface.getExcel({ rows: 'range' }));
        expect(rows).toEqual([
            ['Country', 'Age'],
            ['Sweden', 20],
            ['Norway', 50],
            ['Sweden', 40]
        ]);
        expect(widths).toEqual([
            [1, excelColumnWidth(120)],
            [2, excelColumnWidth(70)]
        ]);
        expect(await excelRows(gridInterface, { rows: 'range', fields: ['name'] })).toEqual([
            ['Name'],
            ['Bob'],
            ['Cid'],
            ['Dan']
        ]);
    });

    it("expect 'range' to leave out a group row in the range", async () => {
        const { gridInterface } = await mountGrid(columns('name', 'country'), people(), peopleFields);
        gridInterface.setState({
            grouping: [{ attribute: 'country', title: 'Country' }],
            expandedGroups: ['Denmark', 'Norway', 'Sweden']
        });
        // the Denmark group row, Eve, the Norway group row, Ann
        gridInterface.setRanges([{ fromRow: 0, fromField: 'name', toRow: 3, toField: 'country' }]);
        expect(await excelRows(gridInterface, { rows: 'range' })).toEqual([
            ['Name', 'Country'],
            ['Eve', 'Denmark'],
            ['Ann', 'Norway']
        ]);
    });

    it('expect a row marked for deletion exported: it is a row of the grid until it is saved', async () => {
        const { gridInterface, datasource } = await mountGrid(
            { ...columns('name'), readonly: false },
            people().slice(0, 2),
            peopleFields
        );
        datasource.markForDeletion([datasource.getDataRows()[0]]);
        expect(await excelRows(gridInterface)).toEqual([['Name'], ['Ann'], ['Bob']]);
    });
});

describe('getExcel - fields, labels and widths', () => {
    it('expect the layout order: pinned left, center, pinned right, a column per stacked field, each as wide as its column', async () => {
        const config: GridConfig = {
            layout: {
                left: [{ fields: ['name'], width: 150 }],
                center: [
                    { fields: ['age', 'country'], width: 80 },
                    { fields: ['city'], width: 120 }
                ],
                right: [{ fields: ['id'], width: 60 }]
            }
        };
        const { gridInterface } = await mountGrid(config, [{ id: 1, name: 'Ann', age: 30, country: 'Norway', city: 'Oslo' }], {
            fields: { id: 'number', age: 'number' }
        });
        const { rows, widths } = await readSheet(await gridInterface.getExcel());
        expect(rows).toEqual([
            ['Name', 'Age', 'Country', 'City', 'Id'],
            ['Ann', 30, 'Norway', 'Oslo', 1]
        ]);
        expect(widths).toEqual([
            [1, excelColumnWidth(150)],
            [2, excelColumnWidth(80)],
            [3, excelColumnWidth(80)],
            [4, excelColumnWidth(120)],
            [5, excelColumnWidth(60)]
        ]);
    });

    it('expect the hidden columns left out: in the config but not in the layout, or hidden since', async () => {
        const config: GridConfig = { ...columns('name', 'age', 'country'), columns: { phone: {} } };
        const { gridInterface } = await mountGrid(
            config,
            [{ name: 'Ann', age: 30, country: 'Norway', phone: '123' }],
            peopleFields
        );
        expect((await excelRows(gridInterface))[0]).toEqual(['Name', 'Age', 'Country']);

        // the user hides age
        gridInterface.setState({ layout: columns('name', 'country').layout });
        expect(await excelRows(gridInterface)).toEqual([
            ['Name', 'Country'],
            ['Ann', 'Norway']
        ]);
    });

    it("expect the fields option: these fields in this order; one that is not in the grid has Excel's default width", async () => {
        const config: GridConfig = { ...columns('name', 'age'), columns: { phone: {} } };
        const { gridInterface } = await mountGrid(
            config,
            [{ name: 'Ann', age: 30, phone: '123', email: 'ann@x.no' }],
            peopleFields
        );
        const { rows, widths } = await readSheet(await gridInterface.getExcel({ fields: ['email', 'name', 'phone'] }));
        expect(rows).toEqual([
            ['Email', 'Name', 'Phone'],
            ['ann@x.no', 'Ann', '123']
        ]);
        expect(widths).toEqual([[2, excelColumnWidth(100)]]);
    });

    it('expect the labels the header shows: the column label, else the field label, else the name prettified', async () => {
        const config: GridConfig = { ...columns('name', 'country', 'first_name'), columns: { name: { label: 'Full name' } } };
        const { element, gridInterface } = await mountGrid(config, [{ name: 'Ann', country: 'Norway', first_name: 'A' }], {
            fields: { name: { label: 'not this one' }, country: { label: 'Land' } }
        });
        const header = (await excelRows(gridInterface))[0];
        expect(header).toEqual(['Full name', 'Land', 'First Name']);
        const shown = ['name', 'country', 'first_name'].map((field) =>
            element.querySelector(`[data-attribute-header="${field}"]`)?.textContent?.trim()
        );
        expect(header).toEqual(shown);
    });

    it('expect the sheet name option, Sheet1 by default', async () => {
        const { gridInterface } = await mountGrid(columns('name'), people(), peopleFields);
        expect((await readSheet(await gridInterface.getExcel())).sheetName).toBe('Sheet1');
        expect((await readSheet(await gridInterface.getExcel({ sheetName: 'Bob’s people' }))).sheetName).toBe('Bob’s people');
    });

    it('expect a sheet without columns for no fields: no autofilter, the header row empty', async () => {
        const { gridInterface } = await mountGrid(columns('name'), people(), peopleFields);
        const { rows, sheet } = await readSheet(await gridInterface.getExcel({ fields: [] }));
        expect(rows.length).toBe(6);
        expect(rows.every((row) => row.length === 0)).toBe(true);
        expect(sheet.querySelector('autoFilter')).toBeNull();
    });
});

describe('getExcel - typed values', () => {
    const fields: DatasourceOptions = {
        fields: {
            born: 'date',
            seen: 'datetime',
            price: { type: 'number', formatter: 'numberComma' },
            active: 'boolean',
            age: 'number',
            note: { multiline: true }
        }
    };
    const config = () => columns('name', 'born', 'seen', 'price', 'active', 'age', 'note');

    it('expect numbers as numbers (not the formatted 12,5), dates as serial dates, booleans, text', async () => {
        const rows = [
            {
                name: 'Ann',
                born: new Date(2001, 4, 17, 13, 45),
                seen: new Date(2026, 10, 20, 18, 0, 30),
                price: 12.5,
                active: true,
                age: 30,
                note: 'line 1\nline 2'
            },
            { name: null, born: null, seen: undefined, price: null, active: false, age: undefined, note: '' }
        ];
        const { gridInterface } = await mountGrid(config(), rows, fields);
        const sheet = await readSheet(await gridInterface.getExcel());
        expect(sheet.rows).toEqual([
            ['Name', 'Born', 'Seen', 'Price', 'Active', 'Age', 'Note'],
            ['Ann', 37028, 46346 + (18 * 3600 + 30) / 86400, 12.5, true, 30, 'line 1\nline 2'],
            [null, null, null, null, false, null, null]
        ]);
        expect(sheet.formatOf('B2')).toBe('yyyy-mm-dd');
        expect(sheet.formatOf('C2')).toBe('yyyy-mm-dd hh:mm:ss');
        expect(sheet.formatOf('D2')).toBe('General');
        expect(sheet.formatOf('F2')).toBe('General');
    });

    it('expect the local date the grid shows on a day summer time starts, at midnight and at 23:30', async () => {
        const { gridInterface, datasource } = await mountGrid(
            columns('born', 'seen'),
            [{ born: new Date(2026, 2, 29), seen: new Date(2026, 2, 29, 23, 30) }],
            fields
        );
        expect(datasource.getFormatter('born').format(new Date(2026, 2, 29))).toBe('2026-03-29');
        expect((await excelRows(gridInterface))[1]).toEqual([46110, 46110 + 23.5 / 24]);
    });

    it('expect day first for the DDMMYYYY formatters, as the grid shows the dates', async () => {
        const { gridInterface } = await mountGrid(
            columns('born', 'seen'),
            [{ born: new Date(2026, 10, 20), seen: new Date(2026, 10, 20) }],
            {
                fields: {
                    born: { type: 'date', formatter: 'dateDDMMYYYY' },
                    seen: { type: 'datetime', formatter: 'datetimeDDMMYYYY' }
                }
            }
        );
        const sheet = await readSheet(await gridInterface.getExcel());
        expect(sheet.formatOf('A2')).toBe('dd\\.mm\\.yyyy');
        expect(sheet.formatOf('B2')).toBe('dd\\.mm\\.yyyy hh:mm:ss');
    });

    it('expect a value that is not of its type written as the text the cell shows', async () => {
        const { gridInterface } = await mountGrid(
            columns('age', 'born', 'active', 'name'),
            [
                // text in a number field, a date string in a date field, a number in a boolean field
                { age: '12', born: '2026-11-20', active: 1, name: 30 },
                // a date before 1900: Excel can not hold it, the text the cell shows; an invalid Date is blank
                { age: Number.NaN, born: new Date(1899, 11, 31), active: null, name: true }
            ],
            { fields: { age: 'number', born: 'date', active: 'boolean' } }
        );
        expect((await excelRows(gridInterface)).slice(1)).toEqual([
            ['12', '2026-11-20', '1', '30'],
            [null, '1899-12-31', null, 'true']
        ]);

        const { gridInterface: invalid } = await mountGrid(columns('born'), [{ born: new Date(Number.NaN) }], fields);
        expect((await excelRows(invalid))[1]).toEqual([null]);
    });

    it("expect a column's numberOverride, as the cells show it: BLANK_TO_ZERO a 0, ZERO_TO_BLANK no cell", async () => {
        const overrides: GridConfig = {
            ...columns('blank', 'zero'),
            columns: { blank: { numberOverride: 'BLANK_TO_ZERO' }, zero: { numberOverride: 'ZERO_TO_BLANK' } }
        };
        const { gridInterface } = await mountGrid(
            overrides,
            [
                { blank: null, zero: 0 },
                { blank: 5, zero: 7 }
            ],
            { fields: { blank: 'number', zero: 'number' } }
        );
        expect(await excelRows(gridInterface)).toEqual([
            ['Blank', 'Zero'],
            [0, null],
            [5, 7]
        ]);
    });

    it('expect a dynamicCellTypeColumn cell typed by its row', async () => {
        const dynamic: GridConfig = { ...columns('value'), columns: { value: { dynamicCellTypeColumn: 'type' } } };
        const { gridInterface } = await mountGrid(dynamic, [
            { value: new Date(2026, 10, 20), type: 'date' },
            { value: 12.5, type: 'number' },
            { value: true, type: 'boolean' },
            { value: 'text', type: 'text' },
            { value: 12.5, type: 'nonsense' }
        ]);
        const sheet = await readSheet(await gridInterface.getExcel());
        expect(sheet.rows.slice(1)).toEqual([[46346], [12.5], [true], ['text'], ['12.5']]);
        expect(sheet.formatOf('A2')).toBe('yyyy-mm-dd');
    });

    it('expect a formula a user typed written as text', async () => {
        const { gridInterface } = await mountGrid(columns('name'), [{ name: '=HYPERLINK("http://x","y")' }]);
        const { rows, parts } = await readSheet(await gridInterface.getExcel());
        expect(rows[1]).toEqual(['=HYPERLINK("http://x","y")']);
        expect(parts['xl/worksheets/sheet1.xml']).not.toMatch(/<f[ >]/);
    });
});

describe('getExcel - live values and without a connected grid', () => {
    it('expect the values when it is called: an edit before is in the file, one after is not', async () => {
        const { gridInterface, datasource } = await mountGrid(
            { ...columns('name', 'age'), readonly: false },
            people().slice(0, 1),
            peopleFields
        );
        const row = datasource.getDataRows()[0];
        row.age = 31;
        const file = gridInterface.getExcel();
        // while the file is zipped
        row.age = 32;
        expect((await readSheet(await file)).rows[1]).toEqual(['Ann', 31]);
        expect((await excelRows(gridInterface))[1]).toEqual(['Ann', 32]);
    });

    it('expect the same file from an interface that is not on the page', async () => {
        const config: GridConfig = {
            layout: { left: [{ fields: ['name'], width: 100 }], center: [{ fields: ['age', 'country'], width: 100 }] },
            columns: { name: { label: 'Who' } }
        };
        const datasource = new Datasource({ fields: { age: 'number', country: { label: 'Land' } } });
        datasource.setData(people());
        const gridInterface = new GridInterface(config, datasource);
        datasource.sort({ attribute: 'age', ascending: true });

        const rows = await excelRows(gridInterface);
        expect(rows.slice(0, 3)).toEqual([
            ['Who', 'Age', 'Land'],
            ['Eve', 10, 'Denmark'],
            ['Bob', 20, 'Sweden']
        ]);

        const { gridInterface: mounted, datasource: mountedDatasource } = await mountGrid(config, people(), {
            fields: { age: 'number', country: { label: 'Land' } }
        });
        mountedDatasource.sort({ attribute: 'age', ascending: true });
        expect(await excelRows(mounted)).toEqual(rows);
    });
});

describe('getExcel - options', () => {
    it('expect a Blob of the .xlsx type', async () => {
        const { gridInterface } = await mountGrid(columns('name'), people());
        const blob = await gridInterface.getExcel();
        expect(blob.type).toBe(XLSX_MIME);
        expect(XLSX_MIME).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });

    it.each([
        [true, 'takes an options object in v6, not a boolean'],
        [null, 'takes an options object'],
        [['rows'], 'takes an options object'],
        [{ row: 'selected' }, "unknown option 'row'"],
        [{ header: false }, "unknown option 'header' (an Excel file always has the header row)"],
        [{ formatted: true }, "unknown option 'formatted'"],
        [{ separator: ';' }, "unknown option 'separator'"],
        [{ rows: 'some' }, `rows is 'all', 'selected' or 'range', got "some"`],
        [{ fields: 'name' }, 'fields is a list of field names'],
        [{ fields: ['name', 1] }, 'fields is a list of field names'],
        [{ sheetName: 'a/b' }, 'the sheet name can not have any of'],
        [{ sheetName: 'x'.repeat(32) }, 'the sheet name is at most 31 characters'],
        [{ sheetName: '' }, 'the sheet name is a text of 1 to 31 characters']
    ])('expect a TypeError (a rejected promise) for %j', async (options, message) => {
        const { gridInterface } = await mountGrid(columns('name'), people());
        await expect(gridInterface.getExcel(options as any)).rejects.toThrow(TypeError);
        await expect(gridInterface.getExcel(options as any)).rejects.toThrow(message);
        await expect(gridInterface.downloadExcel('export.xlsx', options as any)).rejects.toThrow(message);
    });

    it('expect undefined options to be the defaults', async () => {
        const { gridInterface } = await mountGrid(columns('name'), people().slice(0, 1));
        expect(await excelRows(gridInterface, { rows: undefined, fields: undefined, sheetName: undefined })).toEqual(
            await excelRows(gridInterface)
        );
    });
});

describe('downloadExcel', () => {
    let blobs: Blob[];
    let clicked: { href: string; download: string; connected: boolean }[];
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;

    beforeEach(() => {
        blobs = [];
        clicked = [];
        URL.createObjectURL = vi.fn((blob: Blob) => {
            blobs.push(blob);
            return `blob:test-${blobs.length}`;
        });
        URL.revokeObjectURL = vi.fn();
        // happy-dom would open the blob url in the window
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
            clicked.push({ href: this.getAttribute('href') ?? '', download: this.download, connected: this.isConnected });
        });
    });

    afterEach(() => {
        URL.createObjectURL = originalCreate;
        URL.revokeObjectURL = originalRevoke;
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('expect an .xlsx blob downloaded by clicking a link with the default filename, not put in the page', async () => {
        const { gridInterface } = await mountGrid(columns('name', 'age'), [{ name: 'Åse', age: 30 }], peopleFields);
        await gridInterface.downloadExcel();

        expect(blobs.length).toBe(1);
        expect(blobs[0].type).toBe(XLSX_MIME);
        expect((await readSheet(blobs[0])).rows).toEqual([
            ['Name', 'Age'],
            ['Åse', 30]
        ]);
        expect(clicked).toEqual([{ href: 'blob:test-1', download: 'export.xlsx', connected: false }]);
        expect(document.querySelector('a[download]')).toBeNull();
    });

    it('expect the object URL freed after a while, not before the download started', async () => {
        const { gridInterface } = await mountGrid(columns('name'), people());
        // only setTimeout: the zipping must run
        vi.useFakeTimers({ toFake: ['setTimeout'] });
        await gridInterface.downloadExcel();
        expect(clicked.length).toBe(1);
        expect(URL.revokeObjectURL).not.toHaveBeenCalled();

        vi.advanceTimersByTime(REVOKE_URL_AFTER_MS);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-1');
    });

    it('expect the filename and the options', async () => {
        const { gridInterface, datasource } = await mountGrid(columns('name', 'age'), people(), peopleFields);
        selectNames(datasource, 'Bob');
        await gridInterface.downloadExcel('selected.xlsx', { rows: 'selected', sheetName: 'Bob' });

        expect(clicked[0].download).toBe('selected.xlsx');
        const sheet = await readSheet(blobs[0]);
        expect(sheet.rows).toEqual([
            ['Name', 'Age'],
            ['Bob', 20]
        ]);
        expect(sheet.sheetName).toBe('Bob');
    });

    it('expect a TypeError when the options are given where the filename goes', async () => {
        const { gridInterface } = await mountGrid(columns('name'), people());
        await expect(gridInterface.downloadExcel({ rows: 'selected' } as any)).rejects.toThrow(TypeError);
        await expect(gridInterface.downloadExcel({ rows: 'selected' } as any)).rejects.toThrow('the filename comes first');
        await expect(gridInterface.downloadExcel('')).rejects.toThrow(TypeError);
        expect(blobs.length).toBe(0);
        expect(clicked.length).toBe(0);
    });
});

describe('the row menu - Export', () => {
    let blobs: Blob[];
    let downloads: string[];
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;

    beforeEach(() => {
        blobs = [];
        downloads = [];
        URL.createObjectURL = vi.fn((blob: Blob) => {
            blobs.push(blob);
            return `blob:test-${blobs.length}`;
        });
        URL.revokeObjectURL = vi.fn();
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
            downloads.push(this.download);
        });
    });

    afterEach(() => {
        URL.createObjectURL = originalCreate;
        URL.revokeObjectURL = originalRevoke;
        vi.restoreAllMocks();
    });

    // in the export submenu, opened on the way
    const entry = (id: string) => menuEntry(id);
    const isDisabled = (id: string) => entry(id).classList.contains('simple-html-grid-menu-item-disabled');
    const config = (readonly: boolean): GridConfig => ({
        readonly,
        layout: { center: [{ fields: ['name'], width: 100 }] }
    });
    const rows = () => [{ name: 'Ann' }, { name: 'Bob' }, { name: 'Cid' }];

    it('expect Excel in the export submenu, in a readonly grid too, the selected rows greyed out with none selected', async () => {
        const { element } = await mountGrid(config(true), rows());

        openRowMenu(element, 'name', 0);

        expect(entry('row.export').textContent?.trim()).toBe('Export');
        expect(entry('row.export').getAttribute('aria-haspopup')).toBe('menu');
        expect(entry('row.export.excel').textContent?.replace(/\s+/g, ' ').trim()).toBe('Excel, all rows');
        expect(entry('row.export.excelSelected').textContent?.replace(/\s+/g, ' ').trim()).toBe('Excel, selected rows');
        expect(isDisabled('row.export.excel')).toBe(false);
        expect(isDisabled('row.export.excelSelected')).toBe(true);
        // CSV is not in the menu any more, it is in the API: getCsv(), downloadCsv()
        expect(document.querySelector('.simple-html-grid-menu [data-menu-id^="row.export.csv"]')).toBeNull();
    });

    it('expect the ids in MENU_IDS: Excel, no CSV', () => {
        expect(MENU_IDS.row.filter((id) => id.startsWith('row.export'))).toEqual([
            'row.export',
            'row.export.excel',
            'row.export.excelSelected'
        ]);
    });

    it('expect "Excel, all rows" to download every row as export.xlsx', async () => {
        const { element } = await mountGrid(config(false), rows());

        openRowMenu(element, 'name', 0);
        entry('row.export.excel').click();

        await vi.waitFor(() => expect(downloads).toEqual(['export.xlsx']));
        expect(blobs[0].type).toBe(XLSX_MIME);
        expect((await readSheet(blobs[0])).rows).toEqual([['Name'], ['Ann'], ['Bob'], ['Cid']]);
    });

    it('expect "Excel, selected rows" to download the selected rows', async () => {
        const { element, datasource } = await mountGrid(config(false), rows());
        selectNames(datasource, 'Ann', 'Cid');

        openRowMenu(element, 'name', 0);
        expect(isDisabled('row.export.excelSelected')).toBe(false);
        entry('row.export.excelSelected').click();

        await vi.waitFor(() => expect(downloads).toEqual(['export.xlsx']));
        expect((await readSheet(blobs[0])).rows).toEqual([['Name'], ['Ann'], ['Cid']]);
    });

    it('expect the labels from the texts, by the ids: a grid of its own texts', async () => {
        const { element } = await mountGrid({ ...config(false), texts: { 'row.export.excel': 'Excel, alle rader' } }, rows());
        openRowMenu(element, 'name', 0);
        expect(entry('row.export.excel').textContent?.trim()).toBe('Excel, alle rader');
    });
});

describe('getExcel - a lookup column', () => {
    it('expect the label the cell shows, as text - also for a number field', async () => {
        const ages = new Datasource({ fields: { years: 'number' } });
        ages.setData([
            { years: 30, name: 'thirty' },
            { years: 20, name: 'twenty' }
        ]);
        registerLookup('excel-ages', { datasource: ages, valueField: 'years', labelField: 'name' });
        const config: GridConfig = {
            ...columns('name', 'age'),
            columns: { age: { editor: { type: 'select', lookup: 'excel-ages' } } }
        };
        const { gridInterface } = await mountGrid(config, people().slice(0, 3), peopleFields);
        // a value the lookup does not have: the cell shows the value, as text
        expect(await excelRows(gridInterface)).toEqual([
            ['Name', 'Age'],
            ['Ann', 'thirty'],
            ['Bob', 'twenty'],
            ['Cid', '50']
        ]);
    });
});
