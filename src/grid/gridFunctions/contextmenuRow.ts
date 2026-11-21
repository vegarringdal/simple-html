import { type Entity, isGroupRow } from '../../datasource/entity';
import { and, type FilterExpression, type FilterGroup, isFilterGroup, where } from '../../datasource/filterExpression';
import type { TextId } from '../../texts';
import type { Grid } from '../grid';
import type { MenuContext, MenuEntry, MenuSubmenu } from '../gridMenus';
import type { ColType } from './colType';
import { isLockedByHook, rowsToMark, rowsToUnmark } from './deleteRows';
import { getLayoutFields } from './getLayoutFields';
import { cellText } from './gridCsv';
import { gridText } from './gridText';
import type { HTMLCellElement } from './HTMLCellElement';
import { keyText } from './keyText';
import { writeCellValue } from './lookupColumn';
import { clearRangeCells, pasteText, rangesClipboard, rowsClipboard, writeClipboard } from './rangeClipboard';
import { rebuildHeaderColumns } from './rebuildHeaderColumns';
import { placeUnderCell, showMenu } from './showMenu';
import { triggerScrollEvent } from './triggerScrollEvent';
import { undoRedoInGrid } from './undoRedoKey';

/**
 * Opens the row menu, the right click menu of a cell: the default entries (see MENU_IDS.row), changed
 * by the `menus.row` hook.
 */
export function contextmenuRow(
    ctx: Grid,
    event: MouseEvent,
    cell: HTMLCellElement,
    row: number,
    column: number,
    celno: number,
    colType: ColType,
    cellType: string,
    attribute: string,
    rowData: Entity
) {
    const context: MenuContext = {
        menu: 'row',
        field: attribute,
        row: rowData,
        rowIndex: row,
        cell,
        gridInterface: ctx.gridInterface,
        datasource: ctx.gridInterface.getDatasource()
    };

    const defaults = rowMenuEntries(ctx, cell, row, column, celno, colType, cellType, attribute, rowData);
    const entries = ctx.gridInterface.__getHooks().menus?.row?.(defaults, context) ?? defaults;

    showMenu(ctx, entries, context, placeUnderCell(event, cell));
}

/**
 * The right clicked cell, what the events of the row menu send (copy-cell, paste, clear ...)
 */
interface RowMenuEventData {
    cell: HTMLCellElement;
    row: number;
    column: number;
    celno: number;
    colType: ColType;
    cellType: string;
    attribute: string;
    rowData: Entity;
}

/**
 * The row menu's default entries, new objects every call: the edit entries, then a submenu per part.
 * The ids are documented in MENU_IDS.row
 */
