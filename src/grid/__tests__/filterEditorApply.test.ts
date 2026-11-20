// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mountGrid, simpleConfig, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { headerFilterInput, menuItem, typeInHeaderFilter } from './interactionTestHelpers';

/**
 * What the filter editor applies when its buttons are pressed.
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('filter editor - typed values', () => {
    /**
     * a typed date went through toSource, which stamps the current time of day on it, so EQUAL
     * never matched and ">=" left out the day itself. The header filter uses toFilter (midnight).
     */
    it('expect a typed date to match rows on that day', async () => {
        const { datasource, gridInterface } = await mountGrid(
            {
                columnsCenter: [
                    { rows: ['name'], width: 100 },
                    { rows: ['born'], width: 100 }
                ],
                attributes: [{ attribute: 'name' }, { attribute: 'born', type: 'date' }]
            },
            [
                { name: 'a', born: new Date(2001, 4, 17) },
                { name: 'b', born: new Date(2001, 4, 18) }
            ]
        );
        // a condition with field and operator already picked
        datasource.filter({
            type: 'GROUP',
            logicalOperator: 'AND',
            filterArguments: [
                {
                    type: 'CONDITION',
                    attribute: 'born',
                    attributeType: 'date',
                    operator: 'EQUAL',
                    valueType: 'VALUE',
                    value: new Date(2001, 4, 18)
                }
            ]
        } as any);
        gridInterface.openFilterEditor();

        const input = document.querySelector('.filter-editor-container .grid-condition input') as HTMLInputElement;
        input.value = '2001-05-17';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        menuItem('Filter Only').click();

        expect(datasource.getRows(true).map((row: any) => row.name)).toEqual(['a']);
    });
});

describe('filter editor - header filter inputs', () => {
    it('expect applying to clear the header text of a column not listed in attributes', async () => {
        const config = simpleConfig();
        // lastname is only named in the column rows
        config.attributes = [{ attribute: 'firstname' }, { attribute: 'age', type: 'number' }];
        const { element, datasource, gridInterface } = await mountGrid(config);
        typeInHeaderFilter(element, 'lastname', 'last1');
        expect(datasource.getRows(true)).toHaveLength(1);

        gridInterface.openFilterEditor();
        // root group trash icon: clear all
        const toolbar = document.querySelector('.filter-editor-container .grid-group') as HTMLElement;
        toolbar.querySelectorAll('svg')[3].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        menuItem('Filter & Close').click();

        expect(datasource.getRows(true)).toHaveLength(5);
        expect(headerFilterInput(element, 'lastname').value).toEqual('');
    });
});
