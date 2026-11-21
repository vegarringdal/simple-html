// @vitest-environment happy-dom

import { beforeAll, describe, expect, it } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import { isGroupRow } from '../../datasource/entity';
import { where } from '../../datasource/filterExpression';
import { registerFormatter } from '../../datasource/formatterRegistry';
import { TextFormatter } from '../../datasource/textFormatter';
import type { GridConfig } from '../gridConfig';
import { DROPDOWN_FILTER_MAX_ROWS, dropDownFilterData, type ValueListData } from '../gridFunctions/dropDownFilterData';
import { registerLookup } from '../lookup';
import { mountGrid, simpleConfig, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { gridOf } from './interactionTestHelpers';

/**
 * The data behind the value list of the filter menu (the excel style column filter): the texts the
 * column's cells show, the values behind each, the counts, what starts checked
 */

const config = simpleConfig;

const rows = (values: unknown[]) => values.map((v, i) => ({ firstname: v, lastname: `last${i}`, age: i }));

/** the texts of the entries listed, "Blank" for the blank one */
const texts = (data: ValueListData | null) => data?.entries.map((entry) => (entry.blank ? 'Blank' : entry.text));

/** the entry with this text, "Blank" for the blank one */
const entry = (data: ValueListData | null, text: string) =>
    data?.entries.find((one) => (one.blank ? 'Blank' : one.text) === text);

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
    // the phone without its spaces, as the custom formatter sample
    registerFormatter('ddfd-compact', {
        ...TextFormatter,
        format: (value: unknown) => TextFormatter.format(value).replaceAll(' ', '')
    });
    const countries = new Datasource();
    countries.setData([
        { code: 'NO', name: 'Norway' },
        { code: 'SE', name: 'Sweden' },
        { code: 'DK', name: 'Denmark' }
    ]);
    registerLookup('ddfd-countries', { datasource: countries, valueField: 'code', labelField: 'name' });
    const customers = new Datasource({ fields: { id: 'number' } });
    customers.setData([
        { id: 1, name: 'ACME' },
        { id: 2, name: 'Globex' },
        { id: 3, name: 'Initech' }
    ]);
    registerLookup('ddfd-customers', { datasource: customers, valueField: 'id', labelField: 'name' });
});

describe('dropDownFilterData - the texts the cells show', () => {
    it('expect one entry per text, as the cells show it - not upper cased', async () => {
        const { element } = await mountGrid(config(), rows(['abc', 'b', 'abc', 'C']));
        const data = dropDownFilterData(gridOf(element), 'firstname', false, null);

        expect(texts(data)).toEqual(['abc', 'b', 'C']);
        expect(entry(data, 'abc')).toEqual({ text: 'abc', blank: false, values: ['abc'], count: 2 });
    });

    it('expect the texts in the order localeCompare gives, not by their character codes', async () => {
        const { element } = await mountGrid(config(), rows(['b', 'C', 'a', 'Z']));
        const data = dropDownFilterData(gridOf(element), 'firstname', false, null);

        // a sort of the character codes put the capitals first: C, Z, a, b
        expect(texts(data)).toEqual(['a', 'b', 'C', 'Z']);
    });

    /**
     * IN compares ignoring case: the values could not be filtered apart, they are one entry. Its text is
     * the first row's, the counts are added, the value once - an IN of it finds both
     */
    it('expect values that differ in case only to be one entry, the text of the first row, the counts added', async () => {
        const { element } = await mountGrid(config(), rows(['Oslo', 'OSLO', 'bergen', 'oslo']));
        const data = dropDownFilterData(gridOf(element), 'firstname', false, null);

        expect(texts(data)).toEqual(['bergen', 'Oslo']);
        expect(entry(data, 'Oslo')).toEqual({ text: 'Oslo', blank: false, values: ['Oslo'], count: 3 });
    });

    it("expect the text of a field's formatter, two values shown the same one entry with both values", async () => {
        const { element } = await mountGrid(config(), rows(['12 34', '1234', '56 78', null]), {
            fields: { age: 'number', firstname: { formatter: 'ddfd-compact' } }
        });
        const data = dropDownFilterData(gridOf(element), 'firstname', false, null);

        expect(texts(data)).toEqual(['Blank', '1234', '5678']);
        expect(entry(data, '1234')).toEqual({ text: '1234', blank: false, values: ['12 34', '1234'], count: 2 });
        expect(entry(data, '5678')?.values).toEqual(['56 78']);
    });

    it('expect a search to find the text shown, not the value', async () => {
        const { element } = await mountGrid(config(), rows(['12 34', '56 78']), {
            fields: { age: 'number', firstname: { formatter: 'ddfd-compact' } }
        });

        expect(texts(dropDownFilterData(gridOf(element), 'firstname', false, '234'))).toEqual(['1234']);
        expect(texts(dropDownFilterData(gridOf(element), 'firstname', false, '2 3'))).toEqual([]);
    });
});

