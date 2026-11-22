// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import { registerCellRenderer } from '../cellRendererRegistry';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { cellTextOf } from '../gridFunctions/cellText';
import { columnsClipboard, labelsClipboard } from '../gridFunctions/rangeClipboard';
import type { GridInterface } from '../gridInterface';
import { mountGrid, renderedColumn, stubCanvas, stubElementSizes } from './gridTestHelpers';
import {
    gridOf,
    headerFilterInput,
    labelCell,
    menuEntry,
    menuTreeIds,
    openFilterMenu,
    openLabelMenu,
    typeInHeaderFilter,
    valueRow
} from './interactionTestHelpers';
import { parseXml, readParts } from './zipTestHelpers';

/**
 * The rest of a column's format, what the column settings dialog sets besides the display formats - in
 * the grid: the label of the user (`ColumnFormat.label`) wherever the grid names the column, the
 * placeholder of the header filter (`placeholder`, `placeholderLabel`), a number column's blank / 0
 * (`numberOverride`, over the column's own) and the checkboxes of a text or number column (`checkbox`):
 * their cells, a click writing the value, readonly, and the value kept by copy, the exports, sorting,
 * filtering and Find. The dialog itself is tested in columnSettings.test.ts, the checks of a format and
 * the checkbox helpers in columnFormat.test.ts.
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

const columns = (more: GridConfig['columns'], ...names: string[]): GridConfig => ({
    readonly: false,
    columns: more,
    layout: { center: names.map((name) => ({ fields: [name], width: 100 })) }
});

/** the cell inputs of a column, in the rendered rows */
const cells = (element: GridElement, attribute: string) =>
    Array.from(element.querySelectorAll<HTMLInputElement>(`input[data-attribute="${attribute}"]`));

/** the lines of the grid's CSV: the header, a line per row (the file ends with a line end) */
const csvLines = (gridInterface: GridInterface<any>, fields: string[]) =>
    gridInterface.getCsv({ fields }).replace(/\r\n$/, '').split('\r\n');

/** the rows of the grid's Excel file: text, numbers, booleans, null for no cell */
async function excelRows(gridInterface: GridInterface<any>, fields: string[]) {
    const parts = readParts(new Uint8Array(await (await gridInterface.getExcel({ fields })).arrayBuffer()));
    const sheet = parseXml(parts['xl/worksheets/sheet1.xml']);
    return Array.from(sheet.querySelectorAll('sheetData > row'), (row) =>
        Array.from(row.children, (cell) =>
            cell.getAttribute('t') === 'inlineStr'
                ? cell.querySelector('is > t')?.textContent
                : Number(cell.querySelector('v')?.textContent)
        )
    );
}