function rowMenuEntries(
    ctx: Grid,
    cell: HTMLCellElement,
    row: number,
    column: number,
    celno: number,
    colType: ColType,
    cellType: string,
    attribute: string,
    rowData: Entity
): MenuEntry[] {
    const gridInterface = ctx.gridInterface;

    // what the cell events send
    const eventData: RowMenuEventData = { cell, row, column, celno, colType, cellType, attribute, rowData };

    // paste and clear: in an editable grid. The entries that work on a selection - the selected rows, the
    // ranges of cells - are always listed and greyed out while there is none, so the menu does not change
    // its shape; the clicked cell's greyed out when it is readonly. The selected rows and the cells of the
    // ranges are checked one by one when pasting / clearing
    const editable = () => !gridInterface.__getGridConfig().readonly;
    const cellReadonly = () => gridInterface.__isCellReadonly(rowData, attribute);
    const noSelectedRows = () => gridInterface.getDatasource().getSelectedRows().length === 0;
    const noRanges = () => gridInterface.getRanges().length === 0;

    // a group row has no value of its own to filter on
    const filterOnValue = () => !isGroupRow(rowData);

    const dimRepeated = gridInterface.__getGridConfig().dimRepeatedValues === true;
    const changedOnly = gridInterface.getDatasource().isChangedOnly();

    const text = (id: TextId) => gridText(ctx, id);

    return [
        // first: in an editable grid, taking an edit back is what the menu is opened for most
        editSubmenu(ctx, attribute, rowData),
        { type: 'submenu', id: 'row.copy', label: text('row.copy'), entries: copyEntries(ctx, eventData) },
        {
            type: 'submenu',
            id: 'row.paste',
            label: text('row.paste'),
            visible: editable,
            entries: [
                {
                    id: 'row.paste.current',
                    label: text('row.paste.current'),
                    disabled: cellReadonly,
                    action: async () => {
                        if (navigator.clipboard.readText) {
                            const data = await navigator.clipboard.readText();
                            pasteIntoCells(ctx, attribute, data, eventData, [rowData]);
                        }
                    }
                },
                {
                    id: 'row.paste.cell',
                    label: text('row.paste.cell'),
                    hint: text('row.paste.cell.hint'),
                    disabled: noSelectedRows,
                    action: async () => {
                        if (navigator.clipboard.readText) {
                            const data = await navigator.clipboard.readText();
                            pasteIntoCells(ctx, attribute, data, eventData, gridInterface.getDatasource().getSelectedRows());
                        }
                    }
                },
                {
                    id: 'row.paste.range',
                    label: text('row.paste.range'),
                    disabled: noRanges,
                    // as Ctrl+V with ranges: one value into every cell of them, a block from the top left
                    // of the last one (rangeClipboard.ts)
                    action: async () => {
                        if (navigator.clipboard.readText) {
                            pasteText(ctx, await navigator.clipboard.readText());
                        }
                    }
                }
            ]
        },
        {
            type: 'submenu',
            id: 'row.clear',
            label: text('row.clear'),
            visible: editable,
            entries: [
                {
                    id: 'row.clear.current',
                    label: text('row.clear.current'),
                    disabled: cellReadonly,
                    action: () => {
                        clearRows(ctx, attribute, [rowData]);
                        gridInterface.__callSubscribers('clear', eventData);
                        triggerScrollEvent(ctx);
                    }
                },
                {
                    id: 'row.clear.cell',
                    label: text('row.clear.cell'),
                    hint: text('row.clear.cell.hint'),
                    disabled: noSelectedRows,
                    action: () => {
                        clearRows(ctx, attribute, gridInterface.getDatasource().getSelectedRows());
                        gridInterface.__callSubscribers('clear', eventData);
                        triggerScrollEvent(ctx);
                    }
                },
                {
                    id: 'row.clear.range',
                    label: text('row.clear.range'),
                    disabled: noRanges,
                    // as Delete with ranges: every cell of them
                    action: () => clearRangeCells(ctx)
                }
            ]
        },
        deleteSubmenu(ctx, rowData),
        {
            type: 'submenu',
            id: 'row.filter',
            label: text('row.filter'),
            visible: filterOnValue,
            entries: [
                {
                    id: 'row.filter.replace',
                    label: text('row.filter.replace'),
                    hint: text('row.filter.replace.hint'),
                    visible: filterOnValue,
                    action: () => replaceFilter(ctx, attribute, rowData)
                },
                {
                    id: 'row.filter.add',
                    label: text('row.filter.add'),
                    hint: text('row.filter.add.hint'),
                    visible: filterOnValue,
                    action: () => addToFilter(ctx, attribute, rowData)
                }
            ]
        },
        {
            type: 'submenu',
            id: 'row.view',
            label: text('row.view'),
            entries: [
                {
                    id: 'row.view.dimRepeatedValues',
                    label: text('row.view.dimRepeatedValues'),
                    // a toggle: a check mark while it is on
                    selected: () => dimRepeated,
                    action: () => {
                        // an option: set it as updateConfig() does, or the next updateConfig() would undo it
                        gridInterface.updateConfig({ dimRepeatedValues: !dimRepeated });
                    }
                },
                {
                    id: 'row.view.changedOnly',
                    label: text('row.view.changedOnly'),
                    selected: () => changedOnly,
                    // the new, edited and deleted rows, with the filter there is. The datasource filters,
                    // the grid follows its event
                    action: () => gridInterface.getDatasource().filterChangedOnly(!changedOnly)
                }
            ]
        },
        sizeSubmenu(ctx, attribute, rowData),
        exportSubmenu(ctx)
    ];
}