describe('dropDownFilterData - a lookup column (ColumnConfig.editor)', () => {
    const lookupConfig = (): GridConfig => ({
        columns: {
            country: { editor: { type: 'select', lookup: 'ddfd-countries' } },
            customer: { editor: { type: 'grid', lookup: 'ddfd-customers' }, numberOverride: 'BLANK_TO_ZERO' }
        },
        layout: {
            center: [
                { fields: ['country'], width: 100 },
                { fields: ['customer'], width: 100 }
            ]
        }
    });
    const lookupRows = () => [
        { country: 'NO', customer: 2 },
        { country: 'SE', customer: 1 },
        { country: 'NO', customer: 2 },
        // a value the lookup does not have, and blanks
        { country: 'XX', customer: 7 },
        { country: null, customer: null }
    ];
    const mount = () => mountGrid(lookupConfig(), lookupRows(), { fields: { customer: 'number' } });

    it('expect the labels the cells show, in their order, the values behind them', async () => {
        const { element } = await mount();
        const data = dropDownFilterData(gridOf(element), 'country', false, null);

        // a value no lookup row has shows itself, as in the cell
        expect(texts(data)).toEqual(['Blank', 'Norway', 'Sweden', 'XX']);
        expect(entry(data, 'Norway')).toEqual({ text: 'Norway', blank: false, values: ['NO'], count: 2 });
        expect(entry(data, 'Blank')).toEqual({ text: '', blank: true, values: ['NULL'], count: 1 });
    });

    it('expect a search to find the labels, not the values', async () => {
        const { element } = await mount();

        expect(texts(dropDownFilterData(gridOf(element), 'country', false, 'way'))).toEqual(['Norway']);
        // 'se' is in Sweden; the value SE alone would not be found by 'swe'
        expect(texts(dropDownFilterData(gridOf(element), 'country', false, 'swe'))).toEqual(['Sweden']);
    });

    it('expect a value list on a number field: the labels, the numbers behind them', async () => {
        const { element } = await mount();
        const data = dropDownFilterData(gridOf(element), 'customer', false, null);

        // 7: a value no customer has, its number as the cell shows it
        expect(texts(data)).toEqual(['Blank', '7', 'ACME', 'Globex']);
        expect(entry(data, 'Globex')?.values).toEqual([2]);
        expect(entry(data, '7')?.values).toEqual([7]);
    });

    /**
     * numberOverride is not used on a lookup column's cells, they show labels (renderRowCell): a blank
     * is Blank, not 0
     */
    it('expect numberOverride to change nothing, as on the cells', async () => {
        const { element } = await mount();
        const data = dropDownFilterData(gridOf(element), 'customer', false, null);

        expect(entry(data, 'Blank')?.count).toEqual(1);
        expect(entry(data, '0')).toBeUndefined();
    });

    it('expect an IN of the values behind the labels to find the rows they were listed for', async () => {
        const { element, datasource } = await mount();
        const countries = dropDownFilterData(gridOf(element), 'country', false, null);
        const customers = dropDownFilterData(gridOf(element), 'customer', false, null);

        datasource.filter(where('country', 'IN', entry(countries, 'Norway')?.values));
        expect(datasource.getDataRows().map((row) => row.country)).toEqual(['NO', 'NO']);
        datasource.filter(where('customer', 'IN', [...(entry(customers, 'ACME')?.values ?? []), 'NULL']));
        expect(datasource.getDataRows().map((row) => row.customer)).toEqual([1, null]);
    });

    it('expect a number field without a lookup to have no value list', async () => {
        const { element } = await mountGrid(config(), rows(['a']));
        expect(dropDownFilterData(gridOf(element), 'age', false, null)).toBeNull();
    });
});

