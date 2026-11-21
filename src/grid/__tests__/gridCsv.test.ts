// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import { where } from '../../datasource/filterExpression';
import type { GridConfig } from '../gridConfig';
import { REVOKE_URL_AFTER_MS } from '../gridFunctions/gridCsv';
import { GridInterface } from '../gridInterface';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { openRowMenu } from './interactionTestHelpers';

/**
 * gridInterface.getCsv() and downloadCsv(): which rows and fields, the labels, formatted or raw
 * values, formula escaping, the option checks and the download. The CSV text itself (quoting, CRLF,
 * BOM) is tested in csv.test.ts.
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
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
 * the lines of a csv text, without the line ends (every line ends with CRLF, the last one too)
 */
const lines = (text: string) => {
    expect(text.endsWith('\r\n') || text === '').toBe(true);
    return text.split('\r\n').slice(0, -1);
};

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

describe('getCsv - rows', () => {
    it('expect every row with a header line, the columns of the layout', async () => {
        const { gridInterface } = await mountGrid(columns('name', 'age'), people(), peopleFields);
        expect(lines(gridInterface.getCsv())).toEqual(['Name,Age', 'Ann,30', 'Bob,20', 'Cid,50', 'Dan,40', 'Eve,10']);
    });

    it("expect 'all' to follow the filter and the sort", async () => {
        const { gridInterface, datasource } = await mountGrid(columns('name', 'age'), people(), peopleFields);
        datasource.filter(where('age', 'GREATER_THAN', 15));
        datasource.sort({ attribute: 'age', ascending: false });

        expect(lines(gridInterface.getCsv())).toEqual(['Name,Age', 'Cid,50', 'Dan,40', 'Ann,30', 'Bob,20']);
        expect(lines(gridInterface.getCsv({ rows: 'all' }))).toEqual(lines(gridInterface.getCsv()));
    });

    it("expect 'all' when grouped: every data row in the grouped order, collapsed groups too, no group rows", async () => {
        const { gridInterface, datasource } = await mountGrid(columns('name', 'country'), people(), peopleFields);
        gridInterface.setState({ grouping: [{ attribute: 'country', title: 'Country' }], expandedGroups: ['Norway'] });
        // Denmark and Sweden are collapsed: their rows are not displayed
        expect(datasource.getRows().filter((row) => !('__group' in row)).length).toBe(2);

        expect(lines(gridInterface.getCsv())).toEqual([
            'Name,Country',
            'Eve,Denmark',
            'Ann,Norway',
            'Cid,Norway',
            'Bob,Sweden',
            'Dan,Sweden'
        ]);
    });

    it("expect 'selected': the selected rows in the order of the rows, the header only when none is", async () => {
        const { gridInterface, datasource } = await mountGrid(columns('name', 'age'), people(), peopleFields);
        expect(lines(gridInterface.getCsv({ rows: 'selected' }))).toEqual(['Name,Age']);

        selectNames(datasource, 'Dan', 'Ann');
        datasource.sort({ attribute: 'age', ascending: false });
        expect(lines(gridInterface.getCsv({ rows: 'selected' }))).toEqual(['Name,Age', 'Dan,40', 'Ann,30']);
    });

    it("expect 'selected' to leave out a selected row the filter or a collapsed group hides, as getSelectedRows() does", async () => {
        const { gridInterface, datasource } = await mountGrid(columns('name', 'country'), people(), peopleFields);
        selectNames(datasource, 'Ann', 'Bob', 'Eve');
        datasource.filter(where('name', 'NOT_EQUAL_TO', 'Eve'));
        gridInterface.setState({ grouping: [{ attribute: 'country', title: 'Country' }], expandedGroups: ['Norway'] });

        expect(datasource.getSelectedRows().map((row) => row.name)).toEqual(['Ann']);
        expect(lines(gridInterface.getCsv({ rows: 'selected' }))).toEqual(['Name,Country', 'Ann,Norway']);
    });
});

