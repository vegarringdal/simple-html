import { DateFormatterYYYYMMDD } from '../../datasource/DateFormatterYYYYMMDD';
import { DateFormatterYYYYMMDDTHHMMSS } from '../../datasource/DateFormatterYYYYMMDDTHHMMSS';
import { type Entity, type GroupRow, isGroupRow } from '../../datasource/entity';
import { and, type FilterExpression, type FilterGroup, isFilterGroup, where } from '../../datasource/filterExpression';
import type { TextId } from '../../texts';
import type { Grid } from '../grid';
import type { MenuContext, MenuEntry } from '../gridMenus';
import type { ColType } from './colType';
import { getCellType } from './getCellType';
import { getColumnLabel } from './getColumnLabel';
import { getLayoutFields } from './getLayoutFields';
import { gridText } from './gridText';
import type { HTMLCellElement } from './HTMLCellElement';
import { clearRangeCells, pasteText, rangeClipboardText, writeClipboard } from './rangeClipboard';
import { rebuildHeaderColumns } from './rebuildHeaderColumns';
import { placeUnderCell, showMenu } from './showMenu';
import { triggerScrollEvent } from './triggerScrollEvent';

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
 * The row menu's default entries, new objects every call. The ids are documented in MENU_IDS.row
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
    const eventData = { cell, row, column, celno, colType, cellType, attribute, rowData };

    // paste and clear: an editable grid, and the clicked cell editable. The other selected rows are
    // checked one by one when pasting/clearing
    const pasteAndClear = () => !gridInterface.__getGridConfig().readonly && !gridInterface.__isCellReadonly(rowData, attribute);

    // a group row has no value of its own to filter on
    const filterOnValue = () => !isGroupRow(rowData);

    // the entries of the ranges of cells: when there are ranges. Paste and clear in an editable grid,
    // the cells of the ranges are checked one by one
    const hasRanges = () => gridInterface.getRanges().length > 0;
    const pasteAndClearRanges = () => !gridInterface.__getGridConfig().readonly && hasRanges();

    const dimRepeated = gridInterface.__getGridConfig().dimRepeatedValues === true;
    const changedOnly = gridInterface.getDatasource().isChangedOnly();

    const text = (id: TextId) => gridText(ctx, id);

    return [
        // first: in an editable grid, taking an edit back is what the menu is opened for most
        ...editEntries(ctx, attribute, rowData),
        { type: 'section', id: 'row.copy', label: text('row.copy') },
        {
            id: 'row.copy.cell',
            label: text('row.copy.cell'),
            action: () => {
                copyData(ctx, [attribute], true, rowData);
                gridInterface.__callSubscribers('copy-cell', eventData);
            }
        },
        {
            id: 'row.copy.column',
            label: text('row.copy.column'),
            hint: text('row.copy.column.hint'),
            action: () => {
                copyData(ctx, [attribute], false);
                gridInterface.__callSubscribers('copy-column', eventData);
            }
        },
        {
            id: 'row.copy.row',
            label: text('row.copy.row'),
            hint: text('row.copy.row.hint'),
            action: () => {
                copyData(ctx, getLayoutFields(gridInterface), false);
                gridInterface.__callSubscribers('copy-row', eventData);
            }
        },
        {
            id: 'row.copy.selectedColumns',
            label: text('row.copy.selectedColumns'),
            hint: text('row.copy.selectedColumns.hint'),
            action: () => {
                // no column selected: every column
                const selected = getLayoutFields(gridInterface, { selectedOnly: true });
                copyData(ctx, selected.length ? selected : getLayoutFields(gridInterface), false);
                gridInterface.__callSubscribers('copy-row-col', eventData);
            }
        },
        {
            id: 'row.copy.range',
            label: text('row.copy.range'),
            visible: hasRanges,
            // the last range, as Ctrl+C copies it (rangeClipboard.ts)
            action: () => {
                const ranges = gridInterface.getRanges();
                const { text: tsv, html } = rangeClipboardText(ctx, ranges[ranges.length - 1]);
                writeClipboard(tsv, html);
            }
        },
        { type: 'section', id: 'row.filter', label: text('row.filter'), visible: filterOnValue },
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
        },
        { type: 'section', id: 'row.view', label: text('row.view') },
        {
            id: 'row.view.dimRepeatedValues',
            // the check mark shows it is on
            label: `${dimRepeated ? '✓ ' : ''}${text('row.view.dimRepeatedValues')}`,
            action: () => {
                // an option: set it as updateConfig() does, or the next updateConfig() would undo it
                gridInterface.updateConfig({ dimRepeatedValues: !dimRepeated });
            }
        },
        {
            id: 'row.view.changedOnly',
            // the check mark shows it is on
            label: `${changedOnly ? '✓ ' : ''}${text('row.view.changedOnly')}`,
            // the new, edited and deleted rows, with the filter there is. The datasource filters,
            // the grid follows its event
            action: () => gridInterface.getDatasource().filterChangedOnly(!changedOnly)
        },
        { type: 'section', id: 'row.paste', label: text('row.paste'), visible: () => pasteAndClear() || pasteAndClearRanges() },
        {
            id: 'row.paste.cell',
            label: text('row.paste.cell'),
            hint: text('row.paste.cell.hint'),
            visible: pasteAndClear,
            action: async () => {
                if (navigator.clipboard.readText) {
                    const data = await navigator.clipboard.readText();
                    pasteIntoCells(ctx, attribute, data, eventData);
                }
            }
        },
        {
            id: 'row.paste.range',
            label: text('row.paste.range'),
            visible: pasteAndClearRanges,
            // as Ctrl+V with ranges: one value into every cell of them, a block from the top left of
            // the last one (rangeClipboard.ts)
            action: async () => {
                if (navigator.clipboard.readText) {
                    pasteText(ctx, await navigator.clipboard.readText());
                }
            }
        },
        { type: 'section', id: 'row.clear', label: text('row.clear'), visible: () => pasteAndClear() || pasteAndClearRanges() },
        {
            id: 'row.clear.cell',
            label: text('row.clear.cell'),
            hint: text('row.clear.cell.hint'),
            visible: pasteAndClear,
            action: () => {
                clearRows(ctx, attribute);
                gridInterface.__callSubscribers('clear', eventData);
                triggerScrollEvent(ctx);
            }
        },
        {
            id: 'row.clear.range',
            label: text('row.clear.range'),
            visible: pasteAndClearRanges,
            // as Delete with ranges: every cell of them
            action: () => clearRangeCells(ctx)
        },
        ...deleteEntries(ctx),
        ...summaryEntries(ctx, attribute),
        ...exportEntries(ctx)
    ];
}