/**
 * The copy submenu's entries: the cell, the column or the row of the selected rows, the ranges of
 * cells
 * @param eventData the right clicked cell, what the copy events send
 */
function copyEntries(ctx: Grid, eventData: RowMenuEventData): MenuEntry[] {
    const gridInterface = ctx.gridInterface;
    const { attribute, rowData } = eventData;
    const hasRanges = () => gridInterface.getRanges().length > 0;
    // the entries of the selected rows are listed without them too, greyed out
    const noSelectedRows = () => gridInterface.getDatasource().getSelectedRows().length === 0;
    const text = (id: TextId) => gridText(ctx, id);
    return [
        {
            id: 'row.copy.cell',
            label: text('row.copy.cell'),
            action: () => {
                // the value only, as the cell shows it: no header, no line end
                writeClipboard(cellText(gridInterface, attribute, true)(rowData), '');
                gridInterface.__callSubscribers('copy-cell', eventData);
            }
        },
        {
            id: 'row.copy.column',
            label: text('row.copy.column'),
            hint: text('row.copy.column.hint'),
            disabled: noSelectedRows,
            action: () => {
                copyRows(ctx, [attribute]);
                gridInterface.__callSubscribers('copy-column', eventData);
            }
        },
        {
            id: 'row.copy.row',
            label: text('row.copy.row'),
            hint: text('row.copy.row.hint'),
            disabled: noSelectedRows,
            action: () => {
                copyRows(ctx, getLayoutFields(gridInterface));
                gridInterface.__callSubscribers('copy-row', eventData);
            }
        },
        {
            id: 'row.copy.selectedColumns',
            label: text('row.copy.selectedColumns'),
            hint: text('row.copy.selectedColumns.hint'),
            disabled: noSelectedRows,
            action: () => {
                // no column selected: every column
                const selected = getLayoutFields(gridInterface, { selectedOnly: true });
                copyRows(ctx, selected.length ? selected : getLayoutFields(gridInterface));
                gridInterface.__callSubscribers('copy-row-col', eventData);
            }
        },
        {
            id: 'row.copy.range',
            label: text('row.copy.range'),
            disabled: () => !hasRanges(),
            // every range as one table, as Ctrl+C copies them (rangeClipboard.ts)
            action: () => {
                const { text: tsv, html } = rangesClipboard(ctx, gridInterface.getRanges());
                writeClipboard(tsv, html);
            }
        }
    ];
}

/**
 * The Undo submenu: the undo history of the datasource (undo, redo), and putting the original values
 * back - of the clicked cell, the clicked row (no selection needed: a click in a cell does not select
 * its row), or the selected rows. Only in an editable grid, first in the menu.
 *
 * A revert puts values back, so like the delete's undo it is not stopped by readonly cells or rows:
 * readonly is about typing new values. The values are set from code, the grid renders the cells again
 * after - undo and redo send history-changed, the grid follows that
 */
