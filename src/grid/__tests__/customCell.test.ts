// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { isPopoverShown } from '../../__tests__/popoverStub';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import { isGroupRow } from '../../datasource/entity';
// the picker element registers itself on import, the package entry does this for users
import '../../date/dateElement';
import { Datasource } from '../../datasource/dataSource';
import { type CellRenderContext, type CellRendererInstance, registerCellRenderer } from '../cellRendererRegistry';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import type { HTMLCellElement } from '../gridFunctions/HTMLCellElement';
import type { GridHooks } from '../gridHooks';
import { GridInterface } from '../gridInterface';
import { registerLookup } from '../lookup';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { sleep } from './interactionTestHelpers';

/**
 * Custom cells: a column drawn by a renderer of your own (`ColumnConfig.renderer`, customCell.ts) - the
 * registry, the lifecycle of the renderers (one per cell element, destroyed on every way a cell element
 * is done with it), what the grid gives them and what a write from them does, the keys and events of
 * the cell, what the grid shows on any cell, and editing a cell the renderer only draws (step 2): the
 * editor of one line, the multiline one, the date picker, a renderer's own edit().
 *
 * happy-dom runs a requestAnimationFrame callback in the next task: frame() waits for the grid's frame.
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

afterEach(() => {
    vi.restoreAllMocks();
});

/** what a renderer of the tests was asked to do */
interface RendererLog {
    mounts: number;
    destroys: number;
    /** the hosts it was given, one per mount */
    hosts: HTMLElement[];
    /** every update(), in order */
    updates: CellRenderContext<any>[];
    /** the calls of edit(), with what was typed */
    edits: (string | undefined)[];
}

let ids = 0;

/**
 * Registers a renderer that records what it is asked: a span with the text in the host
 * @param more what the instance has more: an edit() of its own
 * @returns its id and its log
 */
function recorder(more: { edit?: boolean; content?: (host: HTMLElement) => void } = {}) {
    const id = `recorder-${++ids}`;
    const log: RendererLog = { mounts: 0, destroys: 0, hosts: [], updates: [], edits: [] };
    registerCellRenderer(id, (host) => {
        log.mounts++;
        log.hosts.push(host);
        const span = document.createElement('span');
        span.className = 'recorded';
        host.appendChild(span);
        more.content?.(host);
        const instance: CellRendererInstance<any> = {
            update(context) {
                log.updates.push(context);
                span.textContent = context.text;
            },
            destroy() {
                log.destroys++;
            }
        };
        if (more.edit) {
            instance.edit = (typed) => log.edits.push(typed);
        }
        return instance;
    });
    return { id, log };
}

const rows = (count = 5) =>
    Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        name: `n${i + 1}`,
        status: ['open', 'waiting', 'done'][i % 3],
        price: (i + 1) * 10.5,
        born: new Date(2001, 4, 17 + i),
        active: i % 2 === 0,
        notes: i === 0 ? 'line 1\nline 2' : 'one line'
    }));

const fields = (more: DatasourceOptions['fields'] = {}): DatasourceOptions => ({
    key: 'id',
    fields: {
        price: { type: 'number', formatter: 'numberComma', label: 'Price' },
        born: 'date',
        active: 'boolean',
        status: { label: 'Status', validate: [{ id: 'maxLength', value: 7 }] },
        ...more
    }
});

/** name, status, price, born, active, notes in the center; the renderers by field */
const config = (renderers: Record<string, string>, more: Partial<GridConfig> = {}): GridConfig => ({
    readonly: false,
    columns: Object.fromEntries(Object.entries(renderers).map(([field, renderer]) => [field, { renderer }])),
    layout: {
        center: [
            { fields: ['name'], width: 100 },
            { fields: ['status'], width: 100 },
            { fields: ['price'], width: 100 },
            { fields: ['born'], width: 100 },
            { fields: ['active'], width: 100 },
            { fields: ['notes'], width: 100 }
        ]
    },
    ...more
});

const COLUMNS = ['name', 'status', 'price', 'born', 'active', 'notes'];

/** waits for the grid's animation frame: the rows-changed microtask asks for it first */
const frame = async () => {
    await Promise.resolve();
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
};

/** the host of a custom cell on screen, by its field and its row in the displayed rows */
function hostOf(element: GridElement, field: string, row = 0): HTMLElement {
    return element.querySelector(
        `.simple-html-grid-cell-custom.cellpos-middle-pinned-${row}-${COLUMNS.indexOf(field)}-0`
    ) as HTMLElement;
}

/** the cell element of a body cell, by its field and row */
function cellOf(element: GridElement, field: string, row = 0): HTMLCellElement {
    return Array.from(element.querySelectorAll<HTMLCellElement>('.simple-html-grid-col-cell[type="row-cell"]')).find(
        (cell) => cell.$attribute === field && cell.$row === row
    ) as HTMLCellElement;
}

/** the last update() a renderer got for a displayed row */
const lastUpdate = (log: RendererLog, row: number) => log.updates.filter((context) => context.rowIndex === row).at(-1);

/** a keydown on an element, returns the event */
function press(target: Element, key: string, init: KeyboardEventInit = {}) {
    const code = key.length === 1 ? `Key${key.toUpperCase()}` : key;
    const event = new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
}

