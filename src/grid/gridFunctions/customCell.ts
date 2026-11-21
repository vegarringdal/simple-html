import { html, render } from 'lit-html';
import type { Entity } from '../../datasource/entity';
import type { FieldType } from '../../datasource/field';
import type { Formatter } from '../../datasource/formatter';
import { type CellRendererInstance, getCellRenderer } from '../cellRendererRegistry';
import type { Grid } from '../grid';
import { cellRowKeyNavigationCellRowHandler } from './cellRowKeyNavigationCellRowHandler';
import type { ColType } from './colType';
import { contextmenuDate } from './contextmenuDate';
import { contextmenuRow } from './contextmenuRow';
import { fillDownKey } from './fillDown';
import type { HTMLCellElement } from './HTMLCellElement';
import { jumpKeydown } from './jumpKeys';
import { rangeDeleteKey } from './rangeClipboard';
import { rangeCellFocused, rangeKeydown } from './rangeSelection';
import { isTypedCharacter } from './renderRowCell';
import { openTextEditor } from './textEditor';
import { triggerScrollEvent } from './triggerScrollEvent';
import { undoRedoKey } from './undoRedoKey';

/**
 * A custom cell: a column with a renderer of your own (`ColumnConfig.renderer`, cellRendererRegistry.ts).
 *
 * The cell's template is a dimmed div (the stripes, the `cellClass` hook's background) and the host, an
 * empty div the renderer renders into: lit-html leaves what is in it alone, so rendering the cell again
 * keeps the host and its content. The host has the `cellpos-` class and `tabindex`, the keys find and
 * focus it as they do an input; it has the input's handlers but the typing - the keys of the grid, the
 * current row and `cell-click` on a click, `cell-row-focus` and the ranges on the focus, the row menu.
 *
 * The cell element remembers its renderer, `cell.$renderer`: mounted once per cell element (a cell shows
 * another row on every scroll step, `update()` changes it), destroyed when the cell shows something else
 * (releaseRenderer) or the cells are thrown away (releaseAllRenderers).
 *
 * Editing (step 2 of custom_render.md): Enter, F2, a character typed and a double click open the grid's
 * text editor over the cell - one line, Enter saves; a text of several lines gets the multiline editor -
 * and a click on a date cell the date picker, as the default cell. A renderer with an `edit()` of its own
 * gets those instead. A boolean has no editor: it is the renderer's.
 */

/** the class of the host, the element the renderer renders into */
export const CUSTOM_CELL_CLASS = 'simple-html-grid-cell-custom';

/** the plain arrow keys, by `key` */
const ARROWS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

/**
 * What renderRowCell knows about the cell it renders: where it is, the row and field, and what it
 * computed for the default cell - the text, the classes, readonly
 */
export interface CustomCell {
    cell: HTMLCellElement;
    /** the row, displayed: an index in `datasource.getRows()` */
    row: number;
    column: number;
    celno: number;
    colType: ColType;
    /** `'row-cell'`, for the events */
    cellType: string;
    field: string;
    /** the data row */
    entity: Entity;
    /** the id of the renderer, `ColumnConfig.renderer` */
    renderer: string;
    /** the type of the cell, see getCellType */
    type: FieldType;
    /** the text the default cell shows: formatted, `numberOverride` */
    text: string;
    /** the formatter of the cell, for the editor */
    formatter: Formatter;
    /** the grid or the cell is readonly: what the renderer is told */
    readonly: boolean;
    /** the cell can be edited in the grid's editor: not readonly, not `allowPasteClearOnly` */
    editable: boolean;
    /** a text of several lines, see isMultilineCell: it is edited in the multiline editor */
    multiline: boolean;
    /** the classes of the dimmed div: the stripes, the `cellClass` hook's background */
    backgroundClass: string;
    /** more classes of the host: the `cellClass` hook's input, a repeated value */
    hostClass: string;
    /** the value repeats the row above (`dimRepeatedValues`) */
    repeated: boolean;
    /** the style of the host: in a row made taller, the padding that keeps its content on the first line */
    hostStyle: string;
}

/**
 * Renders a custom cell: the template, then the renderer - mounted when the cell has none, or another one
 * - and its `update()` with the row
 */
