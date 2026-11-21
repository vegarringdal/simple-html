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

    const dimRepeated = gridInterface.__getGridConfig().dimRepeatedValues === true;

    const text = (id: TextId) => gridText(ctx, id);

    return [
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
        { type: 'section', id: 'row.paste', label: text('row.paste'), visible: pasteAndClear },
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
        { type: 'section', id: 'row.clear', label: text('row.clear'), visible: pasteAndClear },
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
        ...deleteEntries(ctx),
        ...summaryEntries(ctx, attribute)
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
 * The summary of a number column over the selected rows: count, sum, max, min and average. Clicking
 * one copies its value. Only shown for a number field, the values are only computed for one
 */
function summaryEntries(ctx: Grid, attribute: string): MenuEntry[] {
    const datasource = ctx.gridInterface.getDatasource();
    const { type, formatter } = datasource.getField(attribute);
    const isNumber = () => type === 'number';

    const summary = { count: 0, sum: '', max: '', min: '', avg: '' };
    if (type === 'number') {
        const add = (prev: number, cur: unknown) => {
            let x = parseFloat(String(cur));
            if (Number.isNaN(x)) {
                x = 0;
            }
            return parseFloat((prev + x).toFixed(5));
        };

        const selectedRows = datasource.getSelection().getSelectedRows();
        const allrows = datasource.getRows();

        let curValue = 0;
        let maxValue = 0;
        let minValue: number | null = null;
        selectedRows.forEach((index: number) => {
            const x = allrows[index];
            // a group row has no value of the field, x[attribute] is undefined
            const value = x && !isGroupRow(x) ? x[attribute] : undefined;
            if (value) {
                curValue = add(curValue, value);
                maxValue = value > maxValue ? value : maxValue;
                minValue = minValue === null || value < minValue ? value : minValue;
            }
        });

        // null * 100 is 0
        summary.count = selectedRows.length;
        summary.sum = formatter.format(Math.round(curValue * 100) / 100);
        summary.max = formatter.format(Math.round(maxValue * 100) / 100);
        summary.min = formatter.format(Math.round((minValue ?? 0) * 100) / 100);
        summary.avg = formatter.format(Math.round(Math.round(curValue / selectedRows.length) * 100) / 100);
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
 * Copies to the clipboard: tab separated text, plus an html table when more than one row is copied
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
    document.addEventListener('copy', listener);
    document.execCommand('copy');
    document.removeEventListener('copy', listener);
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