/** the class of the cell that has the focus, the cellpos-* part only */
function focusedPos() {
    const className = (document.activeElement as HTMLElement)?.className || '';
    return className.split(' ').find((name) => name.startsWith('cellpos-'));
}

const bodyScroller = (element: GridElement) => element.querySelector('.simple-html-grid-body-scroller') as HTMLElement;
const middleScroller = (element: GridElement) => element.querySelector('.simple-html-grid-middle-scroller') as HTMLElement;

/** a scroll like the user's: the position changes, then the scroller sends its scroll event */
function scrollTo(element: GridElement, to: { top?: number; left?: number }) {
    if (to.top !== undefined) {
        bodyScroller(element).scrollTop = to.top;
        bodyScroller(element).dispatchEvent(new Event('scroll'));
    }
    if (to.left !== undefined) {
        middleScroller(element).scrollLeft = to.left;
        middleScroller(element).dispatchEvent(new Event('scroll'));
    }
}

const editorElement = () => document.querySelector('.simple-html-grid-text-editor') as HTMLElement | null;
const editorInput = () => editorElement()?.querySelector('.simple-html-grid-text-editor-input') as HTMLInputElement;
const editorHint = () => editorElement()?.querySelector('.simple-html-grid-text-editor-hint')?.textContent?.trim();

/** a copy of the cell with the focus, as Ctrl+C sends it */
function copy() {
    const clipboardData = new DataTransfer();
    const event = new ClipboardEvent('copy', { clipboardData, bubbles: true, cancelable: true, composed: true });
    (document.activeElement ?? document.body).dispatchEvent(event);
    return { text: clipboardData.getData('text/plain'), taken: event.defaultPrevented };
}

/** a paste into the cell with the focus, as Ctrl+V sends it */
function paste(text: string) {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', text);
    const event = new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true, composed: true });
    (document.activeElement ?? document.body).dispatchEvent(event);
    return event.defaultPrevented;
}

describe('custom cells - the registry', () => {
    it('expect a TypeError for an id that is no text, and a renderer that is no function', () => {
        expect(() => registerCellRenderer('', () => ({ update() {} }))).toThrow(TypeError);
        expect(() => registerCellRenderer(5 as any, () => ({ update() {} }))).toThrow(/the id must be a text, got 5/);
        expect(() => registerCellRenderer('x', { update() {} } as any)).toThrow(/the renderer of 'x' must be a function/);
    });

    it('expect an id registered again to replace the renderer, for the cells mounted after', async () => {
        const id = `replaced-${++ids}`;
        registerCellRenderer(id, (host) => ({ update: () => host.setAttribute('data-renderer', 'first') }));
        const first = await mountGrid(config({ status: id }), rows(), fields());
        expect(hostOf(first.element, 'status').getAttribute('data-renderer')).toEqual('first');

        registerCellRenderer(id, (host) => ({ update: () => host.setAttribute('data-renderer', 'second') }));
        // the cells showing it keep theirs
        first.gridInterface.refresh();
        expect(hostOf(first.element, 'status').getAttribute('data-renderer')).toEqual('first');
        // a new cell element mounts the new one
        const second = await mountGrid(config({ status: id }), rows(), fields());
        expect(hostOf(second.element, 'status').getAttribute('data-renderer')).toEqual('second');
    });

    it('expect an unknown id in the config to throw a TypeError naming the column, when made and by updateConfig()', async () => {
        const { datasource, gridInterface } = await mountGrid(config({}), rows(), fields());
        expect(() => new GridInterface(config({ status: 'nope' }), datasource)).toThrow(TypeError);
        expect(() => new GridInterface(config({ status: 'nope' }), datasource)).toThrow(
            /GridConfig: columns\.status\.renderer is "nope", the id of no registered renderer: registerCellRenderer\("nope", renderer\)/
        );
        expect(() => gridInterface.updateConfig({ columns: { price: { renderer: 'nope' } } })).toThrow(
            /columns\.price\.renderer is "nope"/
        );
        // from plain JavaScript or JSON: not a text
        expect(() => gridInterface.updateConfig({ columns: { price: { renderer: 5 as any } } })).toThrow(TypeError);
        // a renderer that is registered, or none
        const { id } = recorder();
        expect(() => gridInterface.updateConfig({ columns: { price: { renderer: id }, name: {} } })).not.toThrow();
    });

    it('expect a TypeError for a renderer and an editor on one column: a lookup column draws its own cell', async () => {
        const statuses = new Datasource({ key: 'id' });
        statuses.setData([{ id: 'open', name: 'Open' }]);
        registerLookup('custom-cell-statuses', { datasource: statuses, valueField: 'id', labelField: 'name' });
        const { id } = recorder();
        const { datasource, gridInterface } = await mountGrid(config({}), rows(), fields());
        const both: GridConfig['columns'] = {
            status: { renderer: id, editor: { type: 'select', lookup: 'custom-cell-statuses' } }
        };

        expect(() => new GridInterface({ ...config({}), columns: both }, datasource)).toThrow(
            /GridConfig: columns\.status has a renderer and an editor/
        );
        expect(() => gridInterface.updateConfig({ columns: both })).toThrow(TypeError);
        // each on its own column
        expect(() =>
            gridInterface.updateConfig({
                columns: { status: { editor: { type: 'select', lookup: 'custom-cell-statuses' } }, name: { renderer: id } }
            })
        ).not.toThrow();
    });

    it('expect a TypeError when the renderer returns no update()', async () => {
        const id = `broken-${++ids}`;
        registerCellRenderer(id, () => ({}) as any);
        await expect(mountGrid(config({ status: id }), rows(), fields())).rejects.toThrow(
            new RegExp(`the renderer '${id}' returned no \\{ update\\(context\\) \\{\\} \\}`)
        );
    });
});

