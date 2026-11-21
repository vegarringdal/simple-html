import type { EntityUnion } from '../datasource/dataSource';
import type { FieldType } from '../datasource/field';
import type { GridInterface } from './gridInterface';

/**
 * What the grid gives a cell renderer each time the cell shows a row: see {@link CellRendererInstance}.
 * A new object every render.
 *
 * @typeParam T the type of the rows, as in the datasource
 *
 * @sample custom-cells
 * @example
 * ```ts
 * import { type CellRenderContext, registerCellRenderer } from '@simple-html/grid';
 *
 * registerCellRenderer('stock', (host) => {
 *     const span = document.createElement('span');
 *     host.appendChild(span);
 *     return {
 *         update(context: CellRenderContext) {
 *             span.textContent = context.text; // the text the default cell would show
 *             span.style.fontWeight = Number(context.value) < 10 ? 'bold' : '';
 *         }
 *     };
 * });
 * ```
 */
export interface CellRenderContext<T = unknown> {
    /**
     * the row - always a data row, a group row has no cells. A write goes through the datasource as one
     * from code does: the edit is tracked, the field validated, it is a step of the undo history, and
     * the cell is rendered again in the next frame (`update()` gets the new value)
     */
    row: EntityUnion<T>;
    /** the cell's field */
    field: string;
    /** the value, `row[field]` */
    value: unknown;
    /** the text the default cell would show: the value through the field's formatter, `numberOverride` applied */
    text: string;
    /** the cell's type: the field's, or the one `dynamicCellTypeColumn` gives this row */
    type: FieldType;
    /**
     * the cell can not be edited: the grid is readonly, or the cell is - the column's `readonly`, the
     * `isReadonly` hook. Do not write the value then
     */
    readonly: boolean;
    /** the index of the row in the displayed rows (`datasource.getRows()`), 0 based - as in the grid's events */
    rowIndex: number;
    /** the grid: the registry is for the page, so a renderer can not know its grid otherwise */
    gridInterface: GridInterface<T>;
}

/**
 * What a cell renderer returns for a cell element: the grid calls `update()` every time the cell is
 * rendered, and `destroy()` when the cell element is done with it. See {@link registerCellRenderer}.
 *
 * @typeParam T the type of the rows, as in the datasource
 *
 * @sample custom-cells
 * @example
 * ```ts
 * import { type CellRendererInstance, registerCellRenderer } from '@simple-html/grid';
 *
 * // the age of the row's last change, counted up every second
 * registerCellRenderer('age', (host) => {
 *     let changed = 0;
 *     const show = () => {
 *         host.textContent = changed ? `${Math.round((Date.now() - changed) / 1000)}s ago` : '';
 *     };
 *     const timer = setInterval(show, 1000);
 *     const instance: CellRendererInstance = {
 *         update(context) {
 *             changed = Number(context.value);
 *             show();
 *         },
 *         // else the timer keeps running, and keeps the grid alive
 *         destroy: () => clearInterval(timer)
 *     };
 *     return instance;
 * });
 * ```
 */
export interface CellRendererInstance<T = unknown> {
    /**
     * Called every time the cell is rendered: another row while scrolling (the cell elements are reused),
     * a changed value, `refresh()`, a sort, the hooks changed ... Change what differs; the content is
     * kept between the calls
     */
    update(context: CellRenderContext<T>): void;
    /**
     * Called once when the cell element is done with this renderer: it shows a column without it now
     * (scrolled sideways), the column lost its `renderer` (`updateConfig()`), the cells are made again
     * (a resize, `cellHeight`, a new layout), the grid is taken off the page or destroyed. Undo what
     * `update()` and the renderer set up outside the host - an unmount, a subscription, a timer. The grid
     * empties the host itself
     */
    destroy?(): void;
    /**
     * For a renderer that edits the value itself - a select, buttons, a checkbox of its own. The grid
     * calls it where it would open its editor: Enter, F2 and a character typed with the focus on the
     * cell, a double click - only when the cell can be edited. Focus your control, open it, step the
     * value ... Left out, the grid edits the cell in its text editor, and a date cell opens the date
     * picker on a click
     * @param typed the character typed, undefined for Enter, F2 and a double click
     */
    edit?(typed?: string): void;
}

/**
 * A cell renderer: called once per cell element that shows a column with this renderer. Render into
 * `host`, keep what you need, and return what the grid calls from then on, see {@link CellRendererInstance}.
 *
 * @typeParam T the type of the rows, as in the datasource
 *
 * @sample custom-cells
 * @example
 * ```ts
 * import { type CellRenderer, registerCellRenderer } from '@simple-html/grid';
 *
 * interface Task {
 *     done: boolean;
 * }
 *
 * // typed rows: context.row is a Task
 * const doneMark: CellRenderer<Task> = (host) => ({
 *     update(context) {
 *         host.textContent = context.row.done ? 'yes' : 'no';
 *     }
 * });
 * registerCellRenderer('done', doneMark);
 * ```
 */