export function renderCustomCell(ctx: Grid, custom: CustomCell) {
    const { cell, row, column, celno, colType, cellType, field, entity } = custom;
    const isDate = custom.type === 'date' || custom.type === 'datetime';
    // the instance mounted in the cell, read when an event comes: it is mounted after the template
    const ownEdit = () => cell.$renderer?.instance.edit;
    // a right click focuses the cell: not a focus of the cell for the events and the ranges, the row menu
    // opens on the ranges as they are (as in the default cell)
    let skipFocus = false;
    // the event data of the grid events
    const cellData = { cell, row, column, celno, colType, cellType, attribute: field, rowData: entity };

    render(
        html`<div style="width:100%;height:100%;">
            <div data-attribute-dimmed=${field} class=${custom.backgroundClass}></div>
            <div
                class=${`${CUSTOM_CELL_CLASS} cellpos-${colType}-${row}-${column}-${celno} ${custom.hostClass}`}
                tabindex="0"
                style=${custom.hostStyle}
                data-attribute=${field}
                data-repeated-value=${custom.repeated ? 'true' : 'false'}
                @contextmenu=${(e: MouseEvent) => {
                    e.preventDefault();
                    contextmenuRow(ctx, e, cell, row, column, celno, colType, cellType, field, entity);
                }}
                @mousedown=${(e: MouseEvent) => {
                    if (e.button === 2) {
                        // the focus follows in this mousedown's default action, when the cell does not have it
                        skipFocus = true;
                        setTimeout(() => {
                            skipFocus = false;
                        });
                    }
                }}
                @click=${(e: MouseEvent) => {
                    // Shift+click makes a range of cells from the active cell (rangeSelection.ts), which
                    // stays the active cell: its row stays the current row
                    if (e.shiftKey) {
                        return;
                    }
                    ctx.gridInterface.getDatasource().setRowAsCurrentEntity(row);
                    triggerScrollEvent(ctx);
                    // a date cell the renderer only draws: the date picker, as the default cell's click.
                    // Not for a Ctrl/Cmd+click: it adds a range of cells
                    if (isDate && custom.editable && !ownEdit() && !e.ctrlKey && !e.metaKey) {
                        setTimeout(() => openDatePicker(ctx, custom, e));
                    }
                    setTimeout(() => {
                        ctx.gridInterface.__callSubscribers('cell-click', { ...cellData, originalEvent: e });
                    });
                }}
                @dblclick=${() => {
                    // a date cell: its click opened the date picker
                    if (!isDate || ownEdit()) {
                        editCustomCell(ctx, custom);
                    }
                }}
                @focusin=${(e: FocusEvent) => {
                    // the focus moved within the cell, between the host and what the renderer put in it
                    if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) {
                        return;
                    }
                    if (skipFocus) {
                        skipFocus = false;
                        return;
                    }
                    cell.$focused = true;
                    // another cell than the active one: the ranges of cells are cleared
                    rangeCellFocused(ctx, row, field);
                    ctx.gridInterface.__callSubscribers('cell-row-focus', { ...cellData, originalEvent: e });
                }}
                @focusout=${(e: FocusEvent) => {
                    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) {
                        cell.$focused = false;
                    }
                }}
                @keydown=${(e: KeyboardEvent) => customCellKeydown(ctx, custom, e)}
            ></div>
        </div>`,
        cell
    );

    const host = cell.querySelector(`:scope > div > .${CUSTOM_CELL_CLASS}`) as HTMLElement;
    mountRenderer(cell, host, custom).update({
        row: entity,
        field,
        value: entity[field],
        text: custom.text,
        type: custom.type,
        readonly: custom.readonly,
        rowIndex: row,
        gridInterface: ctx.gridInterface
    });
}

/**
 * The instance of the cell's renderer: the one mounted in this host, else a new one - the renderer
 * called with the host, after the one the cell had is destroyed and the host emptied
 */
function mountRenderer(cell: HTMLCellElement, host: HTMLElement, custom: CustomCell): CellRendererInstance<any> {
    const mounted = cell.$renderer;
    if (mounted && mounted.id === custom.renderer && mounted.host === host) {
        return mounted.instance;
    }
    releaseRenderer(cell);
    // checked when the grid was made and by updateConfig(), so it is there
    const instance = getCellRenderer(custom.renderer, `GridConfig: columns.${custom.field}.renderer`)(host);
    // plain js can return anything: say so now, not on the next render
    if (typeof instance?.update !== 'function') {
        throw new TypeError(`registerCellRenderer: the renderer '${custom.renderer}' returned no { update(context) {} }`);
    }
    cell.$renderer = { id: custom.renderer, instance, host };
    return instance;
}

/**
 * The cell element is done with its renderer: it shows something else now (lit-html is about to remove
 * the host), or it is thrown away. Its `destroy()` is called once and the host emptied. Nothing happens
 * for a cell without one
 */
export function releaseRenderer(cell: HTMLCellElement) {
    const mounted = cell.$renderer;
    if (!mounted) {
        return;
    }
    // first: a destroy() that throws does not leave it mounted
    cell.$renderer = undefined;
    mounted.instance.destroy?.();
    mounted.host.replaceChildren();
}