describe('custom cells - the cell', () => {
    it('expect the host in the cell: focusable, the cellpos class, the classes of the hooks, no label of its own', async () => {
        const { id } = recorder();
        const hooks: GridHooks = {
            cellClass: (_row, field) => (field === 'status' ? { input: 'mine', background: 'behind' } : null)
        };
        const { element } = await mountGrid(config({ status: id }), rows(), fields(), hooks);

        const host = hostOf(element, 'status');
        expect(host.tabIndex).toEqual(0);
        expect(host.className).toContain('simple-html-grid-cell-custom');
        expect(host.className).toContain('mine');
        expect(host.getAttribute('data-attribute')).toEqual('status');
        // the content is the name: no aria-label hides it
        expect(host.hasAttribute('aria-label')).toBe(false);
        expect(host.querySelector('.recorded')?.textContent).toEqual('open');
        // the stripes and the hook's background: the div before the host
        expect(host.previousElementSibling?.className).toContain('behind');
        // the cell is the gridcell
        expect(cellOf(element, 'status').getAttribute('role')).toEqual('gridcell');
        // no input in it
        expect(cellOf(element, 'status').querySelector('input')).toBeNull();
    });

    it('expect update() with the row, the field, the value, the text of the formatter, the type and the index', async () => {
        const { id, log } = recorder();
        const { element, datasource, gridInterface } = await mountGrid(config({ price: id, born: id }), rows(), fields());

        const price = lastUpdate(
            { ...log, updates: log.updates.filter((context) => context.field === 'price') },
            1
        ) as CellRenderContext<any>;
        expect(price.row).toBe(datasource.getRows()[1]);
        expect(price.value).toEqual(21);
        expect(price.text).toEqual('21');
        expect(price.type).toEqual('number');
        expect(price.readonly).toBe(false);
        expect(price.rowIndex).toEqual(1);
        expect(price.gridInterface).toBe(gridInterface);

        const born = log.updates.find((context) => context.field === 'born' && context.rowIndex === 0) as CellRenderContext<any>;
        expect(born.type).toEqual('date');
        expect(born.text).toEqual('2001-05-17');
        expect(hostOf(element, 'born').textContent).toEqual('2001-05-17');
    });

    it('expect numberOverride in the text, and a boolean field drawn by the renderer, not a checkbox', async () => {
        const { id, log } = recorder();
        const data = rows();
        data[0].price = 0;
        const grid = config({ price: id, active: id });
        grid.columns = { ...grid.columns, price: { renderer: id, numberOverride: 'ZERO_TO_BLANK' } };
        const { element } = await mountGrid(grid, data, fields());

        expect(log.updates.find((context) => context.field === 'price' && context.rowIndex === 0)?.text).toEqual('');
        expect(log.updates.find((context) => context.field === 'active' && context.rowIndex === 0)?.value).toBe(true);
        expect(cellOf(element, 'active').querySelector('input[type="checkbox"]')).toBeNull();
    });

    it('expect readonly from the grid, the column and the isReadonly hook', async () => {
        const { id, log } = recorder();
        const hooks: GridHooks = { isReadonly: (row, field) => (field === 'status' && row.id === 2 ? true : null) };
        const { gridInterface } = await mountGrid(config({ status: id }), rows(), fields(), hooks);

        expect(lastUpdate(log, 0)?.readonly).toBe(false);
        expect(lastUpdate(log, 1)?.readonly).toBe(true);

        gridInterface.updateConfig({ columns: { status: { renderer: id, readonly: true } } });
        expect(lastUpdate(log, 0)?.readonly).toBe(true);

        gridInterface.updateConfig({ columns: { status: { renderer: id } }, readonly: true });
        expect(lastUpdate(log, 0)?.readonly).toBe(true);
        expect(lastUpdate(log, 2)?.readonly).toBe(true);
    });
});

