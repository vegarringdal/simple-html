// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import type { GridElement } from '../gridElement';
import { contextMenuColumnChooser } from '../gridFunctions/contextMenuColumnChooser';
import { GridInterface } from '../gridInterface';
import { installFakeResizeObserver } from './gridLifecycleHelpers';
import {
    footerText,
    mountGrid,
    renderedColumn,
    renderedRows,
    simpleConfig,
    simpleData,
    stubCanvas,
    stubElementSizes
} from './gridTestHelpers';

/**
 * connect/disconnect/move of the custom element, and what it leaves behind when removed
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
    vi.useRealTimers();
    vi.restoreAllMocks();
});

function gridOf(element: GridElement) {
    return (element as any).grid;
}

describe('grid lifecycle - moving the element in the dom', () => {
    it('expect a moved grid to keep following its datasource', async () => {
        const { element, datasource, gridInterface } = await mountGrid();

        const host = document.createElement('div');
        document.body.appendChild(host);
        host.appendChild(element); // disconnectedCallback + connectedCallback

        expect(gridInterface.__isConnected()).toBe(true);

        datasource.setData([{ firstname: 'replaced', lastname: 'x', age: 1 }]);

        expect(renderedColumn(element, 'firstname')).toEqual(['replaced']);
        expect(footerText(element)).toContain('1/1');
    });

    it('expect a moved grid to keep a single copy of its dom', async () => {
        const { element } = await mountGrid();

        const host = document.createElement('div');
        document.body.appendChild(host);
        host.appendChild(element);

        expect(element.querySelectorAll('.simple-html-grid-panel')).toHaveLength(1);
        expect(element.querySelectorAll('.simple-html-grid-body')).toHaveLength(1);
        expect(renderedRows(element)).toHaveLength(5);
    });

    it('expect a moved grid to listen for clicks and resizes again', async () => {
        const { element } = await mountGrid();
        const add = vi.spyOn(document, 'addEventListener');

        const host = document.createElement('div');
        document.body.appendChild(host);
        host.appendChild(element);

        const grid = gridOf(element);
        expect(add.mock.calls.some((call) => call[0] === 'click' && call[1] === grid.clickListner)).toBe(true);
        expect(resizeObserver.current().disconnected).toBe(false);
        expect(resizeObserver.current().observed).toContain(element);
    });
});

describe('grid lifecycle - connecting a new interface', () => {
    it('expect connectInterface twice to keep one dom and show the new data', async () => {
        const { element } = await mountGrid();

        const datasource2 = new Datasource();
        datasource2.setData([{ firstname: 'second', lastname: 'x', age: 1 }]);
        element.connectInterface(new GridInterface(simpleConfig(), datasource2));

        expect(element.querySelectorAll('.simple-html-grid-panel')).toHaveLength(1);
        expect(renderedColumn(element, 'firstname')).toEqual(['second']);
    });

    it('expect connectInterface twice to unsubscribe the old interface from its datasource', async () => {
        const { element, gridInterface } = await mountGrid();

        const datasource2 = new Datasource();
        datasource2.setData(simpleData());
        element.connectInterface(new GridInterface(simpleConfig(), datasource2));

        expect(gridInterface.__isConnected()).toBe(false);
    });

    it('expect enableCleanup + connectInterface twice to build the dom and the wheel listener once', async () => {
        const { element } = await mountGrid();
        element.enableCleanup = true;

        const datasource2 = new Datasource();
        datasource2.setData(simpleData());
        element.connectInterface(new GridInterface(simpleConfig(), datasource2));

        expect(element.querySelectorAll('.simple-html-grid-panel')).toHaveLength(1);
        expect(renderedRows(element)).toHaveLength(5);

        // the wheel listener sits on the element itself, so it is not removed with the children
        const scroller = element.querySelector('.simple-html-grid-body-scroller') as HTMLElement;
        scroller.scrollTop = 0;
        const wheel = new Event('wheel');
        (wheel as any).wheelDeltaY = -40;
        element.dispatchEvent(wheel);
        expect(scroller.scrollTop).toBe(40);
    });
});

describe('grid lifecycle - removing the element', () => {
    it('expect the document click listener to be removed', async () => {
        const add = vi.spyOn(document, 'addEventListener');
        const remove = vi.spyOn(document, 'removeEventListener');
        const { element } = await mountGrid();

        const clickListeners = add.mock.calls.filter((call) => call[0] === 'click').map((call) => call[1]);
        element.remove();
        const removed = remove.mock.calls.filter((call) => call[0] === 'click').map((call) => call[1]);

        expect(clickListeners.length).toBeGreaterThan(0);
        expect(clickListeners.every((listener) => removed.includes(listener))).toBe(true);
    });

    it('expect the resize observer to be disconnected', async () => {
        const { element } = await mountGrid();
        element.remove();
        expect(resizeObserver.current().disconnected).toBe(true);
    });

    it('expect a pending resize rebuild to be cancelled', async () => {
        const { element } = await mountGrid();
        const grid = gridOf(element);
        vi.useFakeTimers();

        resizeObserver.current().fire(); // same size as when created, nothing to do
        stubElementSizes(700, 1000);
        resizeObserver.current().fire(); // grew, schedules a rebuild

        const rebuild = vi.spyOn(grid, 'rebuild');
        element.remove();
        vi.advanceTimersByTime(500);

        expect(rebuild).not.toHaveBeenCalled();
    });

    it('expect removing a grid that never got an interface not to throw', async () => {
        await import('../gridElement');
        const element = document.createElement('simple-html-grid');
        document.body.appendChild(element);
        expect(() => element.remove()).not.toThrow();
    });

    it('expect removing the grid after closing the column chooser not to throw', async () => {
        const { element, gridInterface } = await mountGrid();
        const grid = gridOf(element);

        const cell = element.querySelector('.simple-html-grid-col-cell') as HTMLElement;
        contextMenuColumnChooser(grid, new MouseEvent('contextmenu', { clientX: 100 }), cell);
        (document.querySelector('.simple-html-label-button-menu-bottom') as HTMLElement).click();

        expect(grid.columnChooserMenu).toBeNull();
        expect(() => element.remove()).not.toThrow();
        // the rest of the cleanup must have run too
        expect(gridInterface.__isConnected()).toBe(false);
    });
});

describe('grid lifecycle - before the element is in the dom', () => {
    async function connectedButNotAppended() {
        await import('../gridElement');
        const datasource = new Datasource();
        datasource.setData(simpleData());
        const gridInterface = new GridInterface(simpleConfig(), datasource);
        const element = document.createElement('simple-html-grid') as GridElement;
        // same order as the samples: connect first, append after
        element.connectInterface(gridInterface);
        return { element, datasource, gridInterface };
    }

    it('expect datasource events not to throw', async () => {
        const { datasource } = await connectedButNotAppended();
        expect(() => datasource.setRowAsCurrentEntity(1)).not.toThrow();
        expect(() => datasource.selectNext()).not.toThrow();
        expect(() => datasource.getSelection().highlightRow({} as any, 2)).not.toThrow();
    });

    it('expect interface calls that re-render not to throw', async () => {
        const { gridInterface } = await connectedButNotAppended();
        expect(() => gridInterface.readonlySetter(() => null)).not.toThrow();
        expect(() => gridInterface.cellAppendClassSetter(() => ({ inputClass: '', dimmedClass: '' }))).not.toThrow();
        expect(() => gridInterface.triggerScrollEvent()).not.toThrow();
    });

    it('expect the grid to render normally once appended', async () => {
        const { element, datasource } = await connectedButNotAppended();
        datasource.setRowAsCurrentEntity(1);
        document.body.appendChild(element);
        expect(renderedRows(element)).toHaveLength(5);
    });
});

describe('grid lifecycle - created while hidden', () => {
    it('expect the center columns to render once the grid is shown', async () => {
        // a grid inside a display:none tab: every size is 0 when the dom is built
        stubElementSizes(0, 0);
        const { element } = await mountGrid();
        vi.useFakeTimers();

        // tab is shown. The browser sends no resize callback for an element that is not
        // rendered, so this is the first callback the observer ever gets
        stubElementSizes();
        resizeObserver.current().fire();
        vi.advanceTimersByTime(500);

        expect(renderedRows(element)[0].values).toEqual({ firstname: 'first1', lastname: 'last1', age: '10' });
    });
});

describe('grid lifecycle - triggerScrollEvent', () => {
    it('expect rows to render even when the last scroll position is far away', async () => {
        const data = Array.from({ length: 400 }, (_, i) => ({ firstname: `f${i}`, lastname: 'x', age: i }));
        const { element, gridInterface } = await mountGrid(simpleConfig(), data);
        vi.useFakeTimers();

        // scroll far down like a user would
        const scroller = element.querySelector('.simple-html-grid-body-scroller') as HTMLElement;
        scroller.scrollTop = 3000;
        scroller.dispatchEvent(new Event('scroll'));
        vi.advanceTimersByTime(500);

        // the scroll position goes back to 0 without a scroll event, like when a browser clamps
        // it after the content shrank, then something asks for a re-render
        element.querySelectorAll<HTMLElement>('*').forEach((el) => {
            el.scrollTop = 0;
        });
        gridInterface.triggerScrollEvent();

        expect(renderedRows(element)[0]?.rowIndex).toBe(1);
    });
});