/**
 * Undo, redo and revert: the undo history of the datasource, and putting the original values back -
 * of the clicked cell, the clicked row (no selection needed: a click in a cell does not select its
 * row), or the selected rows. Only in an editable grid, at the top of the menu.
 *
 * A revert puts values back, so like the delete's undo it is not stopped by readonly cells or rows:
 * readonly is about typing new values. The values are set from code, the grid renders the cells again
 * after - undo and redo send history-changed, the grid follows that
 */
function editEntries(ctx: Grid, attribute: string, rowData: Entity): MenuEntry[] {
    const gridInterface = ctx.gridInterface;
    const datasource = gridInterface.getDatasource();
    const editable = () => !gridInterface.__getGridConfig().readonly;

    // the selected rows a revert changes: edited, or marked for deletion
    const toRevert = () =>
        datasource.getSelectedRows().filter((row) => row.__controller?.__edited || row.__controller?.__isDeleted);

    return [
        { type: 'section', id: 'row.edit', label: gridText(ctx, 'row.edit'), visible: editable },
        {
            id: 'row.edit.undo',
            label: gridText(ctx, 'row.edit.undo'),
            hint: gridText(ctx, 'row.edit.undo.hint'),
            visible: editable,
            disabled: () => !datasource.canUndo(),
            action: () => datasource.undo()
        },
        {
            id: 'row.edit.redo',
            label: gridText(ctx, 'row.edit.redo'),
            hint: gridText(ctx, 'row.edit.redo.hint'),
            visible: editable,
            disabled: () => !datasource.canRedo(),
            action: () => datasource.redo()
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
    ];
}

/**
 * Delete and undo, on the selected rows: they are marked for deletion, and unmarked - so a delete can
 * be undone, the rows stay in the grid until the changes are accepted. Only in an editable grid.
 *
 * Delete skips a row the isReadonly hook locks (see isLockedByHook). Undo works on every selected
 * row that is marked: a hook that makes the deleted rows readonly must not stop the undo
 */
function deleteEntries(ctx: Grid): MenuEntry[] {
    const gridInterface = ctx.gridInterface;
    const datasource = gridInterface.getDatasource();
    const editable = () => !gridInterface.__getGridConfig().readonly;

    const toMark = () =>
        datasource.getSelectedRows().filter((row) => row.__rowState !== 'D' && !isLockedByHook(gridInterface, row));
    const toUnmark = () => datasource.getSelectedRows().filter((row) => row.__rowState === 'D');

    return [
        { type: 'section', id: 'row.delete', label: gridText(ctx, 'row.delete'), visible: editable },
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
            visible: () => editable() && toUnmark().length > 0,
            action: () => datasource.unmarkForDeletion(toUnmark())
        }
    ];
}

/**
 * true when the isReadonly hook returns true for every field in the layout: the row is locked, the row
 * menu does not delete it. Only the hook counts - the columns' readonly option does not lock a row,
 * so a grid of readonly columns can still delete rows. Without the hook no row is locked
 */