describe('custom cells - one renderer per cell element', () => {
    it('expect one mount per cell element: 1000 rows scrolled, the mounts stay at the pool, update() gets the rows', async () => {
        const { id, log } = recorder();
        const { element } = await mountGrid(config({ status: id }), rows(1000), fields());

        // the row elements of the middle section: the pool of cell elements of the column
        const pool = element.querySelectorAll(
            '.simple-html-grid-body-row-container-pinned-middle > .simple-html-grid-row'
        ).length;
        const mounted = log.mounts;
        expect(mounted).toBeGreaterThan(0);
        expect(mounted).toBeLessThanOrEqual(pool);

        // to the end and back, in steps rendered on the scroll event
        const scrollDownAndUp = () => {
            for (let top = 0; top <= 1000 * 22; top += 400) {
                scrollTo(element, { top });
            }
            for (let top = 1000 * 22; top >= 0; top -= 400) {
                scrollTo(element, { top });
            }
        };
        scrollDownAndUp();
        // a row element not used at the top can be used further down: at most the pool
        const used = log.mounts;
        expect(used).toBeLessThanOrEqual(pool);
        expect(used - mounted).toBeLessThanOrEqual(1);
        scrollDownAndUp();
        expect(log.mounts).toEqual(used);
        expect(log.destroys).toEqual(0);
        expect(new Set(log.hosts).size).toEqual(used);
        // the rows scrolled in, the last one too
        const shown = new Set(log.updates.map((context) => context.rowIndex));
        expect(shown.has(999)).toBe(true);
        expect(shown.size).toBeGreaterThan(900);
        expect(log.updates.find((context) => context.rowIndex === 999)?.row.id).toEqual(1000);
    });

    it('expect a cell with another renderer after a horizontal scroll: the first destroyed, the other in the same host', async () => {
        const a = recorder();
        const b = recorder();
        // 10 columns of 300px in a view of 1000px: 5 column elements, they show other columns sideways
        const fieldsOf = Array.from({ length: 10 }, (_, i) => `f${i}`);
        const data = rows().map((row, i) => ({
            ...row,
            ...Object.fromEntries(fieldsOf.map((field) => [field, `${field}-${i}`]))
        }));
        const grid: GridConfig = {
            readonly: false,
            columns: { f0: { renderer: a.id }, f8: { renderer: b.id }, f6: { renderer: a.id } },
            layout: { center: fieldsOf.map((field) => ({ fields: [field], width: 300 })) }
        };
        const { element } = await mountGrid(grid, data, fields());
        expect(a.log.mounts).toEqual(5);
        expect(b.log.mounts).toEqual(0);
        const hostsOfF0 = [...a.log.hosts];

        // columns 4 to 8 on screen: the element of f0 shows f8 now (assignPool gives the free elements the
        // last ones first), another renderer in the same host
        scrollTo(element, { left: 1500 });
        expect(a.log.destroys).toEqual(5);
        expect(b.log.mounts).toEqual(5);
        expect(new Set(b.log.hosts)).toEqual(new Set(hostsOfF0));
        // the host was emptied before b rendered into it
        expect(b.log.hosts[0].querySelectorAll('.recorded').length).toEqual(1);
        // f6 has a's renderer: mounted in the element that showed a column without one
        expect(a.log.mounts).toEqual(10);

        // back: f8 and f6 go, f0 comes back
        scrollTo(element, { left: 0 });
        expect(b.log.destroys).toEqual(5);
        expect(a.log.destroys).toEqual(10);
        expect(a.log.mounts).toEqual(15);
    });

    it('expect two columns with the same renderer to keep the instance, update() gets the other field', async () => {
        const { id, log } = recorder();
        const fieldsOf = Array.from({ length: 10 }, (_, i) => `f${i}`);
        const data = rows().map((row, i) => ({
            ...row,
            ...Object.fromEntries(fieldsOf.map((field) => [field, `${field}-${i}`]))
        }));
        const grid: GridConfig = {
            readonly: false,
            columns: Object.fromEntries(fieldsOf.map((field) => [field, { renderer: id }])),
            layout: { center: fieldsOf.map((field) => ({ fields: [field], width: 300 })) }
        };
        const { element } = await mountGrid(grid, data, fields());
        // 4 columns start in the view: the fifth column element shows none yet
        expect(log.mounts).toEqual(20);

        scrollTo(element, { left: 1500 });
        // the fifth element shows a column now, the others kept theirs
        expect(log.mounts).toEqual(25);
        expect(log.destroys).toEqual(0);
        expect(log.updates.some((context) => context.field === 'f8')).toBe(true);
    });

    it('expect a horizontal scroll to a column without a renderer to destroy it: the host is gone', async () => {
        const { id, log } = recorder();
        const fieldsOf = Array.from({ length: 10 }, (_, i) => `f${i}`);
        const data = rows().map((row, i) => ({
            ...row,
            ...Object.fromEntries(fieldsOf.map((field) => [field, `${field}-${i}`]))
        }));
        const grid: GridConfig = {
            columns: { f0: { renderer: id } },
            layout: { center: fieldsOf.map((field) => ({ fields: [field], width: 300 })) }
        };
        const { element } = await mountGrid(grid, data, fields());
        expect(element.querySelectorAll('.simple-html-grid-cell-custom').length).toEqual(5);

        scrollTo(element, { left: 1500 });
        expect(log.destroys).toEqual(log.mounts);
        expect(element.querySelectorAll('.simple-html-grid-cell-custom').length).toEqual(0);
    });

    it('expect updateConfig() removing the renderer, and a rebuild (cellHeight), to destroy every one', async () => {
        const { id, log } = recorder();
        const { element, gridInterface } = await mountGrid(config({ status: id }), rows(), fields());
        expect(log.mounts).toEqual(5);

        gridInterface.updateConfig({ cellHeight: 30 });
        expect(log.destroys).toEqual(5);
        // the new cell elements mount their own
        expect(log.mounts).toEqual(10);

        gridInterface.updateConfig({ columns: {} });
        expect(log.destroys).toEqual(10);
        expect(log.mounts).toEqual(10);
        expect(element.querySelectorAll('.simple-html-grid-cell-custom').length).toEqual(0);
        expect(cellOf(element, 'status').querySelector('input')?.value).toEqual('open');
    });

    it('expect a group row to call nothing: its cells keep the instance, hidden', async () => {
        const { id, log } = recorder();
        const { datasource, gridInterface } = await mountGrid(config({ status: id }), rows(), fields());
        // grouping rebuilds the rows: new cell elements
        datasource.group([{ attribute: 'status', title: 'Status' }]);
        datasource.expandGroup();
        const { mounts, destroys } = log;
        log.updates = [];

        gridInterface.refresh();
        expect(log.mounts).toEqual(mounts);
        expect(log.destroys).toEqual(destroys);
        // the data rows only
        expect(log.updates.length).toEqual(5);
        expect(log.updates.every((context) => !isGroupRow(context.row) && context.row.id > 0)).toBe(true);
    });

    it('expect gridInterface.destroy() to destroy every one', async () => {
        const { id, log } = recorder();
        const { gridInterface } = await mountGrid(config({ status: id }), rows(), fields());
        gridInterface.destroy();
        expect(log.destroys).toEqual(log.mounts);
    });

    it('expect the element taken out of the dom to destroy every one, and to mount again when it is put back', async () => {
        const { id, log } = recorder();
        const { element } = await mountGrid(config({ status: id }), rows(), fields());
        element.remove();
        expect(log.destroys).toEqual(5);

        document.body.appendChild(element);
        expect(log.mounts).toEqual(10);
        expect(hostOf(element, 'status').querySelector('.recorded')?.textContent).toEqual('open');
    });

    it('expect a destroy() that throws not to leave it mounted', async () => {
        const id = `throws-${++ids}`;
        let destroys = 0;
        registerCellRenderer(id, () => ({
            update() {},
            destroy() {
                destroys++;
                throw new Error('oops');
            }
        }));
        const { gridInterface } = await mountGrid(config({ status: id }), rows(1), fields());
        expect(() => gridInterface.updateConfig({ columns: {} })).toThrow('oops');
        // the cell is done with it all the same: not destroyed again
        gridInterface.updateConfig({ cellHeight: 30 });
        expect(destroys).toEqual(1);
    });
});

