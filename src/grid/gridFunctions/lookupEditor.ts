import { html, nothing, render, svg } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import type { Entity } from '../../datasource/entity';
import type { Grid } from '../grid';
import type { GridConfig, LayoutColumn } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { GridInterface } from '../gridInterface';
import type { RegisteredLookup } from '../lookup';
import { asPx } from './asPx';
import { createElement } from './createElement';
import { DIV } from './DIV';
import { getColumnLabel } from './getColumnLabel';
import { getElementByClassName } from './getElementByClassName';
import { gridText } from './gridText';
import { type LookupColumn, writeCellValue } from './lookupColumn';
import { removeContextMenu } from './removeContextMenu';
import { placeAt, placeMenu, popoverParent, WINDOW_MARGIN } from './showMenu';

/**
 * The editors of a lookup column (ColumnConfig.editor, lookupColumn.ts): a popover under the cell with
 * the rows of the lookup to pick from - a list with a search field (`type: 'select'`) or a grid
 * (`type: 'grid'`). The grid's one open editor is `ctx.lookupEditor`.
 *
 * Like the editor of a multiline cell (textEditor.ts) and the menus: a popover (`popover="manual"`, the
 * top layer) in the dialog or popover the grid is in (popoverParent), kept in the window (placeMenu).
 * One popover of the grid is open at a time: opening it closes the menu and the text editor, and they
 * close it. It closes on a click outside it, when the grid scrolls and when the grid leaves the page.
 *
 * Picking writes the value of the picked row, and the fields of the editor's `set`, in one run of code:
 * one step of the undo history (writeCellValue).
 */

/**
 * the most options the select shows: a long list is cut there, with a line that says so - typing in
 * the search finds the rest. Rendering is what costs, see the lookups guide for the times
 */
export const MAX_OPTIONS = 500;

/**
 * how many options PageUp / PageDown move: about what the list shows (its max-height in grid.css)
 */
const PAGE_OPTIONS = 10;

/**
 * how many rows the dropdown grid shows; fewer when the lookup has fewer, never fewer than this
 */
const GRID_ROWS = 9;
const GRID_MIN_ROWS = 3;

/**
 * the ms ArrowDown in the dropdown grid's filter waits before it puts the focus in the row, scrolled to
 * first - as the grid's own Alt+arrows wait for the cell they go to
 */
const FOCUS_ROW_MS = 100;

/**
 * the width of a column the dropdown grid makes itself, when the lookup has no config
 */
const GRID_VALUE_WIDTH = 80;
const GRID_LABEL_WIDTH = 200;

/**
 * the mark of the current value in the select: a check, in the colour of the text
 */
const CHECK_ICON = svg`<svg class="simple-html-grid-lookup-check" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
    <path d="M1.5 5.2 4 7.7 8.6 2.4" />
</svg>`;

/**
 * The open editor, `ctx.lookupEditor`
 */
export interface LookupEditor {
    /** the popover */
    element: HTMLElement;
    /** the cell element it was opened for */
    cell: HTMLElement;
    /**
     * Closes it, the value as it is. Does nothing when it is closed already
     * @param returnFocus the focus goes back to the cell when it was in the editor - not for a click
     * outside it, the click puts the focus where it is
     */
    close(returnFocus: boolean): void;
}

/**
 * The cell an editor is opened for
 */
export interface LookupEditorCell {
    /** the cell element: the editor goes under it */
    cell: HTMLElement;
    /** the cell's input: it gets the focus back */
    input: HTMLElement;
    /** the cell's row */
    row: Entity;
    /** the cell's field */
    field: string;
    /** the column's editor and lookup */
    column: LookupColumn;
    /** the cell's Tab, called with the Tab's keydown once the editor is closed: the next cell */
    tab: (event: KeyboardEvent) => void;
}

/**
 * Opens the column's editor under a cell, the focus in its search field - and closes the menu, the
 * text editor and an editor open for another cell.
 * @param search the character typed in the cell that opened it: the search starts with it
 */