/**
 * Releases the renderers of every body cell, before the cells are thrown away (rebuildRows,
 * rebuildRowColumns) and when the grid leaves the dom (disconnectElement): a React root or a
 * subscription in a cell would keep the grid alive. The cells are made again when it comes back
 */
export function releaseAllRenderers(ctx: Grid) {
    for (const columnElement of ctx.columns.values()) {
        for (const cell of columnElement.children) {
            releaseRenderer(cell as HTMLCellElement);
        }
    }
}

/**
 * The keys of a custom cell: those of the default cell - the ranges, Delete, fill down, undo / redo, Tab
 * and Alt+arrows - and on the host itself (not on what the renderer put in it, those keys are the
 * renderer's): the keys that jump (Ctrl+Home, PageDown ..., jumpKeys.ts), the plain arrows move to the
 * next cell, the host has no caret; Enter, F2 and a character typed edit the cell
 */
function customCellKeydown(ctx: Grid, custom: CustomCell, e: KeyboardEvent) {
    const { cell, row, column, celno, colType, field, entity } = custom;
    // the ranges of cells: Alt+Shift+arrows, Esc, Delete (rangeSelection.ts), and fill down
    if (rangeKeydown(ctx, e, row, field) || rangeDeleteKey(ctx, e) || fillDownKey(ctx, e, row, field)) {
        return;
    }
    if (undoRedoKey(ctx, e, entity, field)) {
        return;
    }

    if (e.target === e.currentTarget && !e.isComposing) {
        // the keys that jump (jumpKeys.ts): on the host only, a control in the cell has its own PageDown
        if (jumpKeydown(ctx, e, row, { colType, column, celno })) {
            return;
        }
        const modifier = e.altKey || e.ctrlKey || e.metaKey;
        if (!modifier && (e.key === 'Enter' || e.key === 'F2')) {
            if (editCustomCell(ctx, custom)) {
                e.preventDefault();
            }
            return;
        }
        if (isTypedCharacter(e) && editCustomCell(ctx, custom, e.key)) {
            e.preventDefault();
            return;
        }
        if (!modifier && !e.shiftKey && ARROWS.includes(e.key)) {
            cellRowKeyNavigationCellRowHandler(ctx, cell, row, column, celno, colType, e, e.key);
            return;
        }
        // Space on an element that is no control scrolls the page
        if (e.key === ' ') {
            e.preventDefault();
        }
    }

    cellRowKeyNavigationCellRowHandler(ctx, cell, row, column, celno, colType, e, '');
}

/**
 * Edits the cell - for Enter, F2, a character typed, a double click: the renderer's `edit()` when it has
 * one, else the grid's text editor over the cell. One line for a text of one line, Enter saves; the
 * multiline editor for a text of several lines. A cell that can not be edited gets nothing - but the
 * multiline editor shows its text read-only, as a multiline cell does (not for typing)
 * @param typed the character typed, put at the end of the text
 * @returns true when it did something: the key's default is prevented
 */
export function editCustomCell(ctx: Grid, custom: CustomCell, typed?: string): boolean {
    const instance = custom.cell.$renderer?.instance;
    if (instance?.edit) {
        if (custom.editable) {
            instance.edit(typed);
        }
        return custom.editable;
    }
    if (!custom.editable && (!custom.multiline || typed !== undefined)) {
        return false;
    }
    // a boolean has no text to edit: the renderer edits it, or nothing does
    if (custom.type === 'boolean') {
        return false;
    }
    const { cell, row, column, celno, colType, field, entity, formatter } = custom;
    openTextEditor(
        ctx,
        {
            cell,
            row: entity,
            field,
            formatter,
            readonly: !custom.editable,
            singleLine: !custom.multiline,
            tab: (event) => cellRowKeyNavigationCellRowHandler(ctx, cell, row, column, celno, colType, event, '')
        },
        typed
    );
    return true;
}

/**
 * The date picker under the cell, as the click on a default date cell opens it: on the cell's date, a
 * date picked is written to the row
 */
function openDatePicker(ctx: Grid, custom: CustomCell, event: MouseEvent) {
    const { cell, entity, field, formatter } = custom;
    const current = entity[field];
    contextmenuDate(
        ctx,
        event,
        cell,
        // a Date as it is. Text in the data (an iso string) is read by the formatter, anything else opens
        // the picker on today
        typeof current === 'string' ? formatter.parse(current) : current,
        (value: Date | null) => {
            entity[field] = value;
            triggerScrollEvent(ctx);
        }
    );
}
