// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { isPopoverShown } from '../../__tests__/popoverStub';
// the picker element registers itself on import, the package entry does this for users
import '../../date/dateElement';
import type { IDateConfig } from '../../date/interfaces';
import type { GridConfig } from '../gridConfig';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { sleep } from './interactionTestHelpers';

/**
 * The date picker the grid opens when a date cell is clicked.
 */

// only the fields to change: datePickerConfig is a Partial<IDateConfig>, it used to need every field
const config = (datePickerConfig?: Partial<IDateConfig>): GridConfig => ({
    readonly: false,
    layout: {
        center: [
            { fields: ['name'], width: 100 },
            { fields: ['born'], width: 100 }
        ]
    },
    datePickerConfig
});

const data = () => [{ name: 'a', born: new Date(2001, 4, 17) }];

// the type of a column comes from the datasource
const fields = { fields: { born: 'date' as const } };

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
    it("expect the picker to be the grid's menu: a manual popover on the body, closed on Esc", async () => {
        const { element } = await mountGrid(config(), data(), fields);

        const picker = await openPicker(element);
        const menu = picker.parentElement as HTMLElement;

        expect(menu.parentElement).toBe(document.body);
        expect(menu.className).toEqual('simple-html-grid simple-html-grid-popover');
        expect(menu.popover).toEqual('manual');
        expect(isPopoverShown(menu)).toBe(true);
        // the top layer: no z-index of its own anymore
        expect(menu.style.zIndex).toEqual('');

        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        expect(menu.isConnected).toBe(false);
    });

    it('expect a click in the picker not to close it, a click outside to close it', async () => {
        const { element } = await mountGrid(config(), data(), fields);
        const picker = await openPicker(element);

        (picker.querySelector('.simple-html-date-day') as HTMLElement).click();
        expect(picker.isConnected).toBe(true);

        document.body.click();
        expect(picker.isConnected).toBe(false);
    });

    it('expect the picker to open on the date in the cell', async () => {
        const { element } = await mountGrid(config(), data(), fields);

        const picker = await openPicker(element);

        expect(picker.querySelector('.year')?.textContent?.trim()).toEqual('2001');
        expect(picker.querySelector('.simple-html-date-day-selected')?.textContent?.trim()).toEqual('17');
    });

    it('expect the picker to open on the date when the data holds it as an iso string', async () => {
        const { element } = await mountGrid(config(), [{ name: 'a', born: '2001-05-17' }], fields);

        const picker = await openPicker(element);

        expect(picker.querySelector('.year')?.textContent?.trim()).toEqual('2001');
        expect(picker.querySelector('.simple-html-date-day-selected')?.textContent?.trim()).toEqual('17');
    });

    it('expect weekStart in datePickerConfig not to change the size of the picker', async () => {
        const { element } = await mountGrid(config({ weekStart: 1 }), data(), fields);

        const picker = await openPicker(element);

        // default month width 230 plus a 10px margin on both sides
        expect(picker.style.width).toEqual('250px');
    });

    it('expect weekStart 0 to start the week on sunday', async () => {
        const { element } = await mountGrid(config({ weekStart: 0 }), data(), fields);

        const picker = await openPicker(element);

        expect(picker.querySelector('.simple-html-date-day-header')?.textContent?.trim()).toEqual('Su');
    });

    it('expect every field the grid reads to have a default', async () => {
        const { element } = await mountGrid(config({}), data(), fields);

        const picker = await openPicker(element);

        // English names, weeks from monday with their numbers, 230px month with 10px margins
        expect(picker.querySelector('.simple-html-date-day-header')?.textContent?.trim()).toEqual('Mo');
        expect(picker.textContent).toContain('May');
        expect(picker.querySelectorAll('.simple-html-date-week').length).toBeGreaterThan(0);
        expect(picker.style.width).toEqual('250px');
        // the dimmed days of the months around are shown
        expect(picker.querySelectorAll('.simple-html-date-day-hidden').length).toEqual(0);
    });

    it('expect the fields given to change only themselves', async () => {
        const { element } = await mountGrid(config({ showWeek: false, monthWidth: 300 }), data(), fields);

        const picker = await openPicker(element);

        expect(picker.querySelectorAll('.simple-html-date-week').length).toEqual(0);
        expect(picker.style.width).toEqual('320px');
        expect(picker.querySelector('.simple-html-date-day-header')?.textContent?.trim()).toEqual('Mo');
    });
});