describe('custom cells - values', () => {
    it('expect a value set from code in update() in the next frame', async () => {
        const { id, log } = recorder();
        const { datasource } = await mountGrid(config({ status: id }), rows(), fields());

        datasource.getRows()[0].status = 'done';
        expect(lastUpdate(log, 0)?.value).toEqual('open');
        await frame();
        expect(lastUpdate(log, 0)?.value).toEqual('done');
        expect(lastUpdate(log, 0)?.text).toEqual('done');
    });

    it('expect a write from the renderer to be an edit: the marker, the error, one undo step', async () => {
        const { id, log } = recorder();
        const { element, datasource } = await mountGrid(config({ status: id }), rows(), fields());
        const context = lastUpdate(log, 0) as CellRenderContext<any>;

        context.row[context.field] = 'much too long';
        await frame();

        const cell = cellOf(element, 'status');
        expect(cell.classList.contains('simple-html-cell-edited')).toBe(true);
        expect(cell.querySelector('.simple-html-cell-edited-marker')).not.toBeNull();
        // the maxLength rule of the field
        expect(cell.classList.contains('simple-html-cell-error')).toBe(true);
        expect(datasource.getChanges().modifiedEntities.length).toEqual(1);

        expect(datasource.undo()).toBe(true);
        expect(datasource.getRows()[0].status).toEqual('open');
        expect(datasource.canUndo()).toBe(false);
        await frame();
        expect(lastUpdate(log, 0)?.value).toEqual('open');
        expect(cell.classList.contains('simple-html-cell-error')).toBe(false);
    });

    it('expect Ctrl+Z in the cell to undo, a row marked for deletion to be struck through', async () => {
        const { id } = recorder();
        const { element, datasource } = await mountGrid(config({ status: id }), rows(), fields());
        datasource.getRows()[0].status = 'done';
        await frame();

        const host = hostOf(element, 'status');
        host.focus();
        expect(press(host, 'z', { ctrlKey: true }).defaultPrevented).toBe(true);
        expect(datasource.getRows()[0].status).toEqual('open');

        datasource.markForDeletion(datasource.getRows()[1]);
        await frame();
        expect(cellOf(element, 'status', 1).classList.contains('simple-html-cell-deleted')).toBe(true);
    });
});

