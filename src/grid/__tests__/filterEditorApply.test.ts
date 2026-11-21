// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import { and, or, where } from '../../datasource/filterExpression';
import { draftToFilter } from '../gridFunctions/renderFilterEditor';
import { mountGrid, simpleConfig, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { headerFilterInput, menuItem, typeInHeaderFilter } from './interactionTestHelpers';

/**
 * What the filter editor applies when its buttons are pressed.
 */

/**
 * clicks an icon in the editor by its tooltip. The editor is rendered again after every click,
 * so it is looked up each time
 */
function clickIcon(tooltipText: string, index = 0) {
    const holder = document.querySelectorAll(`.filter-editor-content [data-tooltip="${tooltipText}"]`)[index] as HTMLElement;
    (holder.querySelector('svg') ?? holder).dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

const editorConditions = () => document.querySelectorAll('.filter-editor-content .grid-condition');

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('filter editor - typed values', () => {
    /**
     * a typed date went through toSource (now parse), which stamps the current time of day on it, so
     * EQUAL never matched and ">=" left out the day itself. The header filter uses parseFilter (midnight).
     */
    it('expect a typed date to match rows on that day', async () => {
        const { datasource, gridInterface } = await mountGrid(
            {
                layout: {
                    center: [
                        { fields: ['name'], width: 100 },
                        { fields: ['born'], width: 100 }
                    ]
                }
            },
            [
                { name: 'a', born: new Date(2001, 4, 17) },
                { name: 'b', born: new Date(2001, 4, 18) }
            ],
            { fields: { born: 'date' } }
        );
        // a condition with field and operator already picked
        datasource.filter(and(where('born', 'EQUAL', new Date(2001, 4, 18))));
        gridInterface.openFilterEditor();

        const input = document.querySelector('.filter-editor-content .grid-condition input') as HTMLInputElement;
        input.value = '2001-05-17';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        menuItem('Filter Only').click();

        expect(datasource.getDataRows().map((row: any) => row.name)).toEqual(['a']);
        // a Date, v5 applied a JSON copy and the date became text
        expect(datasource.getFilter()).toEqual(and(where('born', 'EQUAL', new Date(2001, 4, 17))));
    });
});

describe('filter editor - header filter inputs', () => {
    it('expect applying to clear the header text of a column without a columns entry', async () => {
        const config = simpleConfig();
        // lastname is only named in the layout (v5: only in the column rows, not in attributes)
        config.columns = { firstname: {}, age: {} };
        const { element, datasource, gridInterface } = await mountGrid(config);
        typeInHeaderFilter(element, 'lastname', 'last1');
        expect(datasource.getDataRows()).toHaveLength(1);

        gridInterface.openFilterEditor();
        // root group trash icon: clear all
        const toolbar = document.querySelector('.filter-editor-content .grid-group') as HTMLElement;
        toolbar.querySelectorAll('svg')[3].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        menuItem('Filter & Close').click();

        expect(datasource.getDataRows()).toHaveLength(5);
        expect(headerFilterInput(element, 'lastname').value).toEqual('');
        expect(gridInterface.getState().headerFilters).toEqual({});
        // nothing left is no filter, like "Clear All Filters"
        expect(datasource.getFilter()).toEqual(null);
    });
});

describe('filter editor - a single condition at the root', () => {
    it('expect it to be shown as a condition, and applied in an AND group', async () => {
        const { datasource, gridInterface } = await mountGrid();
        datasource.filter(where('age', 'GREATER_THAN', 15));
        gridInterface.openFilterEditor();

        expect(editorConditions()).toHaveLength(1);
        expect(editorConditions()[0].textContent).toContain('age');

        menuItem('Filter Only').click();

        expect(datasource.getFilter()).toEqual(and(where('age', 'GREATER_THAN', 15)));
        expect(datasource.getDataRows()).toHaveLength(4);
    });
});

describe('filter editor - drafts', () => {
    it('expect a condition that is not filled in to be left out when applied', async () => {
        const { datasource, gridInterface } = await mountGrid();
        datasource.filter(and(where('age', 'GREATER_THAN', 15)));
        gridInterface.openFilterEditor();

        clickIcon('Add a condition to this group');
        clickIcon('Add a sub group inside this group');
        expect(editorConditions()).toHaveLength(2);
        menuItem('Filter Only').click();

        // the draft is gone, the empty sub group is kept (the filter ignores it)
        expect(datasource.getFilter()).toEqual(and(where('age', 'GREATER_THAN', 15), and()));
        expect(datasource.getDataRows()).toHaveLength(4);
        // the open dialog keeps its draft
        expect(editorConditions()).toHaveLength(2);
    });

    it('expect "compare with a column" without the column picked to be left out', async () => {
        const { datasource, gridInterface } = await mountGrid();
        datasource.filter(and(where('firstname', 'EQUAL', 'first1'), where('age', 'GREATER_THAN', 15)));
        gridInterface.openFilterEditor();

        // switch the first condition to "compare with a column"
        clickIcon('Compare against another column instead of a typed in value');
        expect(
            document.querySelector('.filter-editor-content [data-tooltip="Pick which column to compare against"]')
        ).not.toBeNull();
        menuItem('Filter Only').click();

        expect(datasource.getFilter()).toEqual(and(where('age', 'GREATER_THAN', 15)));
    });

    it('expect a valueField condition to show the other column and be applied as it is', async () => {
        const { datasource, gridInterface } = await mountGrid(simpleConfig(), [
            { firstname: 'same', lastname: 'same', age: 1 },
            { firstname: 'a', lastname: 'b', age: 2 }
        ]);
        datasource.filter(and({ field: 'firstname', operator: 'EQUAL', valueField: 'lastname' }));
        gridInterface.openFilterEditor();

        const picker = document.querySelector(
            '.filter-editor-content [data-tooltip="Pick which column to compare against"]'
        ) as HTMLElement;
        expect(picker.textContent?.trim()).toEqual('lastname');
        menuItem('Filter Only').click();

        expect(datasource.getFilter()).toEqual(and({ field: 'firstname', operator: 'EQUAL', valueField: 'lastname' }));
        expect(datasource.getDataRows()).toHaveLength(1);
    });
});

describe('filter editor - draftToFilter', () => {
    const datasource = new Datasource({ fields: { born: 'date' } });

    it('expect complete conditions and every group to be kept', () => {
        const filter = and(where('a', 'EQUAL', 'x'), or(where('b', 'IS_BLANK'), and()));
        expect(draftToFilter(filter, datasource)).toEqual(filter);
    });

    it('expect drafts the filter would ignore to be left out', () => {
        const draft = {
            group: 'OR' as const,
            children: [
                {},
                { field: 'a' },
                { operator: 'EQUAL' as const, value: 'x' },
                // "compare with a column", the column not picked yet
                { field: 'a', operator: 'EQUAL' as const, valueField: '' },
                // a date needs a value
                { field: 'born', operator: 'EQUAL' as const, value: null },
                { field: 'a', operator: 'EQUAL' as const, value: 'kept' }
            ]
        };
        expect(draftToFilter(draft, datasource)).toEqual(or(where('a', 'EQUAL', 'kept')));
    });

    it('expect a picked valueField to replace the value', () => {
        const draft = {
            group: 'AND' as const,
            children: [{ field: 'a', operator: 'EQUAL' as const, value: 'left over', valueField: 'b' }]
        };
        expect(draftToFilter(draft, datasource)).toEqual(and({ field: 'a', operator: 'EQUAL', valueField: 'b' }));
    });
});