export function openLookupEditor(ctx: Grid, target: LookupEditorCell, search = '') {
    // an interface shows one grid at a time: taking it from the grid it is in would leave that grid
    // without its datasource. Said before anything is opened
    const linked = target.column.lookup.gridInterface;
    if (target.column.editor.type === 'grid' && linked?.__isConnected()) {
        throw new Error(
            `the gridInterface of the lookup '${target.column.lookup.id}' is shown in a grid already: it can be shown in one grid at a time, give the lookup an interface of its own`
        );
    }
    ctx.textEditor?.close(true, true);
    ctx.lookupEditor?.close(false);
    removeContextMenu(ctx);

    const { cell, input, row, field, column } = target;
    // the cell counts as being edited while the editor is open: a merge (datasource.upsert) does not
    // overwrite it, a server value for it is a conflict - see History.startEditing
    const history = ctx.gridInterface.getDatasource().getDataContainer().__history;

    const element = createElement(DIV, 'simple-html-grid');
    element.classList.add(
        'simple-html-grid-reset',
        'simple-html-grid-popover',
        'simple-html-grid-lookup',
        `simple-html-grid-lookup-${column.editor.type}`
    );
    element.popover = 'manual';
    // at least as wide as the cell
    element.style.minWidth = asPx(cell.getBoundingClientRect().width);
    popoverParent(cell).appendChild(element);
    // shown before its content is made: the dropdown grid measures itself when it is put on the page
    element.showPopover();

    // the listeners of this editor, removed when it closes
    const abort = new AbortController();
    const signal = abort.signal;
    // what the editor's content undoes when it closes, see openGrid
    let cleanup: () => void = () => undefined;

    const editor: LookupEditor = {
        element,
        cell,
        close(focusCell) {
            if (ctx.lookupEditor !== editor) {
                return;
            }
            ctx.lookupEditor = null;
            abort.abort();
            const hadFocus = element.contains(document.activeElement);
            cleanup();
            element.remove();
            history.endTyping();
            if (focusCell && hadFocus && input.isConnected) {
                input.focus({ preventScroll: true });
            }
        }
    };
    ctx.lookupEditor = editor;

    // picks a row: closed first - the focus is back in the cell - then the value and `set` are written
    // in one run of code, one step of the undo history. null: nothing to pick, it closes
    const pick = (picked: Entity | null) => {
        editor.close(true);
        if (picked) {
            writeCellValue(ctx.gridInterface, row, field, picked[column.lookup.valueField]);
        }
    };

    if (column.editor.type === 'grid') {
        cleanup = openGrid(element, target, search, pick, () => editor.close(true));
    } else {
        openSelect(ctx, element, target, search, pick, () => editor.close(true));
    }
    placeMenu(element, placeAt(cell));

    // a click outside it closes it - on the press, before the click moves the focus. Not a click on the
    // cell's button, it opens and closes the editor itself, and not in a popover of the dropdown grid
    // (its date picker). The path and not the target: in a shadow root the document gets the shadow host
    // as the target
    document.addEventListener(
        'mousedown',
        (event) => {
            const path = event.composedPath();
            const inPopover = path.some((node) => node instanceof Element && node.classList.contains('simple-html-grid-popover'));
            const onButton = path.some(
                (node) => node instanceof Element && node.classList.contains('simple-html-grid-lookup-button')
            );
            if (!inPopover && !(onButton && path.includes(cell))) {
                editor.close(false);
            }
        },
        { capture: true, signal }
    );
    // scrolling the grid: the cell is moving away. As the text editor, see there
    for (const scroller of ['simple-html-grid-body-scroller', 'simple-html-grid-middle-scroller']) {
        getElementByClassName(ctx.element, scroller).addEventListener('scroll', () => editor.close(false), { signal });
    }
    ctx.element.addEventListener('wheel', () => editor.close(false), { passive: true, signal });

    // after the focus moved into the editor: the cell input's blur ended the editing of the cell
    history.startEditing(row, field);
}

/**
 * Closes the grid's editor, when one is open: the value as it is
 */