describe('custom cells - keys and events', () => {
    it('expect the arrows and Alt+arrows to move from the cell, Tab to the next cell, and back into it', async () => {
        const { id } = recorder();
        const { element } = await mountGrid(config({ status: id }), rows(), fields());

        hostOf(element, 'status').focus();
        press(hostOf(element, 'status'), 'ArrowDown');
        await sleep(150);
        expect(focusedPos()).toEqual('cellpos-middle-pinned-1-1-0');

        press(hostOf(element, 'status', 1), 'ArrowUp', { altKey: true });
        await sleep(150);
        expect(focusedPos()).toEqual('cellpos-middle-pinned-0-1-0');

        press(hostOf(element, 'status'), 'ArrowRight');
        await sleep(150);
        // the price input
        expect(focusedPos()).toEqual('cellpos-middle-pinned-0-2-0');
        expect(document.activeElement?.tagName).toEqual('INPUT');

        // Shift+Tab from the input: the custom cell
        press(document.activeElement as HTMLElement, 'Tab', { shiftKey: true });
        await sleep(150);
        expect(document.activeElement).toBe(hostOf(element, 'status'));

        press(hostOf(element, 'status'), 'Tab');
        await sleep(150);
        expect(focusedPos()).toEqual('cellpos-middle-pinned-0-2-0');
    });

    it("expect the plain arrows on the renderer's content to be its own, Tab and Alt+arrows the grid's", async () => {
        const { id } = recorder({
            content: (host) => {
                const button = document.createElement('button');
                host.appendChild(button);
            }
        });
        const { element } = await mountGrid(config({ status: id }), rows(), fields());
        const button = hostOf(element, 'status').querySelector('button') as HTMLButtonElement;
        button.focus();

        expect(press(button, 'ArrowDown').defaultPrevented).toBe(false);
        await sleep(150);
        expect(document.activeElement).toBe(button);

        expect(press(button, 'ArrowDown', { altKey: true }).defaultPrevented).toBe(true);
        await sleep(150);
        expect(focusedPos()).toEqual('cellpos-middle-pinned-1-1-0');
    });

    it('expect the focus to send cell-row-focus once, also when it moves on into the content', async () => {
        const { id } = recorder({ content: (host) => host.appendChild(document.createElement('button')) });
        const { element, gridInterface } = await mountGrid(config({ status: id }), rows(), fields());
        const focused: { attribute: string; row: number; type: string }[] = [];
        gridInterface.on('cell-row-focus', (data) =>
            focused.push({ attribute: data.attribute, row: data.row, type: data.originalEvent.type })
        );

        const host = hostOf(element, 'status', 1);
        host.focus();
        expect(focused).toEqual([{ attribute: 'status', row: 1, type: 'focusin' }]);
        expect(cellOf(element, 'status', 1).$focused).toBe(true);

        (host.querySelector('button') as HTMLButtonElement).focus();
        expect(focused.length).toEqual(1);

        hostOf(element, 'status', 2).focus();
        expect(focused.length).toEqual(2);
        expect(cellOf(element, 'status', 1).$focused).toBe(false);
    });

    it('expect a click to make the row current and send cell-click, a Shift+click not', async () => {
        const { id } = recorder();
        const { element, datasource, gridInterface } = await mountGrid(config({ status: id }), rows(), fields());
        const clicks: number[] = [];
        gridInterface.on('cell-click', (data) => clicks.push(data.row));

        (hostOf(element, 'status', 2).querySelector('.recorded') as HTMLElement).click();
        await sleep(10);
        expect(datasource.currentEntity).toBe(datasource.getRows()[2]);
        expect(clicks).toEqual([2]);

        hostOf(element, 'status', 3).dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
        await sleep(10);
        expect(datasource.currentEntity).toBe(datasource.getRows()[2]);
        expect(clicks).toEqual([2]);
    });

    it('expect the row menu on a right click, Space on the cell not to scroll the page', async () => {
        const { id } = recorder();
        const { element } = await mountGrid(config({ status: id }), rows(), fields());
        const host = hostOf(element, 'status');
        host.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        expect(document.querySelector('.simple-html-grid-menu[role="menu"]')).not.toBeNull();

        host.focus();
        expect(press(host, ' ', { code: 'Space' }).defaultPrevented).toBe(true);
    });
});

describe('custom cells - what the grid shows on a cell', () => {
    it('expect errors, a range with the fill handle and the matches of Find on a custom cell', async () => {
        const { id } = recorder();
        const { element, datasource, gridInterface } = await mountGrid(config({ status: id }), rows(), fields());

        datasource.getRows()[2].status = 'far too long';
        await frame();
        expect(cellOf(element, 'status', 2).classList.contains('simple-html-cell-error')).toBe(true);

        gridInterface.setRanges([{ fromRow: 0, fromField: 'status', toRow: 1, toField: 'status' }]);
        expect(cellOf(element, 'status', 0).classList.contains('simple-html-cell-in-range')).toBe(true);
        expect(cellOf(element, 'status', 1).querySelector('.simple-html-grid-fill-handle')).not.toBeNull();
        expect(cellOf(element, 'status', 0).getAttribute('aria-selected')).toEqual('true');
        gridInterface.clearRanges();

        gridInterface.find('wait');
        expect(cellOf(element, 'status', 1).classList.contains('simple-html-cell-find-match')).toBe(true);
        expect(cellOf(element, 'status', 0).classList.contains('simple-html-cell-find-match')).toBe(false);
        gridInterface.closeFind();
    });

    it('expect copy to copy the text of the cell, paste and Delete on a range to write it', async () => {
        const { id } = recorder();
        const { element, datasource, gridInterface } = await mountGrid(config({ status: id, price: id }), rows(), fields());

        hostOf(element, 'price', 1).focus();
        expect(copy()).toEqual({ text: '21', taken: true });

        hostOf(element, 'status', 1).focus();
        expect(paste('pasted')).toBe(true);
        expect(datasource.getRows()[1].status).toEqual('pasted');

        gridInterface.setRanges([{ fromRow: 0, fromField: 'status', toRow: 1, toField: 'status' }]);
        expect(press(hostOf(element, 'status'), 'Delete').defaultPrevented).toBe(true);
        expect(datasource.getRows()[0].status).toBeNull();
        expect(datasource.getRows()[1].status).toBeNull();
    });

    it('expect Ctrl+D in the cell to fill down, and the find bar to go back to the cell on Esc', async () => {
        const { id } = recorder();
        const { element, datasource, gridInterface } = await mountGrid(config({ status: id }), rows(), fields());

        const host = hostOf(element, 'status', 1);
        host.focus();
        expect(press(host, 'd', { ctrlKey: true }).defaultPrevented).toBe(true);
        expect(datasource.getRows()[1].status).toEqual('open');

        gridInterface.find('done');
        gridInterface.closeFind();
        gridInterface.openFind();
        const input = document.querySelector('.simple-html-grid-find input') as HTMLInputElement;
        press(input, 'Escape');
        // the cell of the current match: row 2
        expect(document.activeElement).toBe(hostOf(element, 'status', 2));
    });
});

