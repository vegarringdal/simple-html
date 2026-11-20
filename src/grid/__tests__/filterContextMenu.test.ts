// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mountGrid, simpleConfig, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { headerFilterInput, menuItem, openFilterMenu, typeInHeaderFilter } from './interactionTestHelpers';

/**
 * The right click menu on a header filter: "Is Blank" and the excel style value list.
 */

const names = (datasource: any) => datasource.getRows(true).map((row: any) => row.firstname);

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
        datasource.filter({
            type: 'GROUP',
            logicalOperator: 'OR',
            filterArguments: [
                { type: 'CONDITION', attribute: 'firstname', operator: 'EQUAL', value: 'a', attributeType: 'text' },
                { type: 'CONDITION', attribute: 'firstname', operator: 'EQUAL', value: 'b', attributeType: 'text' }
            ]
        } as any);

        openFilterMenu(element, 'lastname');
        menuItem('Set "Is Blank"').click();

        expect(names(datasource)).toEqual(['b']);
    });

    it('expect "Is Blank" to clear the text filter shown in the header', async () => {
        const { element } = await mountGrid(simpleConfig(), data());
        typeInHeaderFilter(element, 'lastname', 'x');

        openFilterMenu(element, 'lastname');
        menuItem('Set "Is Blank"').click();

        expect(headerFilterInput(element, 'lastname').value).toEqual('');
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
