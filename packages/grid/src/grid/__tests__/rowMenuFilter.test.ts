// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mountGrid, simpleConfig, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * "Filter:" section in the row context menu - filter on the value of the cell you right
 * clicked, either replacing the current filter or adding to it.
 */

const data = () => [
    { firstname: 'first1', lastname: 'last1', age: 10 },
    { firstname: 'first2', lastname: 'last2', age: 20 },
    { firstname: 'first3', lastname: 'last3', age: 30 }
];

async function openRowMenu(rowIndex = 0, attribute = 'firstname') {
    const mounted = await mountGrid(simpleConfig(), data());
    const cell = mounted.element.querySelectorAll(`input[data-attribute="${attribute}"]`)[rowIndex] as HTMLElement;
    cell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    return mounted;
}

function menuItem(text: string): HTMLElement {
    const items = Array.from(document.querySelectorAll('.simple-html-grid-menu-item'));
    return items.find((el) => el.textContent?.trim().startsWith(text)) as HTMLElement;
}

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('row menu - filter section', () => {
    it('expect a Filter section in the menu', async () => {
        await openRowMenu();
        const sections = Array.from(document.querySelectorAll('.simple-html-grid-menu-section')).map((e) =>
            e.textContent?.trim()
        );
        expect(sections).toContain('Filter:');
    });

    it('expect both filter actions to be offered', async () => {
        await openRowMenu();
        expect(menuItem('Replace filter')).toBeDefined();
        expect(menuItem('Add to filter')).toBeDefined();
    });
});

describe('row menu - replace filter', () => {
    it('expect the grid to be filtered down to the clicked value', async () => {
        const { datasource } = await openRowMenu(1);

        menuItem('Replace filter').click();

        expect(datasource.getRows(true)).toHaveLength(1);
        expect((datasource.getRow(0) as any).firstname).toEqual('first2');
    });

    it('expect replace to throw away whatever filter was there', async () => {
        const { datasource } = await openRowMenu(0);
        datasource.filter([{ attribute: 'lastname', operator: 'EQUAL', value: 'last3' }] as any);

        menuItem('Replace filter').click();

        const filter = datasource.getFilter();
        expect(filter.filterArguments).toHaveLength(1);
        expect(filter.filterArguments[0].attribute).toEqual('firstname');
    });
});

describe('row menu - add to filter', () => {
    it('expect the new condition to be put in front of the existing one', async () => {
        const { datasource } = await openRowMenu(0);
        datasource.filter([{ attribute: 'lastname', operator: 'EQUAL', value: 'last3' }] as any);

        menuItem('Add to filter').click();

        const filter = datasource.getFilter();
        expect(filter.filterArguments).toHaveLength(2);
        expect(filter.filterArguments[0].attribute).toEqual('firstname');
        expect(filter.filterArguments[1].attribute).toEqual('lastname');
    });

    it('expect the conditions to be joined with AND', async () => {
        const { datasource } = await openRowMenu(0);
        datasource.filter([{ attribute: 'lastname', operator: 'EQUAL', value: 'last3' }] as any);

        menuItem('Add to filter').click();

        expect(datasource.getFilter().logicalOperator).toEqual('AND');
    });

    it('expect add to work when there is no filter yet', async () => {
        const { datasource } = await openRowMenu(2);

        menuItem('Add to filter').click();

        expect(datasource.getFilter().filterArguments).toHaveLength(1);
        expect(datasource.getRows(true)).toHaveLength(1);
    });
});

describe('row menu - blank cells', () => {
    it('expect a blank cell to filter on is blank rather than equals nothing', async () => {
        const mounted = await mountGrid(simpleConfig(), [
            { firstname: 'first1', lastname: 'last1', age: 10 },
            { firstname: null, lastname: 'last2', age: 20 }
        ]);
        const cell = mounted.element.querySelectorAll('input[data-attribute="firstname"]')[1] as HTMLElement;
        cell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

        menuItem('Replace filter').click();

        expect(mounted.datasource.getFilter().filterArguments[0].operator).toEqual('IS_BLANK');
        expect(mounted.datasource.getRows(true)).toHaveLength(1);
    });
});