describe('custom cells - editing a cell the renderer only draws', () => {
    it('expect Enter to open the editor of one line with the text of the formatter, Enter to save once', async () => {
        const { id, log } = recorder();
        const { element, datasource } = await mountGrid(config({ price: id }), rows(), fields());
        const host = hostOf(element, 'price', 1);
        host.focus();

        expect(press(host, 'Enter').defaultPrevented).toBe(true);
        const input = editorInput();
        expect(input.tagName).toEqual('INPUT');
        expect(isPopoverShown(editorElement() as HTMLElement)).toBe(true);
        expect(input.value).toEqual('21');
        expect(document.activeElement).toBe(input);
        expect(input.getAttribute('aria-label')).toEqual('Price');
        expect(editorHint()).toEqual('Enter to save, Esc to cancel');

        input.value = '42,5';
        expect(press(input, 'Enter').defaultPrevented).toBe(true);
        expect(editorElement()).toBeNull();
        expect(datasource.getRows()[1].price).toEqual(42.5);
        // the focus back in the cell, the cell shows it
        expect(document.activeElement).toBe(host);
        expect(lastUpdate(log, 1)?.text).toEqual('42,5');

        expect(datasource.undo()).toBe(true);
        expect(datasource.getRows()[1].price).toEqual(21);
        expect(datasource.canUndo()).toBe(false);
    });

    it('expect F2, a double click and a character typed to open it, the character at the end', async () => {
        const { id } = recorder();
        const { element } = await mountGrid(config({ status: id }), rows(), fields());
        const host = hostOf(element, 'status');
        host.focus();

        press(host, 'F2');
        expect(editorInput().value).toEqual('open');
        press(editorInput(), 'Escape');

        (host.querySelector('.recorded') as HTMLElement).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        expect(editorInput().value).toEqual('open');
        press(editorInput(), 'Escape');

        expect(press(host, 'x').defaultPrevented).toBe(true);
        expect(editorInput().value).toEqual('openx');
        press(editorInput(), 'Escape');

        // AltGr types a character, Ctrl and Alt alone are shortcuts
        press(host, '@', { ctrlKey: true, altKey: true });
        expect(editorInput().value).toEqual('open@');
        press(editorInput(), 'Escape');
        press(host, 'q', { ctrlKey: true });
        expect(editorElement()).toBeNull();
    });

    it('expect Esc to cancel: no write, the focus back in the cell; Tab to save and go on', async () => {
        const { id } = recorder();
        const { element, datasource } = await mountGrid(config({ status: id }), rows(), fields());
        const host = hostOf(element, 'status');
        host.focus();

        press(host, 'Enter');
        editorInput().value = 'changed';
        expect(press(editorInput(), 'Escape').defaultPrevented).toBe(true);
        expect(editorElement()).toBeNull();
        expect(datasource.getRows()[0].status).toEqual('open');
        expect(document.activeElement).toBe(host);
        expect(datasource.canUndo()).toBe(false);

        press(host, 'Enter');
        editorInput().value = 'tabbed';
        press(editorInput(), 'Tab', { code: 'Tab' });
        expect(datasource.getRows()[0].status).toEqual('tabbed');
        await sleep(150);
        expect(focusedPos()).toEqual('cellpos-middle-pinned-0-2-0');
    });

    it('expect a text of several lines to open the multiline editor, read-only in a readonly cell', async () => {
        const { id } = recorder();
        const { element, gridInterface } = await mountGrid(config({ notes: id }), rows(), fields());
        hostOf(element, 'notes').focus();

        press(hostOf(element, 'notes'), 'Enter');
        expect(editorInput().tagName).toEqual('TEXTAREA');
        expect(editorInput().value).toEqual('line 1\nline 2');
        expect(editorHint()).toEqual('Ctrl+Enter to save, Esc to cancel');
        press(editorInput(), 'Escape');

        // the multiline cell's rule: read-only on Enter, nothing on typing
        gridInterface.updateConfig({ readonly: true });
        hostOf(element, 'notes').focus();
        press(hostOf(element, 'notes'), 'Enter');
        expect(editorInput().readOnly).toBe(true);
        expect(editorHint()).toEqual('Esc to close');
        press(editorInput(), 'Escape');
        press(hostOf(element, 'notes'), 'x');
        expect(editorElement()).toBeNull();
    });

    it('expect nothing to open in a cell that can not be edited, nor for a boolean', async () => {
        const { id } = recorder();
        const grid = config({ status: id, active: id });
        grid.columns = { ...grid.columns, price: { renderer: id, allowPasteClearOnly: true } };
        const hooks: GridHooks = { isReadonly: (row, field) => (field === 'status' && row.id === 2 ? true : null) };
        const { element, gridInterface } = await mountGrid(grid, rows(), fields(), hooks);

        for (const [field, row] of [
            ['status', 1],
            ['price', 0],
            ['active', 0]
        ] as const) {
            const host = hostOf(element, field, row);
            host.focus();
            expect(press(host, 'Enter').defaultPrevented).toBe(false);
            press(host, 'F2');
            press(host, 'x');
            host.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
            expect(editorElement(), `${field} ${row}`).toBeNull();
        }

        gridInterface.updateConfig({ readonly: true });
        hostOf(element, 'status').focus();
        press(hostOf(element, 'status'), 'Enter');
        expect(editorElement()).toBeNull();
    });

    it("expect the keys on the renderer's content not to open it: they are the content's", async () => {
        const { id } = recorder({ content: (host) => host.appendChild(document.createElement('button')) });
        const { element } = await mountGrid(config({ status: id }), rows(), fields());
        const button = hostOf(element, 'status').querySelector('button') as HTMLButtonElement;
        button.focus();
        expect(press(button, 'Enter').defaultPrevented).toBe(false);
        press(button, 'x');
        expect(editorElement()).toBeNull();
    });

    it('expect a click on a date cell to open the date picker, a date picked to be written; Enter the editor', async () => {
        const { id } = recorder();
        const { element, datasource } = await mountGrid(config({ born: id }), rows(), fields());
        const host = hostOf(element, 'born');

        host.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await sleep(20);
        const picker = document.querySelector('simple-html-date') as HTMLElement;
        expect(picker).not.toBeNull();
        expect(picker.querySelector('.simple-html-date-day-selected')?.textContent?.trim()).toEqual('17');

        const day = Array.from(picker.querySelectorAll<HTMLElement>('.simple-html-date-day')).find(
            (element) => element.textContent?.trim() === '20'
        ) as HTMLElement;
        day.click();
        (picker.querySelector('.simple-html-date-button-primary') as HTMLElement).click();
        expect((datasource.getRows()[0].born as Date).getDate()).toEqual(20);

        // a double click does not open the editor over the picker: the click opened it
        host.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        expect(editorElement()).toBeNull();

        // a date can be typed
        host.focus();
        press(host, 'Enter');
        expect(editorInput().value).toEqual('2001-05-20');
        editorInput().value = '2001-06-01';
        press(editorInput(), 'Enter');
        expect((datasource.getRows()[0].born as Date).getMonth()).toEqual(5);
    });

    it('expect no date picker in a readonly cell, nor on a Ctrl+click', async () => {
        const { id } = recorder();
        const { element, gridInterface } = await mountGrid(config({ born: id }), rows(), fields());
        hostOf(element, 'born').dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
        await sleep(20);
        expect(document.querySelector('simple-html-date')).toBeNull();

        gridInterface.updateConfig({ readonly: true });
        hostOf(element, 'born').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await sleep(20);
        expect(document.querySelector('simple-html-date')).toBeNull();
    });
});

