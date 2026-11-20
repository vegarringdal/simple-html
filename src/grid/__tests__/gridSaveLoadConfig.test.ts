// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { GridConfig } from '../gridConfig';
import { footerText, mountGrid, simpleConfig, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * saveConfig/loadConfig/loadInitConfig must hand out and take in copies.
 *
 * The datasource keeps the sorting/filter objects it is given and changes them in place
 * (shift+click sort, the filter context menu adding IS_BLANK/removing a column), so any object
 * shared with it changes behind the user's back.
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

const ageOver15 = () =>
    ({
        type: 'GROUP',
        logicalOperator: 'AND',
        filterArguments: [
            {
                type: 'CONDITION',
                logicalOperator: 'NONE',
                valueType: 'VALUE',
                attribute: 'age',
                attributeType: 'number',
                operator: 'GREATER_THAN',
                value: 15
            }
        ]
    }) as GridConfig['filter'];

const firstnameIsFirst3 = () => ({
    type: 'CONDITION',
    logicalOperator: 'NONE',
    valueType: 'VALUE',
    attribute: 'firstname',
    attributeType: 'text',
    operator: 'EQUAL',
    value: 'first3'
});

/**
 * changes the datasource filter in place and re-runs it, the way the filter context menu does
 * (contextmenuFilter pushes into / filters the current filter object)
 */
function addToFilterInPlace(datasource: any, condition: any) {
    datasource.getFilter().filterArguments.push(condition);
    datasource.filter();
}

describe('saveConfig', () => {
    it('expect the saved sorting not to change when the user adds a sort column', async () => {
        const { datasource, gridInterface } = await mountGrid();
        datasource.sort({ attribute: 'firstname', ascending: true });

        const saved = gridInterface.saveConfig();
        datasource.sort({ attribute: 'age', ascending: false }, true); // shift+click on a header

        expect(saved.sorting).toEqual([{ attribute: 'firstname', ascending: true }]);
    });

    it('expect the saved filter not to change when the filter is changed in place', async () => {
        const config = simpleConfig();
        config.filter = ageOver15();
        const { datasource, gridInterface } = await mountGrid(config);

        const saved = gridInterface.saveConfig();
        addToFilterInPlace(datasource, firstnameIsFirst3());

        expect(saved.filter).toEqual(ageOver15());
    });
});

describe('loadConfig', () => {
    it('expect the config passed in not to be changed by later sorting and filtering', async () => {
        const { datasource, gridInterface } = await mountGrid();

        const config = simpleConfig();
        config.sorting = [{ attribute: 'firstname', ascending: true }];
        config.filter = ageOver15();
        gridInterface.loadConfig(config);

        datasource.sort({ attribute: 'firstname', ascending: false }, true); // shift+click on a header
        addToFilterInPlace(datasource, firstnameIsFirst3());

        expect(config.sorting).toEqual([{ attribute: 'firstname', ascending: true }]);
        expect(config.filter).toEqual(ageOver15());
    });
});

describe('loadInitConfig', () => {
    it('expect the init sorting to come back after a shift+click sort', async () => {
        const config = simpleConfig();
        config.sorting = [{ attribute: 'firstname', ascending: true }];
        const { datasource, gridInterface } = await mountGrid(config);

        gridInterface.loadInitConfig();
        datasource.sort({ attribute: 'firstname', ascending: false }, true); // shift+click on the sorted header
        gridInterface.loadInitConfig();

        expect(datasource.getLastSorting()).toEqual([{ attribute: 'firstname', ascending: true }]);
    });

    it('expect the init filter to come back after the filter was changed in place', async () => {
        const config = simpleConfig();
        config.filter = ageOver15();
        const { element, datasource, gridInterface } = await mountGrid(config);

        gridInterface.loadInitConfig();
        addToFilterInPlace(datasource, firstnameIsFirst3());
        expect(footerText(element)).toContain('1/5');

        gridInterface.loadInitConfig();

        expect(gridInterface.getDatasource().getFilter()).toEqual(ageOver15());
        expect(footerText(element)).toContain('4/5');
    });
});
