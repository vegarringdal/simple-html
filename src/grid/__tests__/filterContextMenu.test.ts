// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, or, where } from '../../datasource/filterExpression';
import { mountGrid, simpleConfig, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { headerFilterInput, menuEntry, menuItem, openFilterMenu, typeInHeaderFilter } from './interactionTestHelpers';

/**
 * The right click menu on a header filter: "Is Blank" and the excel style value list.
 */

const names = (datasource: any) => datasource.getDataRows().map((row: any) => row.firstname);

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('filter menu - "Is Blank"', () => {
    const data = () => [
        { firstname: 'a', lastname: 'x', age: 1 },
        { firstname: 'b', lastname: null, age: 2 },
        { firstname: 'c', lastname: 'z', age: 3 },
        { firstname: 'd', lastname: null, age: 4 }
    ];

    it('expect "Is Blank" on an OR filter to narrow it, not widen it', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        datasource.filter(or(where('firstname', 'EQUAL', 'a'), where('firstname', 'EQUAL', 'b')));

        openFilterMenu(element, 'lastname');
        menuEntry('filter.filter.isBlank').click();

        expect(names(datasource)).toEqual(['b']);
    });

    it('expect "Is Blank" to keep a single condition on another column', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        datasource.filter(where('age', 'LESS_THAN', 3));

        openFilterMenu(element, 'lastname');
        menuEntry('filter.filter.isBlank').click();

        // v5 dropped a root condition that was not in a group
        expect(datasource.getFilter()).toEqual(and(where('lastname', 'IS_BLANK'), where('age', 'LESS_THAN', 3)));
        expect(names(datasource)).toEqual(['b']);
    });

    it('expect "Is Blank" to replace a single condition on its own column', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        datasource.filter(where('lastname', 'EQUAL', 'x'));

        openFilterMenu(element, 'lastname');
        menuEntry('filter.filter.isBlank').click();

        expect(datasource.getFilter()).toEqual(and(where('lastname', 'IS_BLANK')));
        expect(names(datasource)).toEqual(['b', 'd']);
    });

    it('expect "Is Blank" to clear the text filter shown in the header', async () => {
        const { element } = await mountGrid(simpleConfig(), data());
        typeInHeaderFilter(element, 'lastname', 'x');

        openFilterMenu(element, 'lastname');
        menuEntry('filter.filter.isBlank').click();

        expect(headerFilterInput(element, 'lastname').value).toEqual('');
    });
});

describe('filter menu - "Clear Filter"', () => {
    const data = () => [
        { firstname: 'a', lastname: 'x', age: 1 },
        { firstname: 'b', lastname: 'y', age: 2 },
        { firstname: 'c', lastname: 'z', age: 3 }
    ];

    it('expect the column conditions to be removed from nested groups too, the rest kept', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        datasource.filter(
            and(where('lastname', 'EQUAL', 'x'), or(where('lastname', 'EQUAL', 'z'), where('age', 'LESS_THAN', 3)))
        );

        openFilterMenu(element, 'lastname');
        menuItem('Clear Filter').click();

        expect(datasource.getFilter()).toEqual(and(or(where('age', 'LESS_THAN', 3))));
        expect(names(datasource)).toEqual(['a', 'b']);
    });

    it('expect the filter object that was set not to be changed', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        const filter = and(where('lastname', 'EQUAL', 'x'), where('age', 'LESS_THAN', 3));
        datasource.filter(filter);

        openFilterMenu(element, 'lastname');
        menuItem('Clear Filter').click();

        expect(filter).toEqual(and(where('lastname', 'EQUAL', 'x'), where('age', 'LESS_THAN', 3)));
        expect(names(datasource)).toEqual(['a', 'b']);
    });

    it('expect a single condition on the column to leave no filter', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        datasource.filter(where('lastname', 'EQUAL', 'x'));

        openFilterMenu(element, 'lastname');
        menuItem('Clear Filter').click();

        expect(datasource.getFilter()).toEqual(null);
        expect(names(datasource)).toEqual(['a', 'b', 'c']);
    });
});

describe('filter menu - value list', () => {
    const data = () => ['a', 'b', 'c', 'd', 'e'].map((firstname, i) => ({ firstname, lastname: 'x', age: i }));

    const valueLabel = (value: string) =>
        Array.from(document.querySelectorAll('.simple-html-grid-menu-checkbox label')).find((label) =>
            label.textContent?.trim().startsWith(value)
        ) as HTMLElement;

    const valueChecked = (value: string) => (valueLabel(value).previousElementSibling as HTMLInputElement).checked;

    /**
     * open the value list on firstname, toggle the given values, run it
     */
    function runValueList(element: any, toggle: string[]) {
        openFilterMenu(element, 'firstname');
        toggle.forEach((value) => {
            valueLabel(value).click();
        });
        menuItem('Run Search').click();
    }

    it('expect unchecking one more value to keep the values excluded earlier', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        runValueList(element, ['D', 'E']);
        expect(names(datasource)).toEqual(['a', 'b', 'c']);

        runValueList(element, ['A']);

        expect(names(datasource)).toEqual(['b', 'c']);
    });

    it('expect the values the column excluded itself to be listed unchecked', async () => {
        const { element } = await mountGrid(simpleConfig(), data());
        runValueList(element, ['D', 'E']);

        openFilterMenu(element, 'firstname');

        expect(valueChecked('A')).toEqual(true);
        expect(valueChecked('D')).toEqual(false);
        expect(valueChecked('E')).toEqual(false);
    });

    it('expect checking an excluded value again to bring it back', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        runValueList(element, ['D', 'E']);

        runValueList(element, ['D']);

        expect(names(datasource)).toEqual(['a', 'b', 'c', 'd']);
    });
});