describe('dropDownFilterData - blanks', () => {
    it('expect null and "" to be one Blank entry, first, counted', async () => {
        const { element } = await mountGrid(config(), rows(['a', null, '']));
        const data = dropDownFilterData(gridOf(element), 'firstname', false, null);

        expect(texts(data)).toEqual(['Blank', 'a']);
        expect(entry(data, 'Blank')).toEqual({ text: '', blank: true, values: ['NULL'], count: 2 });
    });

    /**
     * kept on purpose and documented on FilterOperator: 0 counts as blank, like IS_BLANK. A text
     * field holding numbers (a field that is not listed) shows them in the list
     */
    it('expect a 0 to be listed under the blank entry', async () => {
        const { element } = await mountGrid(config(), rows([0, 'a', 5]));
        const data = dropDownFilterData(gridOf(element), 'firstname', false, null);

        expect(texts(data)).toEqual(['Blank', '5', 'a']);
        expect(entry(data, 'Blank')?.count).toEqual(1);
    });

    it('expect a value whose cell shows no text to be under Blank too, with its value', async () => {
        registerFormatter('ddfd-hideDash', {
            ...TextFormatter,
            format: (value: unknown) => (value === '-' ? '' : TextFormatter.format(value))
        });
        const { element, datasource } = await mountGrid(config(), rows(['-', null, 'a']), {
            fields: { age: 'number', firstname: { formatter: 'ddfd-hideDash' } }
        });
        const data = dropDownFilterData(gridOf(element), 'firstname', false, null);

        expect(texts(data)).toEqual(['Blank', 'a']);
        expect(entry(data, 'Blank')).toEqual({ text: '', blank: true, values: ['-', 'NULL'], count: 2 });
        datasource.filter(where('firstname', 'IN', entry(data, 'Blank')?.values));
        expect(datasource.getDataRows().map((row) => row.lastname)).toEqual(['last0', 'last1']);
    });

    it('expect no Blank with a search: it has no text to find', async () => {
        const { element } = await mountGrid(config(), rows(['ab', null]));
        expect(texts(dropDownFilterData(gridOf(element), 'firstname', false, 'a'))).toEqual(['ab']);
    });
});

describe('dropDownFilterData - false is a value', () => {
    /**
     * A boolean in a text field (data typed loosely). IN takes `false` as the text 'FALSE' and IS_BLANK
     * as no blank: the list put it under "Blank" (a truthy check), and the IN it applied then left the
     * rows with false out
     */
    const loose = () => [
        { firstname: false, lastname: 'x', age: 1 },
        { firstname: 'a', lastname: 'y', age: 2 },
        { firstname: null, lastname: 'z', age: 3 },
        { firstname: true, lastname: 'w', age: 4 }
    ];

    it('expect false to be listed as a value of its own, not under the blank entry', async () => {
        const { element } = await mountGrid(config(), loose());
        const data = dropDownFilterData(gridOf(element), 'firstname', false, null);

        expect(texts(data)).toEqual(['Blank', 'a', 'false', 'true']);
        expect(entry(data, 'Blank')?.count).toEqual(1);
        expect(entry(data, 'false')).toEqual({ text: 'false', blank: false, values: [false], count: 1 });
    });

    it('expect the IN of the listed values to find the rows they were listed for', async () => {
        const { element, datasource } = await mountGrid(config(), loose());
        const data = dropDownFilterData(gridOf(element), 'firstname', false, null);

        const lastnames = (values: unknown[] | undefined) => {
            datasource.filter(where('firstname', 'IN', values));
            return datasource.getDataRows().map((row) => row.lastname);
        };
        expect(lastnames(entry(data, 'Blank')?.values)).toEqual(['z']);
        expect(lastnames(entry(data, 'false')?.values)).toEqual(['x']);
        // every listed value: every row
        expect(lastnames(data?.entries.flatMap((one) => one.values))).toHaveLength(4);
    });
});