export function closeLookupEditor(ctx: Grid) {
    ctx.lookupEditor?.close(true);
}

/**
 * true when the cell's editor is open
 */
export function isLookupEditorOpen(ctx: Grid, cell: HTMLElement): boolean {
    return ctx.lookupEditor?.cell === cell;
}

/**
 * One option of the select: a row of the lookup and its label
 */
interface Option {
    row: Entity;
    label: string;
}

/**
 * The select: a search field and the options under it, see ColumnEditor. The search field is a
 * combobox with the list as its listbox (the WAI-ARIA combobox pattern, with aria-activedescendant):
 * the focus stays in it, the arrows move the active option.
 */
function openSelect(
    ctx: Grid,
    element: HTMLElement,
    target: LookupEditorCell,
    search: string,
    pick: (row: Entity | null) => void,
    close: () => void
) {
    const { lookup } = target.column;
    const label = getColumnLabel(ctx, target.field);
    const current = target.row[target.field];
    const listId = `${ctx.ariaIdPrefix}-lookup-list`;
    const optionId = (index: number) => `${ctx.ariaIdPrefix}-lookup-option-${index}`;

    const options: Option[] = lookup.rows().map((row) => ({ row, label: lookup.labelOf(row) }));
    const isCurrent = (option: Option) => current !== null && current !== undefined && option.row[lookup.valueField] === current;

    let query = search;
    let matches = options;
    // the active option, an index in the shown ones. -1: none
    let active = -1;

    // the options whose label has the search, ignoring case
    const find = () => {
        const text = query.trim().toLocaleLowerCase();
        matches = text ? options.filter((option) => option.label.toLocaleLowerCase().includes(text)) : options;
    };
    find();
    // a search: its first match. Else the current value, when it is shown
    active = query ? (matches.length ? 0 : -1) : matches.slice(0, MAX_OPTIONS).findIndex(isCurrent);

    const shown = () => matches.slice(0, MAX_OPTIONS);

    const draw = () => {
        const list = shown();
        render(
            html`<input
                    class="simple-html-grid-lookup-search"
                    role="combobox"
                    aria-expanded="true"
                    aria-controls=${listId}
                    aria-autocomplete="list"
                    aria-activedescendant=${active >= 0 ? optionId(active) : nothing}
                    aria-label=${label}
                    placeholder=${gridText(ctx, 'lookup.search')}
                    autocomplete="off"
                    .value=${live(query)}
                    @input=${(event: Event) => {
                        query = (event.target as HTMLInputElement).value;
                        find();
                        active = matches.length ? 0 : -1;
                        draw();
                        listElement().scrollTop = 0;
                    }}
                    @keydown=${(event: KeyboardEvent) => keydown(event)}
                />
                <div
                    class="simple-html-grid-lookup-list"
                    role="listbox"
                    id=${listId}
                    aria-label=${label}
                    @mousedown=${(event: MouseEvent) => {
                        // the focus stays in the search field
                        event.preventDefault();
                    }}
                >
                    ${list.map(
                        (option, index) =>
                            html`<div
                                role="option"
                                id=${optionId(index)}
                                aria-selected=${index === active ? 'true' : 'false'}
                                class=${`simple-html-grid-lookup-option${index === active ? ' simple-html-grid-lookup-option-active' : ''}${isCurrent(option) ? ' simple-html-grid-lookup-option-current' : ''}`}
                                @mousemove=${() => {
                                    if (active !== index) {
                                        active = index;
                                        draw();
                                    }
                                }}
                                @click=${() => pick(option.row)}
                            >
                                ${isCurrent(option) ? CHECK_ICON : nothing}${option.label}
                            </div>`
                    )}
                </div>
                ${
                    matches.length === 0
                        ? html`<div class="simple-html-grid-lookup-note" role="status">${gridText(ctx, 'lookup.noMatch')}</div>`
                        : nothing
                }
                ${
                    matches.length > list.length
                        ? html`<div class="simple-html-grid-lookup-note">
                              ${gridText(ctx, 'lookup.more', { shown: list.length, count: matches.length })}
                          </div>`
                        : nothing
                }`,
            element
        );
    };

    const listElement = () => element.querySelector('.simple-html-grid-lookup-list') as HTMLElement;

    // the active option in view: scrolled in the list only, the page does not move
    const scrollToActive = () => {
        const option = active >= 0 ? element.querySelector<HTMLElement>(`#${optionId(active)}`) : null;
        const list = listElement();
        if (!option) {
            return;
        }
        if (option.offsetTop < list.scrollTop) {
            list.scrollTop = option.offsetTop;
        } else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) {
            list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
        }
    };

    const moveTo = (index: number) => {
        const last = shown().length - 1;
        if (last < 0) {
            return;
        }
        active = Math.max(0, Math.min(index, last));
        draw();
        scrollToActive();
    };

    const keydown = (event: KeyboardEvent) => {
        // the keys of an input method (IME) while it composes are its own
        if (event.isComposing) {
            return;
        }
        const modifier = event.ctrlKey || event.altKey || event.metaKey;
        const activeOption = active >= 0 ? (shown()[active] ?? null) : null;
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                moveTo(active + 1);
                break;
            case 'ArrowUp':
                event.preventDefault();
                moveTo(active - 1);
                break;
            case 'PageDown':
                event.preventDefault();
                moveTo(active + PAGE_OPTIONS);
                break;
            case 'PageUp':
                event.preventDefault();
                moveTo(active - PAGE_OPTIONS);
                break;
            case 'Home':
                event.preventDefault();
                moveTo(0);
                break;
            case 'End':
                event.preventDefault();
                moveTo(shown().length - 1);
                break;
            case 'Enter':
                event.preventDefault();
                pick(activeOption?.row ?? null);
                break;
            case 'Escape':
                // canceled: a modal dialog the grid is in does not close on it
                event.preventDefault();
                close();
                break;
            case 'Tab':
                if (!modifier) {
                    // the active option is picked, the Tab goes on to the next cell as Tab in the cell does
                    pick(activeOption?.row ?? null);
                    target.tab(event);
                }
                break;
        }
    };

    draw();
    const searchInput = element.querySelector('input') as HTMLInputElement;
    searchInput.focus({ preventScroll: true });
    searchInput.setSelectionRange(query.length, query.length);
    scrollToActive();
}

