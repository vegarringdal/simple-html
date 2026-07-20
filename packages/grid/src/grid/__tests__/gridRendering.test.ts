// @vitest-environment happy-dom

import { beforeAll, describe, expect, it } from 'vitest';
import {
    footerText,
    mountGrid,
    renderedColumn,
    renderedGroupRows,
    renderedRows,
    simpleConfig,
    stubCanvas,
    stubElementSizes
} from './gridTestHelpers';

/**
 * gui level tests - these drive the datasource and assert on what actually ends up in the dom.
 *
 * The point is to have a cheap safety net for refactors of the render/scroll layer:
 * if rows stop rendering, stop reordering on sort, or stop reacting to filters,
 * these fail without anyone having to open a browser.
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

describe('grid rendering - initial render', () => {
    it('expect one rendered row per data row', async () => {
        const { element } = await mountGrid();
        expect(renderedRows(element)).toHaveLength(5);
    });

    it('expect cell values to match the data', async () => {
        const { element } = await mountGrid();
        expect(renderedColumn(element, 'firstname')).toEqual(['first1', 'first2', 'first3', 'first4', 'first5']);
    });

    it('expect every configured attribute to be rendered', async () => {
        const { element } = await mountGrid();
        expect(renderedRows(element)[0].values).toEqual({
            firstname: 'first1',
            lastname: 'last1',
            age: '10'
        });
    });

    it('expect the footer to show filtered/total', async () => {
        const { element } = await mountGrid();
        expect(footerText(element)).toContain('5/5');
    });

    it('expect even and odd row classes to alternate', async () => {
        const { element } = await mountGrid();
        const rows = renderedRows(element);
        expect(rows[0].classes).toContain('simple-html-grid-row-even');
        expect(rows[1].classes).toContain('simple-html-grid-row-odd');
    });

    it('expect an empty datasource to render no rows', async () => {
        const { element } = await mountGrid(simpleConfig(), []);
        expect(renderedRows(element)).toHaveLength(0);
    });
});

describe('grid rendering - reacting to data changes', () => {
    it('expect setData to re-render the rows', async () => {
        const { element, datasource } = await mountGrid();

        datasource.setData([{ firstname: 'replaced', lastname: 'x', age: 1 }]);

        expect(renderedRows(element)).toHaveLength(1);
        expect(renderedColumn(element, 'firstname')).toEqual(['replaced']);
    });

    it('expect appended data to be rendered', async () => {
        const { element, datasource } = await mountGrid();

        datasource.setData([{ firstname: 'first6', lastname: 'last6', age: 60 }], true);

        expect(renderedRows(element)).toHaveLength(6);
        expect(renderedColumn(element, 'firstname')).toContain('first6');
    });

    it('expect the footer to follow the row count', async () => {
        const { element, datasource } = await mountGrid();

        datasource.setData([{ firstname: 'only', lastname: 'one', age: 1 }]);

        expect(footerText(element)).toContain('1/1');
    });

    it('expect an edit through the entity to show after a rerender', async () => {
        const { element, datasource, gridInterface } = await mountGrid();

        datasource.getRow(0).firstname = 'edited';
        gridInterface.triggerScrollEvent();

        expect(renderedColumn(element, 'firstname')[0]).toEqual('edited');
    });
});

describe('grid rendering - sorting', () => {
    it('expect a descending sort to reverse the rendered order', async () => {
        const { element, datasource } = await mountGrid();

        datasource.sort([{ attribute: 'firstname', ascending: false }]);

        expect(renderedColumn(element, 'firstname')).toEqual(['first5', 'first4', 'first3', 'first2', 'first1']);
    });

    it('expect an ascending sort to restore the original order', async () => {
        const { element, datasource } = await mountGrid();

        datasource.sort([{ attribute: 'firstname', ascending: false }]);
        datasource.sort([{ attribute: 'firstname', ascending: true }]);

        expect(renderedColumn(element, 'firstname')).toEqual(['first1', 'first2', 'first3', 'first4', 'first5']);
    });

    it('expect a numeric sort to order numerically and not as text', async () => {
        const data = [
            { firstname: 'a', lastname: 'x', age: 100 },
            { firstname: 'b', lastname: 'x', age: 9 },
            { firstname: 'c', lastname: 'x', age: 20 }
        ];
        const { element, datasource } = await mountGrid(simpleConfig(), data);

        datasource.sort([{ attribute: 'age', ascending: true }]);

        expect(renderedColumn(element, 'age')).toEqual(['9', '20', '100']);
    });
});

describe('grid rendering - filtering', () => {
    it('expect a filter to reduce the rendered rows', async () => {
        const { element, datasource } = await mountGrid();

        datasource.filter([{ attribute: 'firstname', operator: 'EQUAL', value: 'first2' }] as any);

        expect(renderedColumn(element, 'firstname')).toEqual(['first2']);
    });

    it('expect the footer to show filtered count against the total', async () => {
        const { element, datasource } = await mountGrid();

        datasource.filter([{ attribute: 'firstname', operator: 'EQUAL', value: 'first2' }] as any);

        expect(footerText(element)).toContain('1/5');
    });

    it('expect clearing the filter to bring every row back', async () => {
        const { element, datasource } = await mountGrid();

        datasource.filter([{ attribute: 'firstname', operator: 'EQUAL', value: 'first2' }] as any);
        datasource.setFilter(null);
        datasource.filter();

        expect(renderedRows(element)).toHaveLength(5);
    });

    it('expect a filter matching nothing to render no rows', async () => {
        const { element, datasource } = await mountGrid();

        datasource.filter([{ attribute: 'firstname', operator: 'EQUAL', value: 'nope' }] as any);

        expect(renderedRows(element)).toHaveLength(0);
        expect(footerText(element)).toContain('0/5');
    });

    it('expect a wildcard filter to match by prefix', async () => {
        const { element, datasource } = await mountGrid();

        datasource.filter([{ attribute: 'lastname', operator: 'EQUAL', value: 'last*' }] as any);

        expect(renderedRows(element)).toHaveLength(5);
    });
});

describe('grid rendering - grouping', () => {
    const grouped = () => [
        { firstname: 'a', lastname: 'group1', age: 1 },
        { firstname: 'b', lastname: 'group1', age: 2 },
        { firstname: 'c', lastname: 'group2', age: 3 }
    ];

    it('expect group rows to be rendered', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), grouped());

        datasource.group([{ attribute: 'lastname' }] as any);

        expect(renderedGroupRows(element).length).toBeGreaterThan(0);
    });

    it('expect collapsed groups to hide their data rows', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), grouped());

        datasource.group([{ attribute: 'lastname' }] as any);
        datasource.collapseGroup();

        expect(renderedColumn(element, 'firstname').filter(Boolean)).toHaveLength(0);
    });

    it('expect expanding groups to show the data rows again', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), grouped());

        datasource.group([{ attribute: 'lastname' }] as any);
        datasource.collapseGroup();
        datasource.expandGroup();

        expect(renderedColumn(element, 'firstname').filter(Boolean)).toHaveLength(3);
    });

    it('expect removing the grouping to restore a flat list', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), grouped());

        datasource.group([{ attribute: 'lastname' }] as any);
        datasource.removeGroup();

        expect(renderedColumn(element, 'firstname')).toEqual(['a', 'b', 'c']);
        expect(renderedGroupRows(element)).toHaveLength(0);
    });
});

describe('grid rendering - selection', () => {
    it('expect a selected row to get the selected class', async () => {
        const { element, datasource } = await mountGrid();

        datasource.getSelection().highlightRow({} as any, 0);

        expect(renderedRows(element)[0].classes).toContain('simple-html-grid-selected-row-even');
    });

    it('expect selectAll to mark every row', async () => {
        const { element, datasource } = await mountGrid();

        datasource.selectAll();

        renderedRows(element).forEach((row) => {
            expect(row.classes).toContain('selected-row');
        });
    });

    it('expect deSelectAll to clear the marks', async () => {
        const { element, datasource } = await mountGrid();

        datasource.selectAll();
        datasource.deSelectAll(true);

        renderedRows(element).forEach((row) => {
            expect(row.classes).not.toContain('selected-row');
        });
    });
});

describe('grid rendering - config', () => {
    it('expect readonly cells by default', async () => {
        const { element } = await mountGrid();
        const input = element.querySelector('input[data-attribute="firstname"]') as HTMLInputElement;
        expect(input.readOnly).toEqual(true);
    });

    it('expect edit mode to make cells writable', async () => {
        const config = simpleConfig();
        config.readonly = false;
        const { element } = await mountGrid(config);

        const input = element.querySelector('input[data-attribute="firstname"]') as HTMLInputElement;
        expect(input.readOnly).toEqual(false);
    });

    it('expect only configured columns to be rendered', async () => {
        const config = simpleConfig();
        config.columnsCenter = [{ rows: ['firstname'], width: 100 }];
        const { element } = await mountGrid(config);

        expect(Object.keys(renderedRows(element)[0].values)).toEqual(['firstname']);
    });

    it('expect a filter row to be rendered by default', async () => {
        const { element } = await mountGrid();
        expect(element.querySelectorAll('.simple-html-grid-cell-filter-input').length).toBeGreaterThan(0);
    });
});