describe('getCsv - fields and labels', () => {
    it('expect the layout order: pinned left, center, pinned right, a column per stacked field', async () => {
        const config: GridConfig = {
            layout: {
                left: [{ fields: ['name'], width: 100 }],
                center: [
                    { fields: ['age', 'country'], width: 100 },
                    { fields: ['city'], width: 100 }
                ],
                right: [{ fields: ['id'], width: 100 }]
            }
        };
        const { gridInterface } = await mountGrid(config, [{ id: 1, name: 'Ann', age: 30, country: 'Norway', city: 'Oslo' }]);
        expect(lines(gridInterface.getCsv())).toEqual(['Name,Age,Country,City,Id', 'Ann,30,Norway,Oslo,1']);
    });

    it('expect the hidden columns left out: in the config but not in the layout, or hidden since', async () => {
        const config: GridConfig = { ...columns('name', 'age', 'country'), columns: { phone: {} } };
        const { gridInterface } = await mountGrid(config, [{ name: 'Ann', age: 30, country: 'Norway', phone: '123' }]);
        expect(gridInterface.getHiddenFields()).toEqual(['phone']);
        expect(lines(gridInterface.getCsv())).toEqual(['Name,Age,Country', 'Ann,30,Norway']);

        // the user hides age
        gridInterface.setState({ layout: columns('name', 'country').layout });
        expect(lines(gridInterface.getCsv())).toEqual(['Name,Country', 'Ann,Norway']);
    });

    it('expect the fields option: these fields in this order, a field that is not in the grid too', async () => {
        const config: GridConfig = { ...columns('name', 'age'), columns: { phone: {} } };
        const { gridInterface } = await mountGrid(config, [{ name: 'Ann', age: 30, phone: '123', email: 'ann@x.no' }]);
        expect(lines(gridInterface.getCsv({ fields: ['email', 'name', 'phone'] }))).toEqual([
            'Email,Name,Phone',
            'ann@x.no,Ann,123'
        ]);
    });

    it('expect the labels the header shows: the column label, else the field label, else the name prettified', async () => {
        const config: GridConfig = { ...columns('name', 'country', 'first_name'), columns: { name: { label: 'Full name' } } };
        const { element, gridInterface } = await mountGrid(config, [{ name: 'Ann', country: 'Norway', first_name: 'A' }], {
            fields: { name: { label: 'not this one' }, country: { label: 'Land' } }
        });
        const header = lines(gridInterface.getCsv())[0];
        expect(header).toBe('Full name,Land,First Name');

        const shown = ['name', 'country', 'first_name'].map((field) =>
            element.querySelector(`[data-attribute-header="${field}"]`)?.textContent?.trim()
        );
        expect(header).toBe(shown.join(','));
    });

    it('expect no header line with header: false', async () => {
        const { gridInterface } = await mountGrid(columns('name', 'age'), people().slice(0, 2), peopleFields);
        expect(lines(gridInterface.getCsv({ header: false }))).toEqual(['Ann,30', 'Bob,20']);
    });

    it('expect an empty text for no fields', async () => {
        const { gridInterface } = await mountGrid(columns('name'), people(), peopleFields);
        expect(gridInterface.getCsv({ fields: [] })).toBe('');
    });
});