/**
 * The dropdown grid: the lookup's grid interface (one made for it, or the one it links) in a grid
 * element in the popover, see ColumnEditor. The focus goes to the filter of the label's column.
 * @returns what is undone when the editor closes
 */
function openGrid(
    element: HTMLElement,
    target: LookupEditorCell,
    search: string,
    pick: (row: Entity | null) => void,
    close: () => void
): () => void {
    const { lookup } = target.column;
    const linked = lookup.gridInterface;
    // the state it started in: the filter typed the last time it was open is gone
    linked?.resetState();
    const gridInterface = linked ?? new GridInterface(dropdownConfig(lookup), lookup.datasource);
    const datasource = gridInterface.getDatasource();

    // the size it needs, from its config. Set before it is built: a grid rebuilds when its size changes,
    // the focus in its filter would be lost. Parsed before it is on the page, its row numbers are
    // measured with a fixed font - within a px or two of the grid's own
    gridInterface.__parseConfig();
    const size = dropdownSize(gridInterface);
    const gridElement = document.createElement('simple-html-grid') as GridElement;
    gridElement.style.width = asPx(Math.min(size.width, document.documentElement.clientWidth - 2 * WINDOW_MARGIN));
    gridElement.style.height = asPx(size.height);
    gridElement.connectInterface(gridInterface);
    element.appendChild(gridElement);

    // the row of the cell's value is the selected row, scrolled to. Its index in the displayed rows
    const currentRow = lookup.rowOf(target.row[target.field]);
    const index = currentRow ? datasource.getRows().indexOf(currentRow) : -1;
    if (index !== -1) {
        datasource.select(index + 1, { notify: true });
    }

    // the row with the focus: the one Enter picks
    let focusedRow: Entity | null = null;
    const unsubscribe = [
        gridInterface.on('cell-row-focus', (data) => {
            focusedRow = data.rowData;
        }),
        gridInterface.on('cell-click', (data) => pick(data.rowData)),
        // the search narrowed the rows: the first row is the selected one, Enter in the filter picks it
        datasource.on('collection-filtered', () => datasource.selectFirst())
    ];

    // the filter of the label's column, else the first filter
    const filter = filterInputOf(gridElement, gridInterface, lookup.labelField);
    filter?.focus({ preventScroll: true });
    if (filter && search) {
        filter.value = search;
        filter.setSelectionRange(search.length, search.length);
        filter.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // the highlighted row: the selected one - the cell's value when it opened, the first row after a
    // search - else the first row. Enter in the filter picks it, ArrowDown goes to it
    const highlighted = (): Entity | null => datasource.getSelectedRows()[0] ?? datasource.getDataRows()[0] ?? null;

    // ArrowDown in a filter: the cell under it in the highlighted row, which is scrolled into view
    // first. The focus once the grid has rendered it, after a moment as its own Alt+arrows do
    const focusHighlighted = (filterInput: HTMLInputElement) => {
        const row = highlighted();
        const place = /filter-cellpos-([a-z]+-pinned)-\d+-(\d+)-(\d+)/.exec(filterInput.className);
        if (!row || !place) {
            return;
        }
        const rowIndex = datasource.getRows().indexOf(row);
        datasource.select(rowIndex + 1, { notify: true });
        setTimeout(() => {
            gridElement.querySelector<HTMLInputElement>(`input.cellpos-${place[1]}-${rowIndex}-${place[2]}-${place[3]}`)?.focus();
        }, FOCUS_ROW_MS);
    };

    // the keys of a picker, before the grid's own (capture). The grid moves between its cells with
    // Alt+arrows: in the rows the plain arrows do it here, sent again with Alt
    element.addEventListener(
        'keydown',
        (event) => {
            const input = event.target instanceof HTMLInputElement ? event.target : null;
            if (event.isComposing || !input) {
                return;
            }
            const inFilter = input.classList.contains('simple-html-grid-cell-filter-input');
            const modifier = event.ctrlKey || event.altKey || event.metaKey || event.shiftKey;
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                close();
            } else if (event.key === 'Enter' && !modifier) {
                event.preventDefault();
                event.stopPropagation();
                pick(inFilter ? highlighted() : focusedRow);
            } else if (event.key === 'ArrowDown' && inFilter && !modifier) {
                event.preventDefault();
                event.stopPropagation();
                focusHighlighted(input);
            } else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !inFilter && !modifier) {
                event.preventDefault();
                event.stopPropagation();
                input.dispatchEvent(
                    new KeyboardEvent('keydown', {
                        key: event.key,
                        code: event.code,
                        altKey: true,
                        bubbles: true,
                        cancelable: true
                    })
                );
            }
        },
        { capture: true }
    );
    // the filter row searches as you type: the change the header filter filters on, at every key
    element.addEventListener(
        'input',
        (event) => {
            if (
                event.target instanceof HTMLInputElement &&
                event.target.classList.contains('simple-html-grid-cell-filter-input')
            ) {
                event.target.dispatchEvent(new Event('change', { bubbles: true }));
            }
        },
        { capture: true }
    );
    // no menus in a picker: the right click menus of the dropdown grid are left out
    element.addEventListener(
        'contextmenu',
        (event) => {
            event.preventDefault();
            event.stopPropagation();
        },
        { capture: true }
    );

    return () => {
        for (const off of unsubscribe) {
            off();
        }
        // one made for the dropdown is done with, the linked one is kept: its element leaves the page
        // with the popover, that disconnects it
        if (!linked) {
            gridInterface.destroy();
        }
    };
}

