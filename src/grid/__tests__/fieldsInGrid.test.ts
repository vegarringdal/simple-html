// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, where } from '../../datasource/filterExpression';
import type { Formatter } from '../../datasource/formatter';
import { registerFormatter } from '../../datasource/formatterRegistry';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { mountGrid, renderedColumn, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { headerFilterInput, menuItem, openFilterMenu, typeInHeaderFilter } from './interactionTestHelpers';

/**
 * The grid takes a column's type, formatter and label from the datasource's fields
 * (`datasource.getField()`), the grid config only has the layout.
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

const columns = (...names: string[]): GridConfig => ({
    readonly: false,
    layout: { center: names.map((name) => ({ fields: [name], width: 100 })) }
});

/**
 * the cell input of a column in the first rendered row
 */
const cellInput = (element: GridElement, attribute: string, row = 0) =>
    element.querySelectorAll(`input[data-attribute="${attribute}"]`)[row] as HTMLInputElement;

const typeInCell = (element: GridElement, attribute: string, text: string, row = 0) => {
    const input = cellInput(element, attribute, row);
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
};

const headerLabel = (element: GridElement, attribute: string) =>
    element.querySelector(`[data-attribute-header="${attribute}"]`)?.textContent?.trim();

describe('fields in the grid - formatters', () => {
    it("expect a cell to show the field's own formatter, and typing to be parsed by it", async () => {
        const { element, datasource } = await mountGrid(columns('price'), [{ price: 12.5 }], {
            fields: { price: { type: 'number', formatter: 'numberComma' } }
        });
        expect(renderedColumn(element, 'price')).toEqual(['12,5']);

        typeInCell(element, 'price', '3,25');
        expect(datasource.getAllData()[0].price).toEqual(3.25);
    });

    it('expect a custom formatter to be used for a text field', async () => {
        const upper: Formatter = { format: (value) => String(value ?? '').toUpperCase(), parse: (text) => text.toLowerCase() };
        // an id of this test's own: the registry is shared by the tests of this file
        registerFormatter('fieldsInGrid.upper', upper);
        const { element, datasource } = await mountGrid(columns('name'), [{ name: 'ann' }], {
            fields: { name: { formatter: 'fieldsInGrid.upper' } }
        });
        expect(renderedColumn(element, 'name')).toEqual(['ANN']);

        typeInCell(element, 'name', 'BOB');
        expect(datasource.getAllData()[0].name).toEqual('bob');
    });

    it('expect the formatters option to change every field of the type', async () => {
        const { element } = await mountGrid(
            columns('born', 'hired'),
            [{ born: new Date(2001, 4, 17), hired: new Date(2020, 0, 2) }],
            {
                fields: { born: 'date', hired: 'date' },
                formatters: { date: 'dateDDMMYYYY' }
            }
        );
        expect(renderedColumn(element, 'born')).toEqual(['17.05.2001']);
        expect(renderedColumn(element, 'hired')).toEqual(['02.01.2020']);
    });

    it('expect a date and a datetime field to show their own format', async () => {
        const when = new Date(2001, 4, 17, 13, 45, 12);
        const { element } = await mountGrid(columns('d', 't'), [{ d: when, t: when }], { fields: { d: 'date', t: 'datetime' } });
        expect(renderedColumn(element, 'd')).toEqual(['2001-05-17']);
        expect(renderedColumn(element, 't')).toEqual(['2001-05-17T13:45:12']);
    });

    it('expect a field that is not listed to be text', async () => {
        const { element } = await mountGrid(columns('n'), [{ n: 12.5 }], {});
        expect(renderedColumn(element, 'n')).toEqual(['12.5']);
        expect(cellInput(element, 'n').style.textAlign).toEqual('');
    });

    it("expect the header filter placeholder to come from the field's formatter", async () => {
        const { element } = await mountGrid(columns('d', 't', 'e', 'name'), [{}], {
            fields: { d: 'date', t: 'datetime', e: { type: 'date', formatter: 'dateDDMMYYYY' } }
        });
        expect(headerFilterInput(element, 'd').placeholder).toEqual('YYYY-MM-DD');
        expect(headerFilterInput(element, 't').placeholder).toEqual('YYYY-MM-DDTHH:MM:SS');
        expect(headerFilterInput(element, 'e').placeholder).toEqual('DD.MM.YYYY');
        expect(headerFilterInput(element, 'name').placeholder).toEqual('🔍');
    });
});

describe('fields in the grid - booleans', () => {
    it('expect the checkbox to show the raw value, not a formatted one', async () => {
        registerFormatter('fieldsInGrid.never', { format: () => 'false', parse: () => false });
        const { element } = await mountGrid(columns('active'), [{ active: true }, { active: 'yes' }, { active: null }], {
            fields: { active: { type: 'boolean', formatter: 'fieldsInGrid.never' } }
        });
        expect([0, 1, 2].map((row) => cellInput(element, 'active', row).checked)).toEqual([true, true, false]);
    });

    it('expect a change of the checkbox to store a boolean', async () => {
        const { element, datasource } = await mountGrid(columns('active'), [{ active: null }], { fields: { active: 'boolean' } });
        const checkbox = cellInput(element, 'active');
        checkbox.checked = false;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        expect(datasource.getAllData()[0].active).toEqual(true);
    });
});

describe('fields in the grid - dynamicCellTypeColumn', () => {
    const config = (): GridConfig => ({
        readonly: false,
        columns: { value: { dynamicCellTypeColumn: 'valueType' } },
        layout: {
            center: [
                { fields: ['valueType'], width: 100 },
                { fields: ['value'], width: 200 }
            ]
        }
    });

    const rows = () => [
        { valueType: 'text', value: 'hello' },
        { valueType: 'number', value: 1234.5 },
        { valueType: 'date', value: new Date(2026, 7, 15, 10, 30) },
        { valueType: 'datetime', value: new Date(2026, 7, 15, 10, 30) },
        { valueType: 'boolean', value: true },
        { valueType: 'no type', value: 99 }
    ];

    it('expect each row to be formatted with the default formatter of its own type', async () => {
        const { element } = await mountGrid(config(), rows(), { formatters: { number: 'numberComma' } });
        const values = renderedColumn(element, 'value');
        expect(values.slice(0, 4)).toEqual(['hello', '1234,5', '2026-08-15', '2026-08-15T10:30:00']);
        // the boolean row is a checkbox, a value that is no type leaves the cell text
        expect(cellInput(element, 'value', 4).type).toEqual('checkbox');
        expect(cellInput(element, 'value', 4).checked).toEqual(true);
        expect(values[5]).toEqual('99');
    });

    it('expect typing to be parsed by the type of the row', async () => {
        const { element, datasource } = await mountGrid(config(), rows(), {});
        typeInCell(element, 'value', '12,5', 1);
        expect(datasource.getAllData()[1].value).toEqual(12.5);
        typeInCell(element, 'value', '12,5', 0);
        expect(datasource.getAllData()[0].value).toEqual('12,5');
    });

    it('expect a field that is not text to keep its own type', async () => {
        const { element } = await mountGrid(config(), [{ valueType: 'date', value: 5 }], { fields: { value: 'number' } });
        expect(renderedColumn(element, 'value')).toEqual(['5']);
    });
});

describe('fields in the grid - labels', () => {
    const config = (): GridConfig => ({
        columns: { own: { label: 'Column label' } },
        layout: { center: ['own', 'field', 'first_name'].map((name) => ({ fields: [name], width: 100 })) }
    });
    const fields = { fields: { own: { label: 'Field label' }, field: { label: 'Field label' } } };

    it('expect the header to show the column label, else the field label, else the name prettified', async () => {
        const { element } = await mountGrid(config(), [{}], fields);
        expect(headerLabel(element, 'own')).toEqual('Column label');
        expect(headerLabel(element, 'field')).toEqual('Field label');
        expect(headerLabel(element, 'first_name')).toEqual('First Name');
    });

    it('expect the footer filter to show the same labels, the name as it is', async () => {
        const { element, datasource } = await mountGrid(config(), [{ own: 'a', field: 'b', first_name: 'c' }], fields);
        datasource.filter(
            and(
                where('own', 'EQUAL', 'a'),
                where('field', 'EQUAL', 'b'),
                where('first_name', 'EQUAL', 'c'),
                // a field that is not a column
                where('other', 'IS_BLANK')
            )
        );
        const chips = Array.from(element.querySelectorAll('.footer-filter-attr')).map((chip) => chip.textContent?.trim());
        expect(chips).toEqual(['Column label', 'Field label', 'first_name', 'other']);
    });

    it('expect the datasource on its own to use the field labels', async () => {
        const { datasource } = await mountGrid(config(), [{ own: 'a' }], fields);
        datasource.filter(where('own', 'EQUAL', 'a'));
        expect(datasource.getFilterString()).toEqual("([FIELD LABEL] <<EQUAL_TO>> 'A')");
    });
});

describe('fields in the grid - header filter on dates', () => {
    const data = () => [
        { name: 'a', d: new Date(2001, 4, 17, 8, 0), t: new Date(2001, 4, 17, 8, 0) },
        { name: 'b', d: new Date(2001, 4, 18, 9, 0), t: new Date(2001, 4, 18, 9, 0) },
        { name: 'c', d: new Date(2001, 4, 18, 15, 0), t: new Date(2001, 4, 18, 15, 0) }
    ];
    const names = (datasource: { getDataRows(): { name?: string }[] }) => datasource.getDataRows().map((row) => row.name);

    it('expect a typed day to match the whole day on a date field', async () => {
        const { element, datasource } = await mountGrid(columns('name', 'd'), data(), { fields: { d: 'date' } });
        typeInHeaderFilter(element, 'd', '2001-05-18');
        // a date filters from the day on by default (>=)
        expect(names(datasource)).toEqual(['b', 'c']);
    });

    it('expect a typed time to count on a datetime field', async () => {
        const { element, datasource } = await mountGrid(columns('name', 't'), data(), { fields: { t: 'datetime' } });
        typeInHeaderFilter(element, 't', '2001-05-18T12');
        expect(names(datasource)).toEqual(['c']);
    });

    it('expect another operator to keep the date filter (v5 dropped it, the parser got a Date)', async () => {
        const { element, datasource } = await mountGrid(columns('name', 'd'), data(), { fields: { d: 'date' } });
        typeInHeaderFilter(element, 'd', '2001-05-17');
        expect(names(datasource)).toEqual(['a', 'b', 'c']);

        openFilterMenu(element, 'd');
        menuItem('Equal').click();
        expect(names(datasource)).toEqual(['a']);

        openFilterMenu(element, 'd');
        menuItem('Less than or equal').click();
        expect(names(datasource)).toEqual(['a']);
        expect(headerFilterInput(element, 'd').value).toEqual('2001-05-17');
    });
});

describe('fields in the grid - filter editor', () => {
    /**
     * the editor input is parsed by the field's formatter: v5 kept typed 'true' as text, and
     * the text 'true' never equals the boolean true in the rows
     */
    it('expect a typed boolean to be parsed and match the rows', async () => {
        const { datasource, gridInterface } = await mountGrid(
            columns('name', 'active'),
            [
                { name: 'a', active: true },
                { name: 'b', active: false }
            ],
            { fields: { active: 'boolean' } }
        );
        datasource.filter(and(where('active', 'EQUAL', null)));
        gridInterface.openFilterEditor();

        const input = document.querySelector('.filter-editor-content .grid-condition input') as HTMLInputElement;
        input.value = 'true';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        menuItem('Filter Only').click();

        expect(datasource.getDataRows().map((row) => row.name)).toEqual(['a']);
    });

    it('expect a typed number to be parsed by the field formatter', async () => {
        const { datasource, gridInterface } = await mountGrid(
            columns('name', 'price'),
            [
                { name: 'a', price: 12.5 },
                { name: 'b', price: 3 }
            ],
            { fields: { price: { type: 'number', formatter: 'numberComma' } } }
        );
        datasource.filter(and(where('price', 'EQUAL', 3)));
        gridInterface.openFilterEditor();

        const input = document.querySelector('.filter-editor-content .grid-condition input') as HTMLInputElement;
        // the editor shows the value with the field's formatter
        expect(input.value).toEqual('3');
        input.value = '12,5';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        menuItem('Filter Only').click();

        expect(datasource.getDataRows().map((row) => row.name)).toEqual(['a']);
    });
});

describe('fields in the grid - edit tracking follows the field type', () => {
    const data = () => [{ name: 'a', d: new Date(2001, 4, 17, 8, 0), t: new Date(2001, 4, 17, 8, 0, 0) }];
    const fields = { fields: { d: 'date', t: 'datetime' } } as const;

    it('expect typing the same day into a date cell to be no edit - the formatter stamps the current time', async () => {
        const { element, datasource } = await mountGrid(columns('name', 'd'), data(), fields);
        typeInCell(element, 'd', '2001-05-17');

        expect(datasource.getChanges().modifiedEntities).toEqual([]);
        expect(datasource.getAllData()[0].__rowState).toBeUndefined();
    });

    it('expect typing the same time into a datetime cell to be no edit - the formatter stamps the current milliseconds', async () => {
        const { element, datasource } = await mountGrid(columns('name', 't'), data(), fields);
        typeInCell(element, 't', '2001-05-17T08:00:00');

        expect(datasource.getChanges().modifiedEntities).toEqual([]);
    });

    it('expect typing another time into a datetime cell to be an edit', async () => {
        const { element, datasource } = await mountGrid(columns('name', 't'), data(), fields);
        typeInCell(element, 't', '2001-05-17T09:30:00');

        const modified = datasource.getChanges().modifiedEntities;
        expect(modified).toHaveLength(1);
        expect(modified[0].t).toEqual(datasource.getAllData()[0].t);
        expect(modified[0].t.getHours()).toEqual(9);
        expect(datasource.getAllData()[0].__rowState).toEqual('M');
    });
});
