import type { TextId } from '../../texts';
import type { Grid } from '../grid';
import type { MenuContext, MenuEntry, MenuSubmenu } from '../gridMenus';
import { columnFields, columnNumber, numberedColumns } from './columnSelection';
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

    const number = columnNumber(gridInterface.__getGridConfig(), cell.$coltype, cell.$column);
    const defaults = columnMenuEntries(ctx, fields, number);
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
 * The column menu's default entries, new objects every call: Select ›, a line, the copies of the
 * columns, a line, the copies of their names. The copies are flat, no submenu: every entry is a copy, a
 * Copy › around them would only add a step. The entries of the selected columns are greyed out with
 * none selected, as the row menu's of the selected rows. The ids are documented in MENU_IDS.column
 * @param fields the fields of the column right clicked
 * @param number its number
 */
function columnMenuEntries(ctx: Grid, fields: string[], number: number): MenuEntry[] {
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
        selectSubmenu(ctx, number),
        { type: 'separator', id: 'column.copy.separator' },
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
 * Select ›: what Ctrl and Shift do on a column number with the mouse, for a finger - which has neither
 * - and for every other input too (see columnSelection.ts):
 * - This column: the column in or out, the others stay - as Ctrl+click. A ✓ while it is selected
 * - Columns from N to here: from the anchor - the column clicked last without Shift - to this one, as
 *   Shift+click. N is the anchor's number; greyed out with no anchor (N is this column's number then),
 *   and when the anchor is this column
 * - All columns, greyed out when every column is selected; Clear column selection, greyed out with
 *   none selected
 *
 * The column numbers have no selection mode: Ctrl+click selects more columns in every mode of the
 * rows, so these entries are always shown. `column-selection-change` is sent when the selection changed
 * @param number the number of the column right clicked
 */
function selectSubmenu(ctx: Grid, number: number): MenuSubmenu {
    const gridInterface = ctx.gridInterface;
    const text = (id: TextId) => gridText(ctx, id);
    const anchor = gridInterface.__getColumnAnchor();
    const count = numberedColumns(gridInterface.__getGridConfig()).length;
    return {
        type: 'submenu',
        id: 'column.select',
        label: text('column.select'),
        entries: [
            {
                id: 'column.select.column',
                label: text('column.select.column'),
                selected: () => gridInterface.__isColumnSelected(number),
                action: () => gridInterface.__clickColumn(number, { toggle: true, range: false })
            },
            {
                id: 'column.select.columnsTo',
                label: gridText(ctx, 'column.select.columnsTo', { column: anchor ?? number }),
                disabled: () => anchor === null || anchor === number,
                action: () => gridInterface.__clickColumn(number, { toggle: false, range: true })
            },
            {
                id: 'column.select.all',
                label: text('column.select.all'),
                disabled: () => gridInterface.getSelectedColumns().length === count,
                action: () => gridInterface.selectColumns(Array.from({ length: count }, (_, i) => i + 1))
            },
            {
                id: 'column.select.clear',
                label: text('column.select.clear'),
                disabled: () => gridInterface.getSelectedColumns().length === 0,
                action: () => gridInterface.selectColumns([])
            }
        ]
    };
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