function editSubmenu(ctx: Grid, attribute: string, rowData: Entity): MenuSubmenu {
    const gridInterface = ctx.gridInterface;
    const datasource = gridInterface.getDatasource();
    const editable = () => !gridInterface.__getGridConfig().readonly;

    // the selected rows a revert changes: edited, or marked for deletion
    const toRevert = () =>
        datasource.getSelectedRows().filter((row) => row.__controller?.__edited || row.__controller?.__isDeleted);

    return {
        type: 'submenu',
        id: 'row.edit',
        label: gridText(ctx, 'row.edit'),
        visible: editable,
        entries: [
            {
                id: 'row.edit.undo',
                label: gridText(ctx, 'row.edit.undo'),
                // ⌘Z on a Mac
                hint: keyText(ctx, 'row.edit.undo.hint'),
                visible: editable,
                disabled: () => !datasource.canUndo(),
                // the focus goes to what it changed, as Ctrl+Z
                action: () => undoRedoInGrid(ctx, 'undo', attribute)
            },
            {
                id: 'row.edit.redo',
                label: gridText(ctx, 'row.edit.redo'),
                hint: keyText(ctx, 'row.edit.redo.hint'),
                visible: editable,
                disabled: () => !datasource.canRedo(),
                action: () => undoRedoInGrid(ctx, 'redo', attribute)
            },
            {
                id: 'row.edit.revertCell',
                label: gridText(ctx, 'row.edit.revertCell'),
                visible: editable,
                disabled: () => !rowData.__controller?.__editedProps[attribute],
                action: () => {
                    datasource.resetField(rowData, attribute);
                    triggerScrollEvent(ctx);
                }
            },
            {
                id: 'row.edit.revertRow',
                label: gridText(ctx, 'row.edit.revertRow'),
                visible: editable,
                disabled: () => !rowData.__controller?.__edited && !rowData.__controller?.__isDeleted,
                action: () => {
                    datasource.resetRows(rowData);
                    triggerScrollEvent(ctx);
                }
            },
            {
                id: 'row.edit.revertRows',
                label: gridText(ctx, 'row.edit.revertRows'),
                hint: gridText(ctx, 'row.edit.revertRows.hint'),
                visible: editable,
                disabled: () => toRevert().length === 0,
                action: () => {
                    datasource.resetRows(toRevert());
                    triggerScrollEvent(ctx);
                }
            }
        ]
    };
}

/**
 * Delete and undo: the row right clicked, or the selected rows, are marked for deletion, and the
 * selected rows unmarked - so a delete can be undone, the rows stay in the grid until the changes are
 * accepted. Only in an editable grid. Every entry is listed, greyed out when there is nothing to do
 * (nothing selected, the row marked already): the menu keeps its shape.
 *
 * Delete skips a row the isReadonly hook locks (see isLockedByHook). Undo works on every selected
 * row that is marked: a hook that makes the deleted rows readonly must not stop the undo. The row
 * right clicked is unmarked by the Undo / Redo submenu's "Undo row edits" too
 */
function deleteSubmenu(ctx: Grid, rowData: Entity): MenuSubmenu {
    const gridInterface = ctx.gridInterface;
    const datasource = gridInterface.getDatasource();
    const editable = () => !gridInterface.__getGridConfig().readonly;

    const toMark = () => rowsToMark(gridInterface);
    const toUnmark = () => rowsToUnmark(gridInterface);

    return {
        type: 'submenu',
        id: 'row.delete',
        label: gridText(ctx, 'row.delete'),
        visible: editable,
        entries: [
            {
                id: 'row.delete.row',
                label: gridText(ctx, 'row.delete.row'),
                visible: editable,
                disabled: () => rowData.__rowState === 'D' || isLockedByHook(gridInterface, rowData),
                action: () => datasource.markForDeletion(rowData)
            },
            {
                id: 'row.delete.rows',
                label: gridText(ctx, 'row.delete.rows'),
                hint: gridText(ctx, 'row.delete.rows.hint'),
                visible: editable,
                // nothing selected, or every selected row marked or locked
                disabled: () => toMark().length === 0,
                action: () => datasource.markForDeletion(toMark())
            },
            {
                id: 'row.delete.undo',
                label: gridText(ctx, 'row.delete.undo'),
                hint: gridText(ctx, 'row.delete.undo.hint'),
                visible: editable,
                disabled: () => toUnmark().length === 0,
                action: () => datasource.unmarkForDeletion(toUnmark())
            }
        ]
    };
}