export type CellRenderer<T = unknown> = (host: HTMLElement) => CellRendererInstance<T>;

/**
 * The cell renderers by id. One registry for the page, every grid looks its ids up here.
 */
const registry = new Map<string, CellRenderer<any>>();

/**
 * Registers a cell renderer under an id, for a column to name it: `ColumnConfig.renderer` is the id, so
 * the config stays plain JSON. The renderer is code: register it when the page loads, before the grid
 * that names it is made. It draws the cells of the column with what you like - plain DOM, lit-html,
 * React, Solid: a badge, a progress bar, a link, a select that edits the value.
 *
 * - **Called once per cell element**, not per row: the grid reuses its cell elements while scrolling,
 *   so a cell shows another row on every scroll step. The renderer renders into `host` and returns an
 *   object whose `update(context)` the grid calls every time the cell is rendered, with the row, the
 *   value and the text the default cell would show (see {@link CellRenderContext}). There are as many
 *   as cell elements show the column - the rows on screen and a few more - not one per row.
 * - **`destroy()`** is called when the cell element is done with it, see {@link CellRendererInstance}.
 * - **The host** fills the cell and is what gets the focus: the keys of the grid work in it - Tab,
 *   Alt+arrows and the arrows, copy, paste, Delete, Ctrl+Z, the ranges. Put your content in it; its
 *   class, `tabindex` and data attributes are the grid's. Keys and clicks on your content go to the
 *   cell too: stop the ones your content handles itself (`event.stopPropagation()`).
 * - **Writing the value**: `context.row[context.field] = value`, when `context.readonly` is false - a
 *   select or buttons. It is tracked, validated and undone as any edit.
 * - **The grid's editor**: in a cell that can be edited, Enter, F2, typing and a double click open the
 *   grid's text editor over the cell, and a click on a date cell the date picker - unless the instance
 *   has an `edit()` of its own.
 * - **Registering an id again replaces the renderer**, for the cells mounted after; the cells showing it
 *   keep theirs until they are done with it. There is one registry for the page.
 *
 * Errors, the edited marker, ranges, Find, the fill handle, the readonly and required stripes and the
 * `cellClass` hook show on a custom cell as on any other. Copy, export, sort, filter and group use the
 * value and the formatter, not what the renderer draws.
 *
 * @param id the name the config uses, e.g. `'badge'`. Any text but `''`
 * @param renderer called with the host of each cell element, returns its instance
 * @throws a `TypeError` when the id is not a text, or the renderer is not a function
 *
 * @sample custom-cells
 * @example
 * ```ts
 * import { createGrid, type GridConfig, registerCellRenderer } from '@simple-html/grid';
 *
 * // plain DOM: the element is made once per cell element, update() changes its text and class
 * registerCellRenderer('badge', (host) => {
 *     const span = document.createElement('span');
 *     host.appendChild(span);
 *     return {
 *         update({ value, text }) {
 *             span.textContent = text;
 *             span.className = `badge badge-${String(value)}`;
 *         }
 *     };
 * });
 *
 * // the config names it: plain JSON
 * const config: GridConfig = {
 *     columns: { status: { renderer: 'badge' } },
 *     layout: { center: [{ fields: ['status'], width: 100 }] }
 * };
 * createGrid(host, { config, datasource });
 * ```
 */
export function registerCellRenderer(id: string, renderer: CellRenderer<any>): void {
    // plain js can pass anything: say so now, not when a cell is rendered
    if (typeof id !== 'string' || id === '') {
        throw new TypeError(`registerCellRenderer: the id must be a text, got ${JSON.stringify(id)}`);
    }
    if (typeof renderer !== 'function') {
        throw new TypeError(
            `registerCellRenderer: the renderer of '${id}' must be a function (host) => ({ update(context) {} }), got ${typeof renderer}`
        );
    }
    registry.set(id, renderer);
}

/**
 * @internal
 * The renderer registered under an id: a column's `renderer`, checked when the grid is made and by
 * updateConfig(), so it is there when a cell is rendered
 * @param id the column's `renderer`
 * @param where the column, for the message: `GridConfig: columns.status.renderer`
 * @throws a `TypeError` when the id is not a text or not registered
 */
export function getCellRenderer(id: unknown, where: string): CellRenderer<any> {
    const renderer = typeof id === 'string' ? registry.get(id) : undefined;
    if (!renderer) {
        const known = Array.from(registry.keys(), (key) => `'${key}'`).join(', ') || 'none';
        throw new TypeError(
            `${where} is ${JSON.stringify(id)}, the id of no registered renderer: registerCellRenderer(${JSON.stringify(id)}, renderer) before the grid is made. Registered: ${known}`
        );
    }
    return renderer;
}