/** clicks a checkbox cell as the browser does it: the box flips, then its change event */
function clickCheckbox(input: HTMLInputElement) {
    input.checked = !input.checked;
    input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('column format - the label of the user', () => {
    const fields = (): DatasourceOptions => ({ fields: { age: 'number' } });
    const people = () => [
        { name: 'Ann', age: 30 },
        { name: 'Bob', age: 0 }
    ];

    it('expect it wherever the grid names the column: the header, the filter, the chooser, the chips, the exports', async () => {
        const { element, gridInterface } = await mountGrid(
            columns({ name: { label: 'Name' } }, 'name', 'age'),
            people(),
            fields()
        );
        gridInterface.setState({ formats: { name: { label: 'Who' } } });

        expect(labelCell(element, 'name').textContent?.trim()).toEqual('Who');
        expect(headerFilterInput(element, 'name').getAttribute('aria-label')).toEqual('Filter Who');
        expect(cells(element, 'name')[0].getAttribute('aria-label')).toEqual('Who');
        // the footer's chip of a filter on it
        typeInHeaderFilter(element, 'name', 'Ann');
        expect(element.querySelector('.footer-filter-attr')?.textContent?.trim()).toEqual('Who');
        // the filter editor's field
        gridInterface.openFilterEditor();
        const picks = Array.from(document.querySelectorAll('.filter-editor-content .filter-editor-pick-text'), (pick) =>
            pick.textContent?.trim()
        );
        expect(picks).toContain('Who');
        gridInterface.getDatasource().filter(null);
        // the column chooser of the header menu
        openLabelMenu(element, 'age');
        menuEntry('header.column.chooser').click();
        const chooser = Array.from(document.querySelectorAll('.simple-html-grid-menu-item'), (item) => item.textContent?.trim());
        expect(chooser).toContain('Who');
        expect(chooser).not.toContain('Name');

        // the headers of the exports and of a copy: what the user sees
        expect(csvLines(gridInterface, ['name', 'age'])[0]).toEqual('Who,Age');
        expect(columnsClipboard(gridOf(element), ['name', 'age']).text.split('\r\n')[0]).toEqual('Who\tAge');
        expect(labelsClipboard(gridOf(element), ['name'])).toEqual('Who');
        expect((await excelRows(gridInterface, ['name', 'age']))[0]).toEqual(['Who', 'Age']);

        // back to the config's
        gridInterface.resetState();
        expect(labelCell(element, 'name').textContent?.trim()).toEqual('Name');
        expect(csvLines(gridInterface, ['name'])[0]).toEqual('Name');
    });

    it("expect the config's format to start with one, over a field's label and the field name", async () => {
        const { element, gridInterface } = await mountGrid(
            columns({ age: { format: { label: 'Years' } } }, 'name', 'age'),
            people(),
            { fields: { age: 'number', name: { label: 'Person' } } }
        );
        expect(labelCell(element, 'age').textContent?.trim()).toEqual('Years');
        expect(labelCell(element, 'name').textContent?.trim()).toEqual('Person');
        expect(gridInterface.getState().formats).toEqual({ age: { label: 'Years' } });
        gridInterface.setState({ formats: {} });
        expect(labelCell(element, 'age').textContent?.trim()).toEqual('Age');
    });

    it('expect Format › to keep the label and the blank / 0: it sets the number or date part only', async () => {
        const { element, gridInterface } = await mountGrid(columns({}, 'name', 'age'), people(), fields());
        gridInterface.setState({ formats: { age: { label: 'Years', numberOverride: 'ZERO_TO_BLANK' } } });

        openLabelMenu(element, 'age');
        // Default has the ✓: the column has no number format
        expect(menuEntry('header.format.default').getAttribute('aria-checked')).toEqual('true');
        menuEntry('header.format.number.norwegian').click();
        expect(gridInterface.getState().formats.age).toEqual({
            label: 'Years',
            numberOverride: 'ZERO_TO_BLANK',
            number: { thousands: ' ', decimal: ',' }
        });

        openLabelMenu(element, 'age');
        menuEntry('header.format.default').click();
        expect(gridInterface.getState().formats.age).toEqual({ label: 'Years', numberOverride: 'ZERO_TO_BLANK' });
    });
});

describe('column format - the placeholder of the header filter', () => {
    it("expect a text, or the column's label, over the column's placeholderFilter and a BETWEEN's", async () => {
        const { element, gridInterface } = await mountGrid(
            columns({ name: { label: 'Name', placeholderFilter: 'find' } }, 'name', 'age'),
            [{ name: 'Ann', age: 3 }],
            { fields: { age: 'number' } }
        );
        const placeholder = (attribute: string) => headerFilterInput(element, attribute).placeholder;
        expect([placeholder('name'), placeholder('age')]).toEqual(['find', 'Number']);

        gridInterface.setState({ formats: { name: { placeholder: 'Search the names' }, age: { placeholder: 'Years' } } });
        expect([placeholder('name'), placeholder('age')]).toEqual(['Search the names', 'Years']);
        // the user's wins over a BETWEEN's from..to too
        gridInterface.setState({ headerFilters: { age: { value: null, operator: 'BETWEEN' } } });
        expect(placeholder('age')).toEqual('Years');

        // the label: the user's label, else the column's own
        gridInterface.setState({ formats: { name: { placeholderLabel: true, label: 'Who' }, age: { placeholderLabel: true } } });
        expect([placeholder('name'), placeholder('age')]).toEqual(['Who', 'Age']);
        gridInterface.setState({ formats: {} });
        expect([placeholder('name'), placeholder('age')]).toEqual(['find', 'from..to']);
    });

    it('expect a TypeError for a placeholder of a checkbox column, its filter is a checkbox', async () => {
        const { gridInterface } = await mountGrid(columns({}, 'active'), [{ active: true }], { fields: { active: 'boolean' } });
        expect(() => gridInterface.setState({ formats: { active: { placeholder: 'Yes' } } })).toThrow(
            /setState: formats.active.placeholder is for a header filter that is typed in/
        );
        // a label it takes
        gridInterface.setState({ formats: { active: { label: 'On' } } });
        expect(gridInterface.getState().formats.active).toEqual({ label: 'On' });
    });
});

describe('column format - blank / 0 of a number column', () => {
    const rows = () => [{ zero: 0 }, { zero: null }, { zero: 5 }];
    const fields = (): DatasourceOptions => ({ fields: { zero: 'number' } });

    it("expect the user's over the column's numberOverride, NONE turning it off: the cells, the CSV, Excel", async () => {
        const { element, gridInterface } = await mountGrid(
            columns({ zero: { numberOverride: 'ZERO_TO_BLANK' } }, 'zero'),
            rows(),
            fields()
        );
        expect(renderedColumn(element, 'zero')).toEqual(['', '', '5']);

        gridInterface.setState({ formats: { zero: { numberOverride: 'NONE' } } });
        expect(renderedColumn(element, 'zero')).toEqual(['0', '', '5']);
        expect(csvLines(gridInterface, ['zero'])).toEqual(['Zero', '0', '""', '5']);

        gridInterface.setState({ formats: { zero: { numberOverride: 'BLANK_TO_ZERO' } } });
        expect(renderedColumn(element, 'zero')).toEqual(['0', '0', '5']);
        expect(csvLines(gridInterface, ['zero'])).toEqual(['Zero', '0', '0', '5']);
        expect(await excelRows(gridInterface, ['zero'])).toEqual([['Zero'], [0], [0], [5]]);

        // with a number format: the format's 0
        gridInterface.setState({ formats: { zero: { numberOverride: 'BLANK_TO_ZERO', number: { decimals: 2 } } } });
        expect(renderedColumn(element, 'zero')).toEqual(['0.00', '0.00', '5.00']);

        // left out: the column's own again
        gridInterface.setState({ formats: {} });
        expect(renderedColumn(element, 'zero')).toEqual(['', '', '5']);
    });

    it('expect Find to find what the cells show', async () => {
        const { gridInterface } = await mountGrid(columns({}, 'zero'), rows(), fields());
        expect(gridInterface.find('0')).toBe(1);
        gridInterface.setState({ formats: { zero: { numberOverride: 'BLANK_TO_ZERO' } } });
        expect(gridInterface.find('0')).toBe(2);
    });
});

describe('column format - the checkboxes of a text or number column', () => {
    const fields = (): DatasourceOptions => ({ fields: { count: 'number' } });
    const rows = () => [
        { name: 'Ann', flag: '1', count: 1 },
        { name: 'Bob', flag: '0', count: 0 },
        { name: 'Cid', flag: ' 1 ', count: null },
        { name: 'Dan', flag: null, count: 2 }
    ];
    const checkboxConfig = (more: GridConfig['columns'] = {}) =>
        columns(
            { flag: { label: 'Flag', format: { checkbox: {} } }, count: { format: { checkbox: {} } }, ...more },
            'name',
            'flag',
            'count'
        );

    it('expect checkboxes, checked where the value is the checked value, named by the label', async () => {
        const { element } = await mountGrid(checkboxConfig(), rows(), fields());

        expect(cells(element, 'flag').map((input) => input.type)).toEqual(['checkbox', 'checkbox', 'checkbox', 'checkbox']);
        expect(cells(element, 'flag').map((input) => input.checked)).toEqual([true, false, true, false]);
        expect(cells(element, 'count').map((input) => input.checked)).toEqual([true, false, false, false]);
        expect(cells(element, 'flag')[0].getAttribute('aria-label')).toEqual('Flag');
        // the name column is text
        expect(cells(element, 'name')[0].type).toEqual('text');
    });

    it('expect a click to write the other value: text in a text field, a number in a number field', async () => {
        const { element, datasource } = await mountGrid(checkboxConfig(), rows(), fields());
        const data = () => datasource.getAllData().map((row) => [row.flag, row.count]);

        clickCheckbox(cells(element, 'flag')[0]);
        clickCheckbox(cells(element, 'flag')[3]);
        clickCheckbox(cells(element, 'count')[1]);
        clickCheckbox(cells(element, 'count')[2]);
        expect(data()).toEqual([
            ['0', 1],
            ['0', 1],
            [' 1 ', 1],
            ['1', 2]
        ]);
        expect(cells(element, 'flag').map((input) => input.checked)).toEqual([false, false, true, true]);
        // a cell checked as ' 1 ' unchecks: 0
        clickCheckbox(cells(element, 'flag')[2]);
        expect(datasource.getAllData()[2].flag).toBe('0');
        // undone as any edit
        datasource.undo();
        expect(datasource.getAllData()[2].flag).toBe(' 1 ');
    });

    it('expect the values of the format: Y and an empty unchecked value, null', async () => {
        const { element, datasource } = await mountGrid(
            columns({ flag: { format: { checkbox: { checked: 'Y', unchecked: '' } } } }, 'flag'),
            [{ flag: 'Y' }, { flag: 'N' }]
        );
        expect(cells(element, 'flag').map((input) => input.checked)).toEqual([true, false]);
        clickCheckbox(cells(element, 'flag')[0]);
        clickCheckbox(cells(element, 'flag')[1]);
        expect(datasource.getAllData().map((row) => row.flag)).toEqual([null, 'Y']);
    });

    it('expect nothing written in a readonly grid, a readonly column, a column of paste and clear only', async () => {
        for (const config of [
            { ...checkboxConfig(), readonly: true },
            checkboxConfig({ flag: { format: { checkbox: {} }, readonly: true } }),
            checkboxConfig({ flag: { format: { checkbox: {} }, allowPasteClearOnly: true } })
        ]) {
            const { element, datasource } = await mountGrid(config, rows(), fields());
            clickCheckbox(cells(element, 'flag')[0]);
            expect(datasource.getAllData()[0].flag).toBe('1');
            element.remove();
        }
    });

    it('expect the value kept: the CSV, Excel, the header filter, the value list, sorting; Find skips the checkboxes', async () => {
        const { element, gridInterface, datasource } = await mountGrid(checkboxConfig(), rows(), fields());

        expect(csvLines(gridInterface, ['flag', 'count'])).toEqual(['Flag,Count', '1,1', '0,0', ' 1 ,', ',2']);
        // a copy of the column: the values too
        expect(columnsClipboard(gridOf(element), ['flag', 'count']).text.split('\r\n').slice(0, 3)).toEqual([
            'Flag\tCount',
            '1\t1',
            '0\t0'
        ]);
        expect(await excelRows(gridInterface, ['flag', 'count'])).toEqual([['Flag', 'Count'], ['1', 1], ['0', 0], [' 1 '], [2]]);
        // the cells' text is the value's, the type a checkbox: Find, the fitted width
        expect(cellTextOf({ gridInterface }, 'flag')(datasource.getAllData()[0])).toEqual({
            type: 'boolean',
            text: '1',
            multiline: false
        });
        expect(gridInterface.find('1')).toBe(0);

        typeInHeaderFilter(element, 'flag', '0');
        expect(datasource.getRows().map((row) => row.name)).toEqual(['Bob']);
        datasource.filter(null);
        // the filter menu's value list: the values
        openFilterMenu(element, 'flag');
        expect(['0', '1', 'Blank'].map((value) => valueRow(value) !== undefined)).toEqual([true, true, true]);

        datasource.sort({ attribute: 'flag', ascending: true });
        expect(datasource.getRows().map((row) => row.flag)).toEqual([null, ' 1 ', '0', '1']);
    });

    it('expect no Format › for a number column with checkboxes', async () => {
        const { element } = await mountGrid(checkboxConfig(), rows(), fields());
        openLabelMenu(element, 'count');
        expect(menuTreeIds()).not.toContain('header.format');
    });

    it('expect a renderer of your own and a cell of another type (dynamicCellTypeColumn) to win', async () => {
        registerCellRenderer('format-options-test', (host) => ({
            update: ({ text }) => {
                host.textContent = text;
            }
        }));
        const { element } = await mountGrid(
            columns(
                {
                    flag: { renderer: 'format-options-test', format: { checkbox: {} } },
                    value: { dynamicCellTypeColumn: 'type', format: { checkbox: {} } }
                },
                'flag',
                'value'
            ),
            [
                { flag: '1', value: '1', type: 'number' },
                { flag: '0', value: '1', type: 'text' }
            ]
        );
        expect(cells(element, 'flag')).toEqual([]);
        expect(element.querySelector('[data-attribute="flag"]')?.textContent).toEqual('1');
        // the number cell is a number, the text cell a checkbox
        expect(cells(element, 'value').map((input) => input.type)).toEqual(['text', 'checkbox']);
    });

    it('expect a TypeError for checkboxes of a date column and for values a click could not uncheck', async () => {
        await expect(
            mountGrid(columns({ born: { format: { checkbox: {} } } }, 'born'), [], { fields: { born: 'date' } })
        ).rejects.toThrow(/GridConfig: columns.born.format.checkbox is for a text or number field, 'born' is date/);
        const { gridInterface } = await mountGrid(columns({}, 'flag'), [{ flag: '1' }]);
        expect(() => gridInterface.setState({ formats: { flag: { checkbox: { checked: '1', unchecked: '1' } } } })).toThrow(
            /setState: formats.flag.checkbox has "1" as the checked and the unchecked value/
        );
    });

    it('expect the state as JSON to give the checkboxes and the rest back', async () => {
        const { element, gridInterface } = await mountGrid(columns({}, 'name', 'flag'), rows());
        gridInterface.setState({
            formats: {
                flag: { checkbox: { checked: '1', unchecked: '0' }, label: 'Flag', placeholderLabel: true }
            }
        });
        const saved = JSON.parse(JSON.stringify(gridInterface.getState()));
        gridInterface.resetState();
        expect(cells(element, 'flag')[0].type).toEqual('text');

        gridInterface.setState(saved);
        expect(cells(element, 'flag')[0].type).toEqual('checkbox');
        expect(headerFilterInput(element, 'flag').placeholder).toEqual('Flag');
        expect(gridInterface.getState().formats).toEqual({
            flag: { checkbox: { checked: '1', unchecked: '0' }, label: 'Flag', placeholderLabel: true }
        });
    });
});

describe('column format - multiline and read only of the user', () => {
    const fields = (): DatasourceOptions => ({ fields: { age: 'number', notes: { type: 'text', multiline: true } } });
    const people = () => [
        { name: 'Ann', age: 30, notes: 'one' },
        { name: 'Bob', age: 0, notes: 'two' }
    ];

    it("expect multiline: true to make a text column of several lines, false to take the field's away", async () => {
        const { gridInterface, datasource } = await mountGrid(columns({}, 'name', 'notes'), people(), fields());
        const row = datasource.getAllData()[0];
        const multiline = (field: string) => cellTextOf({ gridInterface }, field)(row).multiline;
        expect([multiline('name'), multiline('notes')]).toEqual([false, true]);

        gridInterface.setState({ formats: { name: { multiline: true }, notes: { multiline: false } } });
        expect([multiline('name'), multiline('notes')]).toEqual([true, false]);
        // a value with a line break is of several lines still: what it shows
        row.notes = 'one\ntwo';
        expect(multiline('notes')).toBe(true);
    });

    it('expect readonly: true to make the cells read only in an editable grid, false to make a readonly column editable', async () => {
        const { element, gridInterface, datasource } = await mountGrid(
            columns({ age: { readonly: true } }, 'name', 'age'),
            people(),
            fields()
        );
        const row = datasource.getAllData()[0];
        expect([gridInterface.__isCellReadonly(row, 'name'), gridInterface.__isCellReadonly(row, 'age')]).toEqual([false, true]);

        gridInterface.setState({ formats: { name: { readonly: true }, age: { readonly: false } } });
        expect([gridInterface.__isCellReadonly(row, 'name'), gridInterface.__isCellReadonly(row, 'age')]).toEqual([true, false]);
        expect(cells(element, 'name')[0].readOnly).toBe(true);
        expect(cells(element, 'age')[0].readOnly).toBe(false);
    });

    it('expect the isReadonly hook to get the readonly of the user, and to have the last word', async () => {
        const seen: boolean[] = [];
        const { gridInterface, datasource } = await mountGrid(columns({}, 'name'), people(), fields(), {
            isReadonly: (_row, _field, readonly) => {
                seen.push(readonly);
                return false;
            }
        });
        gridInterface.setState({ formats: { name: { readonly: true } } });
        seen.length = 0;
        expect(gridInterface.__isCellReadonly(datasource.getAllData()[0], 'name')).toBe(false);
        expect(seen).toEqual([true]);
    });

    it('expect a TypeError for multiline on a field that is not text, with checkbox, on a lookup column; readonly true or false', async () => {
        const { gridInterface } = await mountGrid(columns({}, 'name', 'age'), people(), fields());
        expect(() => gridInterface.setState({ formats: { age: { multiline: true } } })).toThrow(
            "setState: formats.age.multiline is for a text field, 'age' is number"
        );
        expect(() => gridInterface.setState({ formats: { name: { multiline: true, checkbox: {} } } })).toThrow(
            'a checkbox shows no text, it is the one or the other'
        );
        expect(() => gridInterface.setState({ formats: { name: { multiline: 'yes' as unknown as boolean } } })).toThrow(
            'multiline is "yes", it is true or false'
        );
        expect(() => gridInterface.setState({ formats: { age: { readonly: 1 as unknown as boolean } } })).toThrow(
            'readonly is 1, it is true or false'
        );
        // a readonly of any type
        gridInterface.setState({ formats: { age: { readonly: true } } });
        expect(gridInterface.getState().formats.age).toEqual({ readonly: true });
    });
});
