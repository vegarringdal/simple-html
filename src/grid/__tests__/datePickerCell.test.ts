// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
// the picker element registers itself on import, the package entry does this for users
import '../../date/dateElement';
import type { GridConfig } from '../gridConfig';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { sleep } from './interactionTestHelpers';

/**
 * The date picker the grid opens when a date cell is clicked.
 */

const config = (datePickerConfig: any = undefined): GridConfig =>
    ({
        readonly: false,
        columnsCenter: [
            { rows: ['name'], width: 100 },
            { rows: ['born'], width: 100 }
        ],
        attributes: [{ attribute: 'name' }, { attribute: 'born', type: 'date' }],
        datePickerConfig
    }) as GridConfig;

const data = () => [{ name: 'a', born: new Date(2001, 4, 17) }];

/**
 * clicks the date cell, the grid opens the picker in a timeout
 */
async function openPicker(element: HTMLElement) {
    const input = element.querySelector('input[data-attribute="born"]') as HTMLInputElement;
    input.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await sleep(20);
    return document.querySelector('simple-html-date') as HTMLElement;
}

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('grid date picker', () => {
    it('expect the picker to open on the date in the cell', async () => {
        const { element } = await mountGrid(config(), data());

        const picker = await openPicker(element);

        expect(picker.querySelector('.year')?.textContent?.trim()).toEqual('2001');
        expect(picker.querySelector('.simple-html-date-day-selected')?.textContent?.trim()).toEqual('17');
    });

    it('expect the picker to open on the date when the data holds it as an iso string', async () => {
        const { element } = await mountGrid(config(), [{ name: 'a', born: '2001-05-17' }]);

        const picker = await openPicker(element);

        expect(picker.querySelector('.year')?.textContent?.trim()).toEqual('2001');
        expect(picker.querySelector('.simple-html-date-day-selected')?.textContent?.trim()).toEqual('17');
    });

    it('expect weekStart in datePickerConfig not to change the size of the picker', async () => {
        const { element } = await mountGrid(config({ weekStart: 1 }), data());

        const picker = await openPicker(element);

        // default month width 230 plus a 10px margin on both sides
        expect(picker.style.width).toEqual('250px');
    });

    it('expect weekStart 0 to start the week on sunday', async () => {
        const { element } = await mountGrid(config({ weekStart: 0 }), data());

        const picker = await openPicker(element);

        expect(picker.querySelector('.simple-html-date-day-header')?.textContent?.trim()).toEqual('Su');
    });
});
