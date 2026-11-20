// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { or, where } from '../../datasource/filterExpression';
import { mountGrid, simpleConfig, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { headerFilterInput, menuItem, menuItemsExact, openRowMenu, typeInHeaderFilter } from './interactionTestHelpers';

/**
 * Row (cell) right click menu: clear, and the filter entries.
 */

const data = () => [
    { firstname: 'a', lastname: 'x', age: 1 },
    { firstname: 'b', lastname: 'y', age: 2 },
    { firstname: 'c', lastname: 'z', age: 3 },
    { firstname: 'd', lastname: 'x', age: 4 }
];

const names = (datasource: any) => datasource.getRows(true).map((row: any) => row.firstname);

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('row menu - clear', () => {
    it('expect clear to skip selected rows the readonly setter marks readonly', async () => {
        const { element, datasource, gridInterface } = await mountGrid({ ...simpleConfig(), readonly: false }, data());
        gridInterface.readonlySetter((_attribute, rowData: any) => (rowData.firstname === 'b' ? true : null));
        datasource.getSelection().selectRowRange(0, 2);

        openRowMenu(element, 'lastname', 0);
        // paste and clear share the label, clear is the second one
        menuItemsExact('Cell (selected rows)')[1].click();

        expect(datasource.getAllData().map((row: any) => row.lastname)).toEqual([null, 'y', null, 'x']);
    });
});

describe('row menu - add to filter', () => {
    it('expect an OR filter to be kept whole', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        datasource.filter(or(where('firstname', 'EQUAL', 'a'), where('firstname', 'EQUAL', 'b')));

        // lastname "x" of row a
        openRowMenu(element, 'lastname', 0);
        menuItem('Add to filter').click();

        expect(names(datasource)).toEqual(['a']);
    });

    it('expect the header filter text to stay, its condition is kept', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        typeInHeaderFilter(element, 'lastname', 'x');
        expect(names(datasource)).toEqual(['a', 'd']);

        openRowMenu(element, 'firstname', 0);
        menuItem('Add to filter').click();

        expect(names(datasource)).toEqual(['a']);
        expect(headerFilterInput(element, 'lastname').value).toEqual('x');
    });
});

describe('row menu - replace filter', () => {
    it('expect the header text of a column not listed in attributes to be cleared', async () => {
        const config = simpleConfig();
        // lastname is only named in the column rows
        config.attributes = [{ attribute: 'firstname' }, { attribute: 'age' }];
        const { element } = await mountGrid(config, data());
        typeInHeaderFilter(element, 'lastname', 'x');

        openRowMenu(element, 'firstname', 0);
        menuItem('Replace filter').click();

        expect(headerFilterInput(element, 'lastname').value).toEqual('');
    });
});