/**
 * The config of a dropdown grid made for a lookup: its `config`, or one column of the label (the value
 * and the label when they differ) - with the options of a picker for what it leaves out: no grouping
 * panel, no footer, no column numbers, no row state, no operator indicators (`filterOperatorIndicator`,
 * a picker has no menus), no settings button (`settingsButton`), and the header filters of its text columns search
 * anywhere in the text (CONTAINS, when the column offers it). A number column keeps its default, it has
 * no CONTAINS
 */
function dropdownConfig(lookup: RegisteredLookup): GridConfig {
    const given: Partial<GridConfig> = lookup.config ?? {};
    const center: LayoutColumn[] =
        lookup.labelField === lookup.valueField
            ? [{ fields: [lookup.labelField], width: GRID_LABEL_WIDTH }]
            : [
                  { fields: [lookup.valueField], width: GRID_VALUE_WIDTH },
                  { fields: [lookup.labelField], width: GRID_LABEL_WIDTH }
              ];
    const layout = given.layout ?? { center };
    // the GridInterface copies columns and layout, so the lookup's config is not changed
    const columns = { ...given.columns };
    for (const column of [...(layout.left ?? []), ...layout.center, ...(layout.right ?? [])]) {
        for (const field of column.fields) {
            const column = columns[field];
            const offersContains = !column?.filterOperators || column.filterOperators.includes('CONTAINS');
            if (lookup.datasource.getField(field).type === 'text' && offersContains) {
                columns[field] = { operator: 'CONTAINS', ...column };
            }
        }
    }
    return {
        panelHeight: 0,
        footerHeight: 0,
        selectSizeHeight: 0,
        rowStatus: false,
        // no menus in a picker (see the contextmenu below): no operator choice either, and no settings
        filterOperatorIndicator: false,
        settingsButton: false,
        ...given,
        columns,
        layout
    };
}

