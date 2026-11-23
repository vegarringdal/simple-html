import { html, render } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { hasDisplayFormat } from '../columnFormat';
import type { Grid } from '../grid';
import { asPx } from './asPx';
import { createElement } from './createElement';
import { dragEvent } from './dragEvent';
import { getColumnLabel, getConfigColumnLabel } from './getColumnLabel';
import { gridText } from './gridText';
import type { HTMLCellElement } from './HTMLCellElement';
import { DRAG_HANDLE_ICON, PENCIL_ICON, SEARCH_ICON } from './icons';
import { closePopover, removeContextMenu } from './removeContextMenu';
import { moveMenu, popoverParent } from './showMenu';
import { attachTooltips, tooltipsEnabled } from './tooltip';

// might want to add this as part of context, so I can share it?
let currentColumnSearchvalue = '';

/** the class of a field's row: dragged into the header (dragEvent.ts) */
const FIELD_CLASS = 'simple-html-grid-menu-item';

/**
 * The fields the column chooser lists for a search: every column of the config whose field name or
 * label (getColumnLabel - a label the user gave it too) has the search in it, any case. By their labels,
 * as the list shows them. Not a calculated column that was removed: it is no field anymore
 */
export function columnChooserFields(ctx: Pick<Grid, 'gridInterface'>, search: string): { field: string; label: string }[] {
    const query = search.trim().toLowerCase();
    return Object.keys(ctx.gridInterface.__getGridConfig().columns)
        .filter((field) => !ctx.gridInterface.__isGoneCalculated(field))
        .map((field) => ({ field, label: getColumnLabel(ctx, field) }))
        .filter(({ field, label }) => field.toLowerCase().includes(query) || label.toLowerCase().includes(query))
        .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Gives a column a label of the user's: the label of its format in the grid's state
 * (`ColumnFormat.label`, `setState({ formats })`) - the same as the grid config dialog's *Label*, the
 * other parts of the column's format kept. Empty (or only spaces): the column's own label again, the
 * format's `label` taken out. Nothing changes when the label is the one it has
 */
export function renameColumn(ctx: Pick<Grid, 'gridInterface'>, field: string, label: string) {
    const gridInterface = ctx.gridInterface;
    const formats = gridInterface.getState().formats;
    const now = formats[field]?.label;
    const next = label.trim() || undefined;
    if (next === now) {
        return;
    }
    const format = { ...formats[field], label: next };
    if (next === undefined) {
        delete format.label;
    }
    if (hasDisplayFormat(format)) {
        formats[field] = format;
    } else {
        delete formats[field];
    }
    gridInterface.setState({ formats });
}

/**
 * The column chooser, from the header menu: the fields the grid knows, to drag into the header.
 *
 * A `popover="manual"` of its own, apart from the grid's menu (ctx.contextMenu): it stays open while
 * columns are dragged from it and the grid is used, a click outside or another menu does not close
 * it. Its Close button does, Esc while the focus is in it (its search field, a ✎), and the grid leaving
 * the page.
 *
 * - **The search** is framed as an input, a magnifying glass in front: it finds a field by its name or
 *   its label (columnChooserFields)
 * - **A field** has a drag handle at its left - it shows that the field is dragged, the whole row drags
 *   - its label, and a ✎ button at its right (shown under the pointer and with the focus, always on a
 *   touch screen): it turns the label into an input with the label. Enter (or leaving it) gives the
 *   column that label (renameColumn: `ColumnFormat.label`, the dialog's *Label*), Esc leaves it as it
 *   was; empty is the column's own label - the input's placeholder. The header and everything that
 *   names the column follow
 *
 * A finger scrolls the list (its fields are `touch-action: pan-y`) and drags a field once it held it
 * still for TOUCH_HOLD ms, as on the header. The dragged field is shown over the chooser: dragEvent's
 * ghost is a popover too, shown after it.
 */
export function contextMenuColumnChooser(ctx: Grid, event: MouseEvent, cell: HTMLElement) {
    removeContextMenu(ctx);
    // one at a time
    ctx.columnChooserMenu?.remove();

    const contextMenu = createElement('div', 'simple-html-grid');
    contextMenu.classList.add('simple-html-grid-reset', 'simple-html-grid-popover');
    contextMenu.popover = 'manual';
    contextMenu.style.minWidth = asPx(130);

    // the focus goes back here when the chooser closes with the focus in it, see closePopover
    const returnFocus = document.activeElement;
    const close = () => {
        // or disconnectElement tries to remove it again
        if (ctx.columnChooserMenu === contextMenu) {
            ctx.columnChooserMenu = null;
        }
        closePopover(contextMenu, returnFocus);
    };
    contextMenu.addEventListener('keydown', (keyEvent) => {
        if (keyEvent.key === 'Escape' && !keyEvent.defaultPrevented) {
            // not the grid's menu, not a dialog the chooser is in
            keyEvent.preventDefault();
            close();
        }
    });
    // the tooltips of the handles, the ✎ and the input of a label, as the grid's `tooltips` option says.
    // A press hides them: the field dragged does not take one along
    attachTooltips(contextMenu, () => tooltipsEnabled(ctx));

    // the listeners of dragEvent on the fields of the last render: made again with each render
    let controller = new AbortController();
    // the field whose label is an input (its ✎ was pressed), null for none
    let renaming: string | null = null;

    /** the element of a field in the list */
    const fieldElement = (field: string) =>
        Array.from(contextMenu.getElementsByClassName(FIELD_CLASS)).find(
            (element) => (element as HTMLCellElement).$attribute === field
        ) as HTMLElement | undefined;

    /** the ✎ of a field: its label an input, with the focus, the label selected */
    const startRename = (field: string) => {
        renaming = field;
        reRender();
        const input = fieldElement(field)?.querySelector('input');
        input?.focus();
        input?.select();
    };
    /**
     * the end of a rename: Enter and leaving the input save it, Esc does not
     * @param focus the focus back on the field's ✎ - not when it left the input for another element
     */
    const endRename = (save: boolean, focus: boolean) => {
        const field = renaming;
        const input = field === null ? null : fieldElement(field)?.querySelector('input');
        if (field === null || !input) {
            return;
        }
        // first: the input removed by the render below gets a blur, it ends nothing then
        renaming = null;
        if (save) {
            renameColumn(ctx, field, input.value);
        }
        reRender();
        if (focus) {
            fieldElement(field)?.querySelector<HTMLElement>('button')?.focus();
        }
    };

    /** a field of the list: the handle, the label (or its input) and the ✎ */
    const fieldTemplate = (field: string, label: string) => {
        // a press in the input or on the ✎ is not a drag of the field
        const notDragged = (pointerEvent: Event) => pointerEvent.stopPropagation();
        const name = getConfigColumnLabel(ctx, field);
        return html`<div class=${FIELD_CLASS} .$attribute=${field}>
            <span class="simple-html-grid-drag-handle simple-html-grid-chooser-handle" aria-hidden="true" data-tooltip=${gridText(ctx, 'columnChooser.drag')}
                >${DRAG_HANDLE_ICON}</span
            >
            ${
                renaming === field
                    ? html`<input
                          class="simple-html-grid-chooser-label-input"
                          type="text"
                          spellcheck="false"
                          autocomplete="off"
                          .value=${label}
                          placeholder=${name}
                          aria-label=${gridText(ctx, 'columnChooser.label', { label: name })}
                          data-tooltip=${gridText(ctx, 'columnChooser.label.hint')}
                          @pointerdown=${notDragged}
                          @keydown=${(keyEvent: KeyboardEvent) => {
                              if (keyEvent.key === 'Enter' || keyEvent.key === 'Escape') {
                                  // Esc: not the chooser's, it stays open
                                  keyEvent.preventDefault();
                                  endRename(keyEvent.key === 'Enter', true);
                              }
                          }}
                          @blur=${() => endRename(true, false)}
                      />`
                    : html`<span class="simple-html-grid-chooser-label">${label}</span>
                          <button
                              type="button"
                              class="simple-html-grid-chooser-rename"
                              aria-label=${gridText(ctx, 'columnChooser.rename', { label })}
                              data-tooltip=${gridText(ctx, 'columnChooser.rename', { label })}
                              @pointerdown=${notDragged}
                              @click=${() => startRename(field)}
                          >
                              ${PENCIL_ICON}
                          </button>`
            }
        </div>`;
    };

    const reRender = () => {
        controller.abort();
        controller = new AbortController();

        render(
            html`<div class="simple-html-grid-menu simple-html-grid-column-chooser">
                <div class="simple-html-grid-menu-section">${gridText(ctx, 'columnChooser.title')}</div>
                <hr class="hr-solid" />
                <label class="simple-html-grid-chooser-search">
                    ${SEARCH_ICON}
                    <input
                        class="simple-html-grid-menu-item-input"
                        type="text"
                        spellcheck="false"
                        autocomplete="off"
                        .value=${live(currentColumnSearchvalue)}
                        placeholder=${gridText(ctx, 'columnChooser.search')}
                        aria-label=${gridText(ctx, 'columnChooser.search')}
                        @input=${(inputEvent: Event) => {
                            currentColumnSearchvalue = (inputEvent.target as HTMLInputElement).value;
                            reRender();
                        }}
                    />
                </label>
                <div class="simple-html-grid-menu-sub simple-html-dialog-scroller">
                    ${columnChooserFields(ctx, currentColumnSearchvalue).map(({ field, label }) => fieldTemplate(field, label))}
                </div>
                <div class="simple-html-label-button-menu-bottom" @click=${() => close()}>
                    ${gridText(ctx, 'columnChooser.close')}
                </div>
            </div>`,
            contextMenu
        );
        const cells = contextMenu.getElementsByClassName(FIELD_CLASS);

        // a finger scrolls the list up and down, and drags a field after holding it still (dragEvent.ts)
        for (let i = 0; i < cells.length; i++) {
            dragEvent(ctx, cells[i] as HTMLCellElement, false, controller.signal, 'pan-y');
        }
    };
    ctx.columnChooserMenu = contextMenu;
    popoverParent(cell).appendChild(contextMenu);
    contextMenu.showPopover();

    // under the header, around the mouse
    const rect = cell.getBoundingClientRect();
    let left = event.clientX - 65;
    if (event.clientX + 70 > window.innerWidth) {
        left = window.innerWidth - 150;
    }
    if (event.clientX - 65 < 0) {
        left = 5;
    }
    moveMenu(contextMenu, left, rect.bottom + 50);

    reRender();
}
