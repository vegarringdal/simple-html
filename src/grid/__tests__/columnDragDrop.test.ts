// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { GridConfig } from '../gridConfig';
import type { GridInterface } from '../gridInterface';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { dragAndDrop, labelCell, sleep } from './interactionTestHelpers';

/**
 * Column drag/drop in the header and to/from the grouping panel.
 */

const data = () => [
    { firstname: 'a', lastname: 'x', age: 1 },
    { firstname: 'b', lastname: 'y', age: 2 }
];

// the fields of each center column, as the state has them
const centerRows = (gridInterface: GridInterface<unknown>) =>
    gridInterface.getState().layout.center.map((column) => column.fields);

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('drag/drop - moving a cell within its own column', () => {
    it('expect dropping a lower cell on the top of the cell above to swap their order', async () => {
        const config: GridConfig = {
            layout: {
                center: [
                    { fields: ['firstname', 'lastname'], width: 100 },
                    { fields: ['age'], width: 100 }
                ]
            }
        };
        const { element, gridInterface } = await mountGrid(config, data());

        const target = labelCell(element, 'firstname').querySelector('.simple-html-grid-drop-zone-top') as HTMLElement;
        await dragAndDrop(labelCell(element, 'lastname'), target);

        expect(centerRows(gridInterface)).toEqual([['lastname', 'firstname'], ['age']]);
    });

    it('expect dropping the bottom cell below the top cell to put it in the middle', async () => {
        const config: GridConfig = {
            layout: { center: [{ fields: ['firstname', 'lastname', 'age'], width: 100 }] }
        };
        const { element, gridInterface } = await mountGrid(config, data());

        const target = labelCell(element, 'firstname').querySelector('.simple-html-grid-drop-zone-bottom') as HTMLElement;
        await dragAndDrop(labelCell(element, 'age'), target);

        expect(centerRows(gridInterface)).toEqual([['firstname', 'age', 'lastname']]);
    });
});

describe('drag/drop - group chips', () => {
    const threeColumns = (): GridConfig => ({
        layout: {
            center: [
                { fields: ['firstname'], width: 100 },
                { fields: ['lastname'], width: 100 },
                { fields: ['age'], width: 100 }
            ]
        }
    });

    it('expect a group chip dropped on a column to change no columns', async () => {
        const { element, datasource, gridInterface } = await mountGrid(threeColumns(), data());
        datasource.group([{ attribute: 'lastname', title: 'Lastname' }]);
        await sleep(10);

        const chip = element.querySelector('.simple-html-grid-panel-label') as HTMLElement;
        const target = labelCell(element, 'age').querySelector('.simple-html-grid-drop-zone-center') as HTMLElement;
        await dragAndDrop(chip, target);

        expect(centerRows(gridInterface)).toEqual([['firstname'], ['lastname'], ['age']]);
    });

    it('expect a group chip dropped next to a column to add no column', async () => {
        const { element, datasource, gridInterface } = await mountGrid(threeColumns(), data());
        datasource.group([{ attribute: 'lastname', title: 'Lastname' }]);
        await sleep(10);

        const chip = element.querySelector('.simple-html-grid-panel-label') as HTMLElement;
        const target = labelCell(element, 'age').querySelector('.simple-html-grid-drop-zone-left') as HTMLElement;
        await dragAndDrop(chip, target);

        expect(centerRows(gridInterface)).toEqual([['firstname'], ['lastname'], ['age']]);
    });

    it('expect dropping an already grouped column on the panel to not group on it twice', async () => {
        const { element, datasource } = await mountGrid(threeColumns(), data());
        datasource.group([{ attribute: 'lastname', title: 'Lastname' }]);
        await sleep(10);

        const panel = element.querySelector('.simple-html-grid-panel') as HTMLElement;
        await dragAndDrop(labelCell(element, 'lastname'), panel);

        expect(datasource.getGrouping().map((group: any) => group.attribute)).toEqual(['lastname']);
    });
});