function isLockedByHook(gridInterface: Grid['gridInterface'], row: Entity): boolean {
    const hooks = gridInterface.__getHooks();
    const columns = gridInterface.__getGridConfig().columns;
    const fields = getLayoutFields(gridInterface);
    return (
        hooks.isReadonly !== undefined &&
        fields.length > 0 &&
        fields.every((field) => hooks.isReadonly?.(row, field, columns[field]?.readonly ?? false) === true)
    );
}

/**
 * Export as a CSV file (gridInterface.downloadCsv): every row the filter lets through, or the selected
 * ones - the columns and values as the grid shows them, see guides/15-export.md. In every grid,
 * readonly ones too: an export changes nothing
 */
function exportEntries(ctx: Grid): MenuEntry[] {
    const gridInterface = ctx.gridInterface;
    return [
        { type: 'section', id: 'row.export', label: gridText(ctx, 'row.export') },
        {
            id: 'row.export.csv',
            label: gridText(ctx, 'row.export.csv'),
            action: () => gridInterface.downloadCsv()
        },
        {
            id: 'row.export.csvSelected',
            label: gridText(ctx, 'row.export.csvSelected'),
            disabled: () => gridInterface.getDatasource().getSelectedRows().length === 0,
            action: () => gridInterface.downloadCsv('export.csv', { rows: 'selected' })
        }
    ];
}

/**
 * The summary of a number column over the selected rows: count, sum, max, min and average. Clicking
 * one copies its value. Only shown for a number field, the values are only computed for one.
 *
 * The values are the datasource's aggregates of the selected rows (`datasource.aggregate()`): the
 * numbers only, a blank is left out - also of the average, and 0 is a value. Shown with two decimals
 * at most. Count is the number of selected rows. (Before v6 the largest of negative numbers was 0, a 0
 * was skipped by min, and the average was rounded to a whole number and counted the blanks.)
 */
function summaryEntries(ctx: Grid, attribute: string): MenuEntry[] {
    const datasource = ctx.gridInterface.getDatasource();
    const { type, formatter } = datasource.getField(attribute);
    const isNumber = () => type === 'number';

    const summary = { count: 0, sum: '', max: '', min: '', avg: '' };
    if (type === 'number') {
        const selectedRows = datasource.getSelectedRows();
        // two decimals at most; null (min, max and avg of no numbers) is shown blank
        const shown = (value: number | null) => formatter.format(value === null ? null : Math.round(value * 100) / 100);

        summary.count = selectedRows.length;
        summary.sum = shown(datasource.aggregate(attribute, 'sum', selectedRows));
        summary.max = shown(datasource.aggregate(attribute, 'max', selectedRows));
        summary.min = shown(datasource.aggregate(attribute, 'min', selectedRows));
        summary.avg = shown(datasource.aggregate(attribute, 'avg', selectedRows));
    }

    const copy = (text: string) => navigator.clipboard.writeText(text);

    return [
        { type: 'section', id: 'row.summary', label: gridText(ctx, 'row.summary'), visible: isNumber },
        {
            id: 'row.summary.count',
            label: gridText(ctx, 'row.summary.count', { count: summary.count }),
            visible: isNumber,
            action: () => copy(String(summary.count))
        },
        {
            id: 'row.summary.sum',
            label: gridText(ctx, 'row.summary.sum', { sum: summary.sum }),
            visible: isNumber,
            action: () => copy(summary.sum)
        },
        {
            id: 'row.summary.max',
            label: gridText(ctx, 'row.summary.max', { max: summary.max }),
            visible: isNumber,
            action: () => copy(summary.max)
        },
        {
            id: 'row.summary.min',
            label: gridText(ctx, 'row.summary.min', { min: summary.min }),
            visible: isNumber,
            action: () => copy(summary.min)
        },
        {
            id: 'row.summary.avg',
            label: gridText(ctx, 'row.summary.avg', { avg: summary.avg || 0 }),
            visible: isNumber,
            action: () => copy(summary.avg)
        }
    ];
}

/**
 * The selected rows as an html table (for excel) and as tab separated text, or only the current row
 * (`onlyCurrentEntity`): the right clicked one when `overRideCurrentEntity` is given
 */