describe('getCsv - formatted and raw values', () => {
    const fields: DatasourceOptions = {
        fields: {
            born: 'date',
            price: { type: 'number', formatter: 'numberComma' },
            active: 'boolean',
            age: 'number'
        }
    };
    const born = new Date(2001, 4, 17, 13, 45);
    const rows = () => [
        { name: 'Ann', born, price: 12.5, active: true, age: 30 },
        { name: null, born: null, price: null, active: false, age: undefined }
    ];
    const config = () => columns('name', 'born', 'price', 'active', 'age');

    it('expect the values as the grid shows them by default: the field formatters', async () => {
        const { gridInterface } = await mountGrid(config(), rows(), fields);
        expect(lines(gridInterface.getCsv())).toEqual([
            'Name,Born,Price,Active,Age',
            'Ann,2001-05-17,"12,5",true,30',
            ',,,false,'
        ]);
    });

    it("expect ';' as separator: the comma of 12,5 needs no quotes", async () => {
        const { gridInterface } = await mountGrid(config(), rows(), fields);
        expect(lines(gridInterface.getCsv({ separator: ';' }))).toEqual([
            'Name;Born;Price;Active;Age',
            'Ann;2001-05-17;12,5;true;30',
            ';;;false;'
        ]);
    });

    it('expect the raw values with formatted: false - ISO dates, numbers with a dot, true/false, blanks empty', async () => {
        const { gridInterface } = await mountGrid(config(), rows(), fields);
        expect(lines(gridInterface.getCsv({ formatted: false }))).toEqual([
            'Name,Born,Price,Active,Age',
            `Ann,${born.toISOString()},12.5,true,30`,
            ',,,false,'
        ]);
    });

    it("expect a column's numberOverride, as the cells show it (formatted only)", async () => {
        const overrides: GridConfig = {
            ...columns('blank', 'zero'),
            columns: { blank: { numberOverride: 'BLANK_TO_ZERO' }, zero: { numberOverride: 'ZERO_TO_BLANK' } }
        };
        const { gridInterface } = await mountGrid(overrides, [{ blank: null, zero: 0 }], {
            fields: { blank: 'number', zero: 'number' }
        });
        expect(lines(gridInterface.getCsv())).toEqual(['Blank,Zero', '0,']);
        expect(lines(gridInterface.getCsv({ formatted: false }))).toEqual(['Blank,Zero', ',0']);
    });

    it('expect a dynamicCellTypeColumn cell formatted with the type of its row', async () => {
        const dynamic: GridConfig = { ...columns('value'), columns: { value: { dynamicCellTypeColumn: 'type' } } };
        const { gridInterface } = await mountGrid(
            dynamic,
            [
                { value: new Date(2026, 10, 20), type: 'date' },
                { value: 12.5, type: 'number' },
                { value: 'text', type: 'text' }
            ],
            { formatters: { number: 'numberComma' } }
        );
        expect(lines(gridInterface.getCsv())).toEqual(['Value', '2026-11-20', '"12,5"', 'text']);
    });

    it('expect the formatter of a field the grid has no column for', async () => {
        const { gridInterface } = await mountGrid(columns('name'), rows(), fields);
        expect(lines(gridInterface.getCsv({ fields: ['born', 'price'], separator: ';' }))).toEqual([
            'Born;Price',
            '2001-05-17;12,5',
            ';'
        ]);
    });
});

describe('getCsv - formulas (CSV injection)', () => {
    it('expect text starting with = + - @ escaped with a quote, numbers not', async () => {
        const { gridInterface } = await mountGrid(
            columns('name', 'note', 'age'),
            [
                { name: '=HYPERLINK("http://x","y")', note: '-5', age: -5 },
                { name: '@SUM(A1)', note: '+1', age: 5 }
            ],
            peopleFields
        );
        expect(lines(gridInterface.getCsv())).toEqual([
            'Name,Note,Age',
            '"\'=HYPERLINK(""http://x"",""y"")",\'-5,-5',
            "'@SUM(A1),'+1,5"
        ]);
    });

    it('expect the value to decide, not the field type: text in a number field is escaped', async () => {
        // the number formatter writes '-1+1' as it is: parseFloat reads it as -1
        const { gridInterface } = await mountGrid(columns('age'), [{ age: '-1+1' }, { age: -1 }], peopleFields);
        expect(lines(gridInterface.getCsv())).toEqual(['Age', "'-1+1", '-1']);
    });

    it('expect raw values escaped the same way', async () => {
        const { gridInterface } = await mountGrid(columns('name', 'age'), [{ name: '=1+1', age: -5 }], peopleFields);
        expect(lines(gridInterface.getCsv({ formatted: false }))).toEqual(['Name,Age', "'=1+1,-5"]);
    });

    it('expect a label escaped too', async () => {
        const config: GridConfig = { ...columns('total'), columns: { total: { label: '=Total' } } };
        const { gridInterface } = await mountGrid(config, [{ total: 'x' }]);
        expect(lines(gridInterface.getCsv())[0]).toBe("'=Total");
    });

    it('expect the text as it is with escapeFormulas: false', async () => {
        const config: GridConfig = { ...columns('name'), columns: { name: { label: '=Name' } } };
        const { gridInterface } = await mountGrid(config, [{ name: '=1+1' }]);
        expect(lines(gridInterface.getCsv({ escapeFormulas: false }))).toEqual(['=Name', '=1+1']);
    });
});