/**
 * The sizes, like Excel's AutoFit: the column as wide as the right clicked cell's text, rows as high as
 * their multiline cells need (gridInterface.fitRows), and back to the height of the layout. In every
 * grid, readonly ones too: a size changes no data
 */
function sizeSubmenu(ctx: Grid, attribute: string, rowData: Entity): MenuSubmenu {
    const gridInterface = ctx.gridInterface;
    return {
        type: 'submenu',
        id: 'row.size',
        label: gridText(ctx, 'row.size'),
        entries: [
            {
                id: 'row.size.fitColumn',
                label: gridText(ctx, 'row.size.fitColumn'),
                action: () => gridInterface.fitColumns([attribute], { rows: [rowData] })
            },
            {
                id: 'row.size.fitRow',
                label: gridText(ctx, 'row.size.fitRow'),
                action: () => gridInterface.fitRows(rowData)
            },
            {
                id: 'row.size.fitRows',
                label: gridText(ctx, 'row.size.fitRows'),
                hint: gridText(ctx, 'row.size.fitRows.hint'),
                disabled: () => selectedAndRangeRows(ctx).length === 0,
                action: () => gridInterface.fitRows(selectedAndRangeRows(ctx))
            },
            {
                id: 'row.size.fitAllRows',
                label: gridText(ctx, 'row.size.fitAllRows'),
                action: () => gridInterface.fitRows()
            },
            {
                id: 'row.size.resetRow',
                label: gridText(ctx, 'row.size.resetRow'),
                disabled: () => !gridInterface.__hasRowHeight(rowData),
                action: () => gridInterface.resetRowHeights(rowData)
            },
            {
                id: 'row.size.resetAllRows',
                label: gridText(ctx, 'row.size.resetAllRows'),
                disabled: () => !gridInterface.__hasRowHeight(),
                action: () => gridInterface.resetRowHeights()
            }
        ]
    };
}

/**
 * The selected rows and the data rows of the ranges of cells, each once: what "Fit row height
 * (selected rows)" fits
 */
function selectedAndRangeRows(ctx: Grid): Entity[] {
    const datasource = ctx.gridInterface.getDatasource();
    const rows = new Set<Entity>(datasource.getSelectedRows());
    for (const range of ctx.gridInterface.getRanges()) {
        for (let i = Math.min(range.fromRow, range.toRow); i <= Math.max(range.fromRow, range.toRow); i++) {
            const row = datasource.getRow(i);
            if (row && !isGroupRow(row)) {
                rows.add(row);
            }
        }
    }
    return Array.from(rows);
}

/**
 * Export as an Excel file (gridInterface.downloadExcel): every row the filter lets through, or the
 * selected ones - the columns of the layout, typed values, see guides/15-export.md. In every grid,
 * readonly ones too: an export changes nothing. The CSV export is in the API (downloadCsv), not here
 */
function exportSubmenu(ctx: Grid): MenuSubmenu {
    const gridInterface = ctx.gridInterface;
    return {
        type: 'submenu',
        id: 'row.export',
        label: gridText(ctx, 'row.export'),
        entries: [
            {
                id: 'row.export.excel',
                label: gridText(ctx, 'row.export.excel'),
                action: () => gridInterface.downloadExcel()
            },
            {
                id: 'row.export.excelSelected',
                label: gridText(ctx, 'row.export.excelSelected'),
                disabled: () => gridInterface.getDatasource().getSelectedRows().length === 0,
                action: () => gridInterface.downloadExcel('export.xlsx', { rows: 'selected' })
            }
        ]
    };
}

/**
 * The selected rows, in these fields, onto the clipboard as a table: tab separated text and html, with
 * a header line of the labels (`copyHeaders`) - see rangeClipboard.ts. The row menu's Column / Row
 * copies
 */