/**
 * The size of the dropdown grid in px: as wide as its columns, as high as GRID_ROWS rows (fewer when it
 * has fewer, at least GRID_MIN_ROWS), with its header, scrollbars and border. Read from its config once
 * it is parsed - the width of the row numbers depends on the font
 */
function dropdownSize(gridInterface: GridInterface<any>) {
    const config = gridInterface.__getGridConfig();
    const centerWidth = config.layout.center.reduce((sum, column) => sum + (column.width || 100), 0);
    // the border of the grid element, 1px on each side
    const border = 2;
    const width =
        config.__selectSizeWidth + config.__leftWidth + centerWidth + config.__rightWidth + config.__scrollbarSize + border;

    // as updateMainElementSizes: the labels and the filters, or one of them
    let headerHeight = config.__rowHeaderHeight;
    if (config.hideLabels && !config.hideFilter) {
        headerHeight = config.__rowHeight;
    } else if (!config.hideLabels && config.hideFilter) {
        headerHeight = config.__columnCells * config.cellHeaderLabelHeight;
    } else if (config.hideLabels && config.hideFilter) {
        headerHeight = 0;
    }
    const rows = Math.max(GRID_MIN_ROWS, Math.min(GRID_ROWS, gridInterface.getDatasource().getRows().length));
    const height =
        config.panelHeight +
        headerHeight +
        config.selectSizeHeight +
        rows * config.__rowHeight +
        config.__scrollbarSize +
        config.footerHeight +
        border;
    return { width, height };
}

/**
 * The header filter of a field in a grid element: its input, by where the field is in the layout. The
 * first filter when the field is not in it, null without filters
 */
function filterInputOf(gridElement: HTMLElement, gridInterface: GridInterface<any>, field: string): HTMLInputElement | null {
    const { layout } = gridInterface.__getGridConfig();
    const sections = [
        ['left-pinned', layout.left],
        ['middle-pinned', layout.center],
        ['right-pinned', layout.right]
    ] as const;
    for (const [colType, columns] of sections) {
        for (const [column, { fields }] of columns.entries()) {
            const cell = fields.indexOf(field);
            if (cell !== -1) {
                const input = gridElement.querySelector(`input.filter-cellpos-${colType}-0-${column}-${cell}`);
                if (input instanceof HTMLInputElement) {
                    return input;
                }
            }
        }
    }
    return gridElement.querySelector('input.simple-html-grid-cell-filter-input');
}
