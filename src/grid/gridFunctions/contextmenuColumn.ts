import type { TextId } from '../../texts';
import type { Grid } from '../grid';
import type { MenuContext, MenuEntry } from '../gridMenus';
import { columnFields, columnNumber } from './columnSelection';
import { getLayoutFields } from './getLayoutFields';
import { gridText } from './gridText';
import type { HTMLCellElement } from './HTMLCellElement';
import { columnsClipboard, labelsClipboard, writeClipboard } from './rangeClipboard';
import { placeUnderCell, showMenu } from './showMenu';

/**
 * Opens the column menu, the right click menu of a column number (the row of numbers under the
 * header filters) - also Shift+F10 and the menu key on a number with the focus: the default entries
 * (see MENU_IDS.column), changed by the `menus.column` hook.
 * @param cell the cell of the column number
 */
export function contextmenuColumn(ctx: Grid, event: MouseEvent, cell: HTMLCellElement) {
    const gridInterface = ctx.gridInterface;
    const fields = numberFields(ctx, cell);
    const context: MenuContext = {
        menu: 'column',
        // the column's first field: a column of stacked fields has more
        field: fields[0] ?? '',
        // as the header and filter menus: the first displayed row as it is now
        row: gridInterface.getDatasource().getRow(0),
        rowIndex: 0,
        cell,
        gridInterface,
        datasource: gridInterface.getDatasource()
    };

    const defaults = columnMenuEntries(ctx, fields);
    const entries = gridInterface.__getHooks().menus?.column?.(defaults, context) ?? defaults;

    showMenu(ctx, entries, context, placeUnderCell(event, cell));
}

/**
 * The fields of the column of a column number, top to bottom
 */
function numberFields(ctx: Grid, cell: HTMLCellElement): string[] {
    const config = ctx.gridInterface.__getGridConfig();
    return columnFields(config, [columnNumber(config, cell.$coltype, cell.$column)]);
}

/**
 * The column menu's default entries, new objects every call: the copies of the columns, a line, the
 * copies of their names. Flat, no submenu: every entry is a copy, a Copy › around them would only add
 * a step. The entries of the selected columns are greyed out with none selected, as the row menu's of
 * the selected rows. The ids are documented in MENU_IDS.column
 * @param fields the fields of the column right clicked
 */
function columnMenuEntries(ctx: Grid, fields: string[]): MenuEntry[] {
    const gridInterface = ctx.gridInterface;
    const selectedFields = () => getLayoutFields(gridInterface, { selectedOnly: true });
    const noneSelected = () => gridInterface.getSelectedColumns().length === 0;
    const text = (id: TextId) => gridText(ctx, id);
    const copyColumns = (columnFields: string[]) => {
        const { text: tsv, html } = columnsClipboard(ctx, columnFields);
        writeClipboard(tsv, html);
    };
    // the names are text only: no html table
    const copyNames = (nameFields: string[]) => writeClipboard(labelsClipboard(ctx, nameFields), '');

    return [
        {
            id: 'column.copy.column',
            label: text('column.copy.column'),
            hint: text('column.copy.column.hint'),
            action: () => copyColumns(fields)
        },
        {
            id: 'column.copy.selectedColumns',
            label: text('column.copy.selectedColumns'),
            hint: text('column.copy.selectedColumns.hint'),
            disabled: noneSelected,
            action: () => copyColumns(selectedFields())
        },
        { type: 'separator', id: 'column.copy.namesSeparator' },
        {
            id: 'column.copy.headers',
            label: text('column.copy.headers'),
            action: () => copyNames(getLayoutFields(gridInterface))
        },
        {
            id: 'column.copy.header',
            label: text('column.copy.header'),
            action: () => copyNames(fields)
        },
        {
            id: 'column.copy.selectedHeaders',
            label: text('column.copy.selectedHeaders'),
            disabled: noneSelected,
            action: () => copyNames(selectedFields())
        }
    ];
}

/**
 * Ctrl+C (Cmd+C) on a column number: the selected columns, as the menu's Copy selected columns - the
 * number's own column when none is selected
 * @param cell the cell of the column number with the focus
 */
export function copyColumnsKey(ctx: Grid, cell: HTMLCellElement) {
    const selected = getLayoutFields(ctx.gridInterface, { selectedOnly: true });
    const { text, html } = columnsClipboard(ctx, selected.length ? selected : numberFields(ctx, cell));
    writeClipboard(text, html);
}