function generateCopyPasteData(
    ctx: Grid,
    attributes: string[],
    onlyCurrentEntity: boolean,
    overRideCurrentEntity: Entity | null
) {
    const TableOuterTop = `
            <html>
                <body>
                <style>
                   .number {
                        mso-number-format:"General";
                    }
                   .text{
                        mso-number-format:"@";
                    }
                   .date {
                        mso-number-format:"Short Date";
                    }
                    table {
                        border-collapse: collapse;
                        border:.5pt solid windowtext;
                        mso-displayed-decimal-separator:".";
                    }
                    td,
                    th {
                        border-collapse: collapse;
                        padding:3px;
                        border:.5pt solid windowtext;
                    }
                </style>
            <table>`;
    const TableOuterBottom = '</table></body></html>';

    let tableHeader = '<tr>';
    attributes.forEach((attribute) => {
        tableHeader = `${tableHeader}<th>${getColumnLabel(ctx, attribute)}</th>`;
    });
    tableHeader = `${tableHeader}</tr>`;

    let tableInnerData = '';
    let justData = '';

    const datasource = ctx.gridInterface.getDatasource();

    const loopData = (entity: Entity | GroupRow | null) => {
        if (entity && !isGroupRow(entity)) {
            tableInnerData = `${tableInnerData}<tr>`;
            attributes.forEach((attribute, i) => {
                const colData = entity[attribute];
                const dataType = getCellType(ctx, attribute, entity);

                if (i > 0) {
                    justData = `${justData}\t`;
                }

                // dates are copied in a fixed format, whatever the field's formatter shows
                if (dataType === 'date' || dataType === 'datetime') {
                    const formatter = dataType === 'date' ? DateFormatterYYYYMMDD : DateFormatterYYYYMMDDTHHMMSS;
                    const data = formatter.format(colData);
                    justData = justData + data;
                    tableInnerData = `${tableInnerData}<td>${data}</td>`;
                } else if (dataType === 'number') {
                    const data = colData;
                    justData = justData + data;
                    tableInnerData = `${tableInnerData}<td class="number">${data || ''}</td >`;
                } else {
                    //
                    justData = justData + colData;
                    tableInnerData = `${tableInnerData}<td class="text">${colData || ''}</td>`;
                }
            });
            // single entity copy is one line only, so no trailing carriage return
            if (!onlyCurrentEntity && !overRideCurrentEntity) {
                justData = `${justData}\r\n`;
            }

            tableInnerData = `${tableInnerData}</tr>`;
        }
    };

    if (onlyCurrentEntity) {
        if (overRideCurrentEntity) {
            loopData(overRideCurrentEntity);
        } else {
            loopData(datasource.currentEntity);
        }
    } else {
        datasource.getSelectedRows().forEach((entity) => {
            loopData(entity);
        });
    }

    return [TableOuterTop + tableHeader + tableInnerData + TableOuterBottom, justData];
}

/**
 * Copies to the clipboard: tab separated text, plus an html table when more than one row is copied.
 *
 * The listener is on the document in the capture phase: it runs before the grid's own copy listener
 * (rangeClipboard.ts, on the document in the bubble phase), which leaves a copy that is canceled alone.
 * It would else write the cell with the focus over this - or its html next to the plain text of Cell
 * Value
 */
function copyData(ctx: Grid, attributes: string[], onlyCurrentEntity: boolean, overRideCurrentEntity: Entity | null = null) {
    const [html, text] = generateCopyPasteData(ctx, attributes, onlyCurrentEntity, overRideCurrentEntity);

    function listener(e: ClipboardEvent) {
        // we only want text if it is
        if (onlyCurrentEntity) {
            e.clipboardData?.setData('text/plain', text);
        } else {
            e.clipboardData?.setData('text/html', html);
            e.clipboardData?.setData('text/plain', text);
        }

        e.preventDefault();
    }
    document.addEventListener('copy', listener, true);
    document.execCommand('copy');
    document.removeEventListener('copy', listener, true);
}

/**
 * clear and paste work on every selected row, not just the one right clicked, so each row
 * has to be checked on its own
 */
function clearRows(ctx: Grid, attribute: string) {
    if (ctx.gridInterface.__getGridConfig().readonly) {
        return;
    }

    const selectedRows = ctx.gridInterface.getDatasource().getSelectedRows();
    selectedRows.forEach((entity) => {
        if (!ctx.gridInterface.__isCellReadonly(entity, attribute)) {
            entity[attribute] = null;
        }
    });
}

/**
 * pastes the text into the column of every selected row that is editable, a `paste` event per row
 * @param eventData the right clicked cell, what the paste event sends
 */
function pasteIntoCells(
    ctx: Grid,
    attribute: string,
    data: string,
    eventData: { cell: HTMLCellElement; row: number; column: number; celno: number; colType: ColType; cellType: string }
) {
    const datasource = ctx.gridInterface.getDatasource();
    const formatter = datasource.getFormatter(attribute);

    if (ctx.gridInterface.__getGridConfig().readonly) {
        return;
    }

    datasource.getSelectedRows().forEach((entity) => {
        if (ctx.gridInterface.__isCellReadonly(entity, attribute)) {
            return;
        }

        entity[attribute] = formatter.parse(data);

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