describe('dropDownFilterData - the cap', () => {
    const tooMany = () =>
        rows(Array.from({ length: DROPDOWN_FILTER_MAX_ROWS + 25 }, (_, i) => `value${String(i).padStart(3, '0')}`));

    it('expect the first texts in order up to the cap, Blank not counted, and truncated set', async () => {
        const { element } = await mountGrid(config(), [...tooMany().reverse(), { firstname: null, lastname: 'x', age: 0 }]);
        const data = dropDownFilterData(gridOf(element), 'firstname', false, null);

        expect(data?.entries).toHaveLength(DROPDOWN_FILTER_MAX_ROWS + 1);
        // the first in order, not the first rows: the rows came last to first
        expect(texts(data)?.slice(0, 3)).toEqual(['Blank', 'value000', 'value001']);
        expect(texts(data)?.at(-1)).toEqual(`value${String(DROPDOWN_FILTER_MAX_ROWS - 1).padStart(3, '0')}`);
        expect(data?.truncated).toEqual(true);
    });

    it('expect nothing to be flagged as truncated for a small set', async () => {
        const { element } = await mountGrid(config(), rows(['a', 'b', 'c']));
        expect(dropDownFilterData(gridOf(element), 'firstname', false, null)?.truncated).toEqual(false);
    });

    it('expect counts to still be complete for the values that made it in', async () => {
        const { element } = await mountGrid(config(), [...tooMany(), { firstname: 'value000', lastname: 'x', age: 1 }]);
        const data = dropDownFilterData(gridOf(element), 'firstname', false, null);

        expect(entry(data, 'value000')?.count).toEqual(2);
    });

    it('expect a search to be cut off at the cap too', async () => {
        const { element } = await mountGrid(config(), tooMany());
        const data = dropDownFilterData(gridOf(element), 'firstname', false, 'value');

        expect([data?.entries.length, data?.truncated, data?.searched]).toEqual([DROPDOWN_FILTER_MAX_ROWS, true, true]);
    });
});

describe('dropDownFilterData - search', () => {
    it('expect the search to narrow the list, ignoring case', async () => {
        const { element } = await mountGrid(config(), rows(['Apple', 'banana', 'avocado']));
        const data = dropDownFilterData(gridOf(element), 'firstname', false, 'aP');

        expect([texts(data), data?.searched]).toEqual([['Apple'], true]);
    });

    it('expect wildcards in the search to be ignored', async () => {
        const { element } = await mountGrid(config(), rows(['apple', 'banana']));
        const data = dropDownFilterData(gridOf(element), 'firstname', false, '*ap%');

        expect(texts(data)).toEqual(['apple']);
        // only wildcards: no search
        expect(dropDownFilterData(gridOf(element), 'firstname', false, '*')?.searched).toEqual(false);
    });
});

describe('dropDownFilterData - checked', () => {
    it('expect every entry checked without conditions on the column, the ones its conditions let through with', async () => {
        const { element, datasource } = await mountGrid(config(), rows(['a', 'b', 'c', null]));
        const checkedTexts = () => {
            const data = dropDownFilterData(gridOf(element), 'firstname', false, null);
            return data?.entries.filter((one) => data.checked.has(one)).map((one) => (one.blank ? 'Blank' : one.text));
        };
        expect(checkedTexts()).toEqual(['Blank', 'a', 'b', 'c']);

        datasource.filter(where('firstname', 'NOT_IN', ['b', 'NULL']));
        expect(checkedTexts()).toEqual(['a', 'c']);
    });

    it('expect "Only values in filtered rows" to list the texts of the rows the other filters let through', async () => {
        const { element, datasource } = await mountGrid(config(), rows(['a', 'b', 'c']));
        datasource.filter(where('age', 'GREATER_THAN', 0));

        const available = dropDownFilterData(gridOf(element), 'firstname', true, null);
        expect([texts(available), available?.enableAvailableOnlyOption]).toEqual([['b', 'c'], true]);
        expect(texts(dropDownFilterData(gridOf(element), 'firstname', false, null))).toEqual(['a', 'b', 'c']);
    });
});

describe('dropDownFilterData - grouped', () => {
    it('expect the texts of the data rows, no group rows', async () => {
        const { element, datasource } = await mountGrid(config(), rows(['a', 'b', 'a']));
        datasource.group([{ attribute: 'firstname', title: 'First' }]);

        expect(datasource.getRows().some(isGroupRow)).toBe(true);
        const data = dropDownFilterData(gridOf(element), 'firstname', true, null);
        expect(data?.entries.map((one) => [one.text, one.count])).toEqual([
            ['a', 2],
            ['b', 1]
        ]);
    });
});
