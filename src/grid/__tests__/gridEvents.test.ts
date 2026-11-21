// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import type { GridElement } from '../gridElement';
import type { GridEvents } from '../gridEvents';
import { GridInterface } from '../gridInterface';
import { installFakeResizeObserver } from './gridLifecycleHelpers';
import { mountGrid, renderedColumn, simpleConfig, simpleData, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { gridOf, menuItemsExact, openRowMenu, sleep } from './interactionTestHelpers';

/**
 * gridInterface.on(), and the grid's own subscription to its datasource
 */

let resizeObserver: ReturnType<typeof installFakeResizeObserver>;

beforeAll(() => {
    stubCanvas();
});

beforeEach(() => {
    stubElementSizes();
    resizeObserver = installFakeResizeObserver();
    document.body.innerHTML = '';
});

afterEach(() => {
    document.body.innerHTML = '';
    resizeObserver.restore();
    vi.restoreAllMocks();
});

/**
 * counts the subscriptions on the datasource that are not unsubscribed yet.
 * Call before the grid connects, it subscribes in connectGrid
 */
function trackSubscriptions(datasource: Datasource) {
    let active = 0;
    const on = datasource.on.bind(datasource);
    vi.spyOn(datasource, 'on').mockImplementation((type, handler) => {
        active++;
        const off = on(type, handler);
        let unsubscribed = false;
        return () => {
            if (!unsubscribed) {
                unsubscribed = true;
                active--;
            }
            off();
        };
    });
    return () => active;
}

/**
 * mounts a grid like mountGrid, with the datasource subscriptions counted
 */
async function mountTrackedGrid() {
    await import('../gridElement');
    const datasource = new Datasource();
    datasource.setData(simpleData());
    const activeSubscriptions = trackSubscriptions(datasource);
    const gridInterface = new GridInterface(simpleConfig(), datasource);
    const element = document.createElement('simple-html-grid') as GridElement;
    document.body.appendChild(element);
    element.connectInterface(gridInterface);
    return { element, datasource, gridInterface, activeSubscriptions };
}

/**
 * the input of a body cell, the element the cell events are bound to
 */
function cellInput(element: GridElement, attribute: string, rowIndex = 0) {
    return element.querySelectorAll(`input[data-attribute="${attribute}"]`)[rowIndex] as HTMLInputElement;
}

describe('grid events - grid-connected (was gridConnected)', () => {
    it('expect grid-connected when the element connects the interface', async () => {
        await import('../gridElement');
        const datasource = new Datasource();
        datasource.setData(simpleData());
        const gridInterface = new GridInterface(simpleConfig(), datasource);
        const received: GridEvents['grid-connected'][] = [];
        gridInterface.on('grid-connected', (data) => {
            received.push(data);
        });

        const element = document.createElement('simple-html-grid') as GridElement;
        document.body.appendChild(element);
        element.connectInterface(gridInterface);

        expect(received).toEqual([{}]);
    });

    it('expect grid-connected again when the element is moved in the dom', async () => {
        const { element, gridInterface } = await mountGrid();
        const handler = vi.fn();
        gridInterface.on('grid-connected', handler);

        const host = document.createElement('div');
        document.body.appendChild(host);
        host.appendChild(element); // disconnectedCallback + connectedCallback

        expect(handler).toHaveBeenCalledTimes(1);
    });
});

describe('grid events - cell events', () => {
    it('expect cell-click with the cell, its row and the click', async () => {
        const { element, datasource, gridInterface } = await mountGrid();
        const received: GridEvents['cell-click'][] = [];
        gridInterface.on('cell-click', (data) => {
            received.push(data);
        });

        const input = cellInput(element, 'lastname', 1);
        const click = new MouseEvent('click', { bubbles: true });
        input.dispatchEvent(click);
        await sleep(0); // sent in a setTimeout

        expect(received).toHaveLength(1);
        expect(received[0].attribute).toEqual('lastname');
        expect(received[0].row).toEqual(1);
        expect(received[0].rowData).toBe(datasource.getRows()[1]);
        expect(received[0].cellType).toEqual('row-cell');
        expect(received[0].cell.contains(input)).toBe(true);
        expect(received[0].originalEvent).toBe(click);
    });

    it('expect a handler that returns nothing to keep listening', async () => {
        const { element, gridInterface } = await mountGrid();
        const attributes: string[] = [];
        gridInterface.on('cell-click', (data) => {
            attributes.push(data.attribute);
        });

        cellInput(element, 'firstname').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await sleep(0);
        cellInput(element, 'age').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await sleep(0);

        expect(attributes).toEqual(['firstname', 'age']);
    });

    it('expect the function on() returns to unsubscribe', async () => {
        const { element, gridInterface } = await mountGrid();
        const handler = vi.fn();
        const off = gridInterface.on('cell-click', handler);
        off();

        cellInput(element, 'firstname').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await sleep(0);

        expect(handler).not.toHaveBeenCalled();
    });

    it('expect clear from the row menu with the cell it was opened on', async () => {
        const { element, datasource, gridInterface } = await mountGrid({ ...simpleConfig(), readonly: false });
        datasource.selectAll();
        const received: GridEvents['clear'][] = [];
        gridInterface.on('clear', (data) => {
            received.push(data);
        });

        openRowMenu(element, 'age', 2);
        // paste and clear share the label, clear is the second one
        menuItemsExact('Clear cell (selected rows)')[0].click();

        expect(received).toHaveLength(1);
        expect(received[0].attribute).toEqual('age');
        expect(received[0].row).toEqual(2);
        expect(received[0].rowData).toBe(datasource.getRows()[2]);
        expect(datasource.getAllData().map((row) => row.age)).toEqual([null, null, null, null, null]);
    });
});

describe('grid events - the grid follows its datasource', () => {
    it('expect the grid to rebuild on datasource events while connected', async () => {
        const { element, datasource } = await mountGrid();
        const rebuild = vi.spyOn(gridOf(element), 'rebuild');

        datasource.sort({ attribute: 'age', ascending: false });

        expect(rebuild).toHaveBeenCalledTimes(1);
        expect(renderedColumn(element, 'age')).toEqual(['50', '40', '30', '20', '10']);
    });

    it('expect the grid to unsubscribe from the datasource when it is removed', async () => {
        const { element, datasource, activeSubscriptions } = await mountTrackedGrid();
        expect(activeSubscriptions()).toBeGreaterThan(0);
        const rebuild = vi.spyOn(gridOf(element), 'rebuild');

        element.remove();
        datasource.sort({ attribute: 'age', ascending: false });
        datasource.setData([{ firstname: 'x', lastname: 'y', age: 1 }]);
        datasource.selectAll();

        // nothing left on the datasource that points to the grid, so it can be garbage collected
        expect(activeSubscriptions()).toEqual(0);
        expect(rebuild).not.toHaveBeenCalled();
    });

    it('expect a removed grid that is put back to subscribe again, once', async () => {
        const { element, activeSubscriptions } = await mountTrackedGrid();
        const subscribed = activeSubscriptions();

        element.remove();
        document.body.appendChild(element);

        expect(activeSubscriptions()).toEqual(subscribed);
    });

    it('expect the old interface to unsubscribe from its datasource when a new one is connected', async () => {
        const { element, datasource, activeSubscriptions } = await mountTrackedGrid();
        const datasource2 = new Datasource();
        datasource2.setData(simpleData());
        element.connectInterface(new GridInterface(simpleConfig(), datasource2));
        const rebuild = vi.spyOn(gridOf(element), 'rebuild');

        expect(activeSubscriptions()).toEqual(0);
        datasource.sort({ attribute: 'age', ascending: false });
        expect(rebuild).not.toHaveBeenCalled();

        datasource2.sort({ attribute: 'age', ascending: false });
        expect(rebuild).toHaveBeenCalledTimes(1);
    });

    it('expect connecting the same interface twice to subscribe once', async () => {
        const { element, datasource, gridInterface, activeSubscriptions } = await mountTrackedGrid();
        const subscribed = activeSubscriptions();
        element.connectInterface(gridInterface);
        const rebuild = vi.spyOn(gridOf(element), 'rebuild');

        datasource.sort({ attribute: 'age', ascending: false });

        expect(activeSubscriptions()).toEqual(subscribed);
        expect(rebuild).toHaveBeenCalledTimes(1);
    });

    it('expect setState to rebuild once, not for every datasource event it causes', async () => {
        const { element, gridInterface } = await mountGrid();
        const rebuild = vi.spyOn(gridOf(element), 'rebuild');

        const state = gridInterface.getState();
        state.sorting = [{ attribute: 'age', ascending: false }];
        state.grouping = [{ attribute: 'lastname', title: 'Last name' }];
        gridInterface.setState(state);

        expect(rebuild).toHaveBeenCalledTimes(1);
    });

    it('expect resetState to rebuild once', async () => {
        const { element, datasource, gridInterface } = await mountGrid();
        datasource.group([{ attribute: 'lastname', title: 'Last name' }]);
        const rebuild = vi.spyOn(gridOf(element), 'rebuild');

        gridInterface.resetState();

        expect(rebuild).toHaveBeenCalledTimes(1);
    });
});