describe('getCsv - without a connected grid', () => {
    it('expect the same text from an interface that is not on the page', async () => {
        const config: GridConfig = {
            layout: { left: [{ fields: ['name'], width: 100 }], center: [{ fields: ['age', 'country'], width: 100 }] },
            columns: { name: { label: 'Who' } }
        };
        const datasource = new Datasource({ fields: { age: 'number', country: { label: 'Land' } } });
        datasource.setData(people());
        // after: the interface applies the config's initialState, no sort
        const gridInterface = new GridInterface(config, datasource);
        datasource.sort({ attribute: 'age', ascending: true });

        expect(lines(gridInterface.getCsv())).toEqual([
            'Who,Age,Land',
            'Eve,10,Denmark',
            'Bob,20,Sweden',
            'Ann,30,Norway',
            'Dan,40,Sweden',
            'Cid,50,Norway'
        ]);

        // and the same once it is on the page
        const { gridInterface: mounted, datasource: mountedDatasource } = await mountGrid(config, people(), {
            fields: { age: 'number', country: { label: 'Land' } }
        });
        mountedDatasource.sort({ attribute: 'age', ascending: true });
        expect(mounted.getCsv()).toBe(gridInterface.getCsv());
    });
});

describe('getCsv - options', () => {
    it('expect no BOM by default, one with bom: true', async () => {
        const { gridInterface } = await mountGrid(columns('name'), [{ name: 'Åse' }]);
        expect(gridInterface.getCsv()).toBe('Name\r\nÅse\r\n');
        expect(gridInterface.getCsv({ bom: true })).toBe('﻿Name\r\nÅse\r\n');
    });

    it.each([
        [true, 'takes an options object in v6, not a boolean'],
        [null, 'takes an options object'],
        [['rows'], 'takes an options object'],
        [{ row: 'selected' }, "unknown option 'row'"],
        [{ rows: 'range' }, `rows is 'all' or 'selected', got "range"`],
        [{ rows: true }, "rows is 'all' or 'selected'"],
        [{ fields: 'name' }, 'fields is a list of field names'],
        [{ fields: ['name', 1] }, 'fields is a list of field names'],
        [{ separator: '|' }, "separator is ',', ';' or '\\t'"],
        [{ header: 'yes' }, 'header is true or false'],
        [{ formatted: 1 }, 'formatted is true or false'],
        [{ bom: 'true' }, 'bom is true or false'],
        [{ escapeFormulas: null }, 'escapeFormulas is true or false']
    ])('expect a TypeError for %j', async (options, message) => {
        const { gridInterface } = await mountGrid(columns('name'), people());
        expect(() => gridInterface.getCsv(options as any)).toThrow(TypeError);
        expect(() => gridInterface.getCsv(options as any)).toThrow(message);
        expect(() => gridInterface.downloadCsv('export.csv', options as any)).toThrow(message);
    });

    it('expect undefined options to be the defaults', async () => {
        const { gridInterface } = await mountGrid(columns('name'), people().slice(0, 1));
        expect(gridInterface.getCsv({ rows: undefined, separator: undefined, header: undefined })).toBe(gridInterface.getCsv());
    });
});