describe("custom cells - a renderer's own edit()", () => {
    it('expect edit() instead of the editor and the date picker: Enter, F2, typing, a double click', async () => {
        const { id, log } = recorder({ edit: true });
        const { element } = await mountGrid(config({ status: id, born: id }), rows(), fields());
        const host = hostOf(element, 'status');
        host.focus();

        expect(press(host, 'Enter').defaultPrevented).toBe(true);
        press(host, 'F2');
        expect(press(host, 'x').defaultPrevented).toBe(true);
        host.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        expect(log.edits).toEqual([undefined, undefined, 'x', undefined]);
        expect(editorElement()).toBeNull();

        // a date cell: no picker, a double click is edit()
        hostOf(element, 'born').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await sleep(20);
        expect(document.querySelector('simple-html-date')).toBeNull();
        hostOf(element, 'born').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        expect(log.edits.length).toEqual(5);
    });

    it('expect no edit() where the cell can not be edited', async () => {
        const { id, log } = recorder({ edit: true });
        const { element, gridInterface } = await mountGrid(config({ status: id }), rows(), fields());
        gridInterface.updateConfig({ readonly: true });
        const host = hostOf(element, 'status');
        host.focus();
        expect(press(host, 'Enter').defaultPrevented).toBe(false);
        press(host, 'x');
        host.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        expect(log.edits).toEqual([]);
    });
});