function copyRows(ctx: Grid, fields: string[]) {
    const { text, html } = rowsClipboard(ctx, ctx.gridInterface.getDatasource().getSelectedRows(), fields);
    writeClipboard(text, html);
}

/**
 * empties the column of the rows given - the one right clicked, or the selected rows - each row checked on
 * its own: a cell can be readonly in one row and not in another
 */
function clearRows(ctx: Grid, attribute: string, rows: Entity[]) {
    if (ctx.gridInterface.__getGridConfig().readonly) {
        return;
    }

    rows.forEach((entity) => {
        if (!ctx.gridInterface.__isCellReadonly(entity, attribute)) {
            // a lookup column empties the fields of its `set` too
            writeCellValue(ctx.gridInterface, entity, attribute, null);
        }
    });
}

/**
 * pastes the text into the column of every row given that is editable, a `paste` event per row
 * @param eventData the right clicked cell, what the paste event sends
 * @param rows the right clicked row, or the selected rows
 */
function pasteIntoCells(ctx: Grid, attribute: string, data: string, eventData: RowMenuEventData, rows: Entity[]) {
    const datasource = ctx.gridInterface.getDatasource();
    // a lookup column (ColumnConfig.editor) takes a label, copied from it, as the value of its row
    const formatter = ctx.gridInterface.__getLookupColumn(attribute)?.formatter ?? datasource.getFormatter(attribute);

    if (ctx.gridInterface.__getGridConfig().readonly) {
        return;
    }

    rows.forEach((entity) => {
        if (ctx.gridInterface.__isCellReadonly(entity, attribute)) {
            return;
        }

        writeCellValue(ctx.gridInterface, entity, attribute, formatter.parse(data));

        const { cell, row, column, celno, colType, cellType } = eventData;
        ctx.gridInterface.__callSubscribers('paste', { cell, row, column, celno, colType, cellType, attribute, entity });
    });

    triggerScrollEvent(ctx);
}

/**
 * The condition the row menu filters on: the cell's value, IS_BLANK for an empty cell (EQUAL '' would
 * match nothing useful)
 */
function conditionForCell(attribute: string, rowData: Entity) {
    const value = rowData?.[attribute];
    const isBlank = value === null || value === undefined || value === '';
    return isBlank ? where(attribute, 'IS_BLANK') : where(attribute, 'EQUAL', value);
}

function applyFilter(ctx: Grid, filter: FilterGroup, clearHeaderFilters: boolean) {
    ctx.gridInterface.getDatasource().filter(filter);
    if (clearHeaderFilters) {
        // the header filter conditions are gone, so their inputs must not keep showing the old text
        ctx.gridInterface.__clearHeaderFilterValues();
    }
    rebuildHeaderColumns(ctx);
}

/**
 * Filter on the value of the right clicked cell, throwing away whatever filter is there
 */
function replaceFilter(ctx: Grid, attribute: string, rowData: Entity) {
    applyFilter(ctx, and(conditionForCell(attribute, rowData)), true);
}

/**
 * Filter on the value of the right clicked cell, keeping the existing filter: the condition goes in
 * front of it, joined with AND
 */
function addToFilter(ctx: Grid, attribute: string, rowData: Entity) {
    const current = ctx.gridInterface.getDatasource().getFilter();
    let existing: FilterExpression[] = [];
    if (current && isFilterGroup(current) && current.group !== 'OR') {
        // an AND root (anything but OR is AND, as the filter runs it): its children go in the new AND
        existing = current.children;
    } else if (current) {
        // an OR root is kept whole - spreading its conditions into the AND would turn "a OR b"
        // into "a AND b". So is a single condition at the root
        existing = [current];
    }

    // the existing conditions are kept, header filters included, so the header inputs
    // keep their text
    applyFilter(ctx, and(conditionForCell(attribute, rowData), ...existing), false);
}