describe('downloadCsv', () => {
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
        vi.useFakeTimers();
    });

    afterEach(() => {
        URL.createObjectURL = originalCreate;
        URL.revokeObjectURL = originalRevoke;
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    /** the bytes of a blob, to see the BOM: blob.text() decodes UTF-8 and drops it */
    const bytesOf = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

    it('expect a CSV blob with the BOM first, downloaded by clicking a link with the default filename', async () => {
        const { gridInterface } = await mountGrid(columns('name', 'age'), [{ name: 'Åse', age: 30 }], peopleFields);
        gridInterface.downloadCsv();

        expect(blobs.length).toBe(1);
        expect(blobs[0].type).toBe('text/csv;charset=utf-8');
        const bytes = await bytesOf(blobs[0]);
        expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
        expect(new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes)).toBe('﻿Name,Age\r\nÅse,30\r\n');

        // the link is not put in the page
        expect(clicked).toEqual([{ href: 'blob:test-1', download: 'export.csv', connected: false }]);
        expect(document.querySelector('a[download]')).toBeNull();
    });

    it('expect the object URL freed after a while, not before the download started', async () => {
        const { gridInterface } = await mountGrid(columns('name'), people());
        gridInterface.downloadCsv();
        expect(URL.revokeObjectURL).not.toHaveBeenCalled();

        vi.advanceTimersByTime(REVOKE_URL_AFTER_MS);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-1');
    });

    it('expect the filename and the options: no BOM with bom: false, the selected rows', async () => {
        const { gridInterface, datasource } = await mountGrid(columns('name', 'age'), people(), peopleFields);
        selectNames(datasource, 'Bob');
        gridInterface.downloadCsv('selected.csv', { rows: 'selected', separator: ';', bom: false });

        expect(clicked[0].download).toBe('selected.csv');
        const bytes = await bytesOf(blobs[0]);
        expect(new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes)).toBe('Name;Age\r\nBob;20\r\n');
    });

    it('expect a TypeError when the options are given where the filename goes', async () => {
        const { gridInterface } = await mountGrid(columns('name'), people());
        expect(() => gridInterface.downloadCsv({ rows: 'selected' } as any)).toThrow(TypeError);
        expect(() => gridInterface.downloadCsv({ rows: 'selected' } as any)).toThrow('the filename comes first');
        expect(() => gridInterface.downloadCsv('')).toThrow(TypeError);
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

    const entry = (id: string) => document.querySelector(`.simple-html-grid-menu [data-menu-id="${id}"]`) as HTMLElement;
    const isDisabled = (id: string) => entry(id).classList.contains('simple-html-grid-menu-item-disabled');
    const config = (readonly: boolean): GridConfig => ({
        readonly,
        layout: { center: [{ fields: ['name'], width: 100 }] }
    });
    const rows = () => [{ name: 'Ann' }, { name: 'Bob' }, { name: 'Cid' }];

    it('expect the export section in a readonly grid too, the selected rows greyed out with none selected', async () => {
        const { element } = await mountGrid(config(true), rows());

        openRowMenu(element, 'name', 0);

        expect(entry('row.export').textContent?.trim()).toBe('Export:');
        expect(entry('row.export.csv').textContent?.replace(/\s+/g, ' ').trim()).toBe('CSV, all rows');
        expect(entry('row.export.csvSelected').textContent?.replace(/\s+/g, ' ').trim()).toBe('CSV, selected rows');
        expect(isDisabled('row.export.csv')).toBe(false);
        expect(isDisabled('row.export.csvSelected')).toBe(true);
    });

    it('expect "CSV, all rows" to download every row as export.csv', async () => {
        const { element } = await mountGrid(config(false), rows());

        openRowMenu(element, 'name', 0);
        entry('row.export.csv').click();

        expect(downloads).toEqual(['export.csv']);
        expect(await blobs[0].text()).toBe('\ufeffName\r\nAnn\r\nBob\r\nCid\r\n');
    });

    it('expect "CSV, selected rows" to download the selected rows', async () => {
        const { element, datasource } = await mountGrid(config(false), rows());
        selectNames(datasource, 'Ann', 'Cid');

        openRowMenu(element, 'name', 0);
        expect(isDisabled('row.export.csvSelected')).toBe(false);
        entry('row.export.csvSelected').click();

        expect(downloads).toEqual(['export.csv']);
        expect(await blobs[0].text()).toBe('\ufeffName\r\nAnn\r\nCid\r\n');
    });
});
