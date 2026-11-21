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

/**
 * the signal of addEventListener's options, the third argument (a boolean or an options object)
 */
function optionsSignal(options: unknown): AbortSignal | undefined {
    if (options && typeof options === 'object' && 'signal' in options && options.signal instanceof AbortSignal) {
        return options.signal;
    }
    return undefined;
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

        // the menu listeners on the document, added again with a new signal
        const grid = gridOf(element);
        const signal: AbortSignal = grid.menuListenersAbort.signal;
        for (const type of ['click', 'keydown']) {
            expect(add.mock.calls.some((call) => call[0] === type && optionsSignal(call[2]) === signal)).toBe(true);
        }
        expect(signal.aborted).toBe(false);
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

    it('expect connectInterface twice to keep the dom and the wheel listener once', async () => {
        const { element } = await mountGrid();

        const datasource2 = new Datasource();
        datasource2.setData(simpleData());
        element.connectInterface(new GridInterface(simpleConfig(), datasource2));

        expect(element.querySelectorAll('.simple-html-grid-panel')).toHaveLength(1);
        expect(renderedRows(element)).toHaveLength(5);

        // the wheel listener sits on the element itself: one tick scrolls once
        const scroller = element.querySelector('.simple-html-grid-body-scroller') as HTMLElement;
        scroller.scrollTop = 0;
        const wheel = new Event('wheel');
        (wheel as any).wheelDeltaY = -40;
        element.dispatchEvent(wheel);
        expect(scroller.scrollTop).toBe(40);
    });
});

describe('grid lifecycle - removing the element', () => {
    it('expect the document click and keydown listeners to be removed', async () => {
        const add = vi.spyOn(document, 'addEventListener');
        const { element } = await mountGrid();

        // added with an AbortSignal: aborting it removes them
        const signals = add.mock.calls
            .filter((call) => call[0] === 'click' || call[0] === 'keydown')
            .map((call) => optionsSignal(call[2]));
        element.remove();

        expect(signals.length).toBe(2);
        expect(signals.every((signal) => signal?.aborted)).toBe(true);
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
        expect(() => gridInterface.updateHooks({ isReadonly: () => null, cellClass: () => null })).not.toThrow();
        expect(() => gridInterface.updateConfig({ readonly: false })).not.toThrow();
        expect(() => gridInterface.updateConfig({ layout: { center: [{ fields: ['age'], width: 50 }] } })).not.toThrow();
        expect(() => gridInterface.refresh()).not.toThrow();
        expect(() => gridInterface.rebuild()).not.toThrow();
        expect(() => gridInterface.autoResizeColumns()).not.toThrow();
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

describe('grid lifecycle - refresh', () => {
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
        gridInterface.refresh();

        expect(renderedRows(element)[0]?.rowIndex).toBe(1);
    });
});

describe('grid lifecycle - refresh and rebuild', () => {
    const rowElements = (element: GridElement) =>
        element.querySelectorAll('.simple-html-grid-body-row-container-pinned-middle > .simple-html-grid-row').length;

    it('expect refresh to show a value set on a row object, without a rebuild', async () => {
        const { element, datasource, gridInterface } = await mountGrid();
        const rebuild = vi.spyOn(gridOf(element), 'rebuild');

        // set outside of the grid's editing: the grid does not know
        datasource.getRow(0).firstname = 'changed';
        expect(renderedColumn(element, 'firstname')[0]).toBe('first1');

        gridInterface.refresh();

        expect(renderedColumn(element, 'firstname')[0]).toBe('changed');
        expect(rebuild).not.toHaveBeenCalled();
    });

    it('expect rebuild to build the rows again for a size the grid was not told about', async () => {
        const { element, gridInterface } = await mountGrid();
        // 600px / 22px a row, and 5 extra
        expect(rowElements(element)).toBe(32);

        stubElementSizes(1200, 1000);
        gridInterface.refresh();
        expect(rowElements(element)).toBe(32);

        gridInterface.rebuild();
        expect(rowElements(element)).toBe(59);
        expect(renderedColumn(element, 'firstname')).toEqual(['first1', 'first2', 'first3', 'first4', 'first5']);
    });

    it('expect refresh and rebuild to do nothing once the grid is removed', async () => {
        const { element, gridInterface } = await mountGrid();
        const rebuild = vi.spyOn(gridOf(element), 'rebuild');
        element.remove();

        gridInterface.refresh();
        gridInterface.rebuild();

        expect(rebuild).not.toHaveBeenCalled();
    });
});

describe('grid lifecycle - disableResizeEvent / enableResizeEvent', () => {
    it('expect disableResizeEvent to disconnect the resize observer', async () => {
        const { element } = await mountGrid();
        const grid = gridOf(element);
        const observer = resizeObserver.current();

        grid.disableResizeEvent();

        expect(observer.disconnected).toBe(true);
        expect(grid.resizeObserver).toBeNull();
    });

    it('expect disableResizeEvent to cancel a pending resize rebuild', async () => {
        const { element } = await mountGrid();
        const grid = gridOf(element);
        vi.useFakeTimers();
        stubElementSizes(700, 1000);
        resizeObserver.current().fire(); // grew, schedules a rebuild
        const rebuild = vi.spyOn(grid, 'rebuild');

        grid.disableResizeEvent();
        vi.advanceTimersByTime(500);

        expect(rebuild).not.toHaveBeenCalled();
    });

    it('expect a disabled grid that is moved in the dom to get no resize observer', async () => {
        const { element } = await mountGrid();
        gridOf(element).disableResizeEvent();
        const observers = resizeObserver.instances.length;

        const host = document.createElement('div');
        document.body.appendChild(host);
        host.appendChild(element); // disconnectedCallback + connectedCallback

        expect(resizeObserver.instances.length).toBe(observers);
    });

    it('expect enableResizeEvent to rebuild on a resize again', async () => {
        const { element } = await mountGrid();
        const grid = gridOf(element);
        grid.disableResizeEvent();

        grid.enableResizeEvent();

        const observer = resizeObserver.current();
        expect(observer.disconnected).toBe(false);
        expect(observer.observed).toContain(element);

        vi.useFakeTimers();
        const rebuild = vi.spyOn(grid, 'rebuild');
        stubElementSizes(700, 1000);
        observer.fire();
        vi.advanceTimersByTime(500);
        expect(rebuild).toHaveBeenCalledTimes(1);
    });

    it('expect enableResizeEvent on a grid that is not in the dom to wait until it is', async () => {
        const { element } = await mountGrid();
        const grid = gridOf(element);
        grid.disableResizeEvent();
        element.remove();
        const observers = resizeObserver.instances.length;

        grid.enableResizeEvent();
        expect(resizeObserver.instances.length).toBe(observers);

        document.body.appendChild(element);
        expect(resizeObserver.instances.length).toBe(observers + 1);
        expect(resizeObserver.current().observed).toContain(element);
    });
});
