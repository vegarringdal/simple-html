import type { Entity, GroupRow } from '../../datasource/entity';
import type { SortArgument } from '../../datasource/sortArgument';
import type { TextId } from '../../texts';
import type { Grid } from '../grid';
import type { MenuContext, MenuEntry } from '../gridMenus';
import { autoResizeColumns } from './autoResizeColumns';
import type { ColType } from './colType';
import { contextMenuColumnChooser } from './contextMenuColumnChooser';
import { gridText } from './gridText';
import type { HTMLCellElement } from './HTMLCellElement';
import { placeUnderCell, showMenu } from './showMenu';

/**
 * Opens the header menu, the right click menu of a header label: the default entries (see
 * MENU_IDS.header), changed by the `menus.header` hook.
 */
export function contextmenuLabel(
    ctx: Grid,
    event: MouseEvent,
    cell: HTMLCellElement,
    row: number,
    column: number,
    celno: number,
    colType: ColType,
    _cellType: string,
    attribute: string,
    // the first displayed row, not the header's: a group row when grouped, undefined when there are no rows
    rowData: Entity | GroupRow | undefined
) {
    const context: MenuContext = {
        menu: 'header',
        field: attribute,
        row: rowData,
        rowIndex: row,
        cell,
        gridInterface: ctx.gridInterface,
        datasource: ctx.gridInterface.getDatasource()
    };

    const defaults = headerMenuEntries(ctx, event, cell, column, celno, colType, attribute);
    const entries = ctx.gridInterface.__getHooks().menus?.header?.(defaults, context) ?? defaults;

    showMenu(ctx, entries, context, placeUnderCell(event, cell));
}

/**
 * The header menu's default entries, new objects every call. The ids are documented in MENU_IDS.header
 */
function headerMenuEntries(
    ctx: Grid,
    event: MouseEvent,
    cell: HTMLCellElement,
    column: number,
    celno: number,
    colType: ColType,
    attribute: string
): MenuEntry[] {
    const layout = () => ctx.gridInterface.__getGridConfig().layout;

    /**
     * the width of the column the field is in now, 100 when it is not in a layout list (never, the menu
     * is opened on it)
     */
    const currentWidth = () => {
        if (colType === 'left-pinned') {
            return layout().left[column].width;
        }
        if (colType === 'middle-pinned') {
            return layout().center[column].width;
        }
        if (colType === 'right-pinned') {
            return layout().right[column].width;
        }
        return 100;
    };

    /**
     * takes the field out of the column it is in now
     */
    const removeFromColumn = () => {
        if (colType === 'left-pinned') {
            layout().left[column].fields.splice(celno, 1);
        }
        if (colType === 'middle-pinned') {
            layout().center[column].fields.splice(celno, 1);
        }
        if (colType === 'right-pinned') {
            layout().right[column].fields.splice(celno, 1);
        }
    };

    /**
     * pins the field left or right in a column of its own. `move` takes it out of where it is now,
     * else it is shown twice
     */
    const pin = (side: 'left' | 'right', move: boolean) => {
        const width = currentWidth();
        if (move) {
            removeFromColumn();
        }
        layout()[side].push({ fields: [attribute], width });
        ctx.rebuild(true);
    };

    const notPinnedLeft = () => colType !== 'left-pinned';
    const notPinnedRight = () => colType !== 'right-pinned';

    const text = (id: TextId) => gridText(ctx, id);

    return [
        { type: 'section', id: 'header.column', label: text('header.column') },
        {
            id: 'header.column.pinLeft',
            label: text('header.column.pinLeft'),
            visible: notPinnedLeft,
            action: () => pin('left', true)
        },
        {
            id: 'header.column.pinLeftCopy',
            label: text('header.column.pinLeftCopy'),
            visible: notPinnedLeft,
            action: () => pin('left', false)
        },
        {
            id: 'header.column.pinRight',
            label: text('header.column.pinRight'),
            visible: notPinnedRight,
            action: () => pin('right', true)
        },
        {
            id: 'header.column.pinRightCopy',
            label: text('header.column.pinRightCopy'),
            visible: notPinnedRight,
            action: () => pin('right', false)
        },
        {
            id: 'header.column.unpin',
            label: text('header.column.unpin'),
            visible: () => colType === 'left-pinned' || colType === 'right-pinned',
            action: () => {
                // back in the center, next to the side it was pinned to
                const width = currentWidth();
                if (colType === 'right-pinned') {
                    removeFromColumn();
                    layout().center.push({ fields: [attribute], width });
                }
                if (colType === 'left-pinned') {
                    removeFromColumn();
                    layout().center.unshift({ fields: [attribute], width });
                }
                ctx.rebuild(true);
            }
        },
        {
            id: 'header.column.hide',
            label: text('header.column.hide'),
            action: () => {
                removeFromColumn();
                ctx.rebuild(true);
            }
        },
        {
            id: 'header.column.removeSorting',
            label: text('header.column.removeSorting'),
            action: () => {
                // the grouped fields stay sorted, grouping needs it
                const datasource = ctx.gridInterface.getDatasource();
                const grouping = datasource.getGrouping().map((e) => e.attribute);
                const newSorting: SortArgument[] = datasource
                    .getLastSorting()
                    .filter((sort) => grouping.indexOf(sort.attribute) !== -1);

                datasource.setOrderBy(newSorting);
                ctx.rebuild(true);
            }
        },
        { type: 'separator', id: 'header.column.chooserSeparator' },
        {
            id: 'header.column.chooser',
            label: text('header.column.chooser'),
            action: () => contextMenuColumnChooser(ctx, event, cell)
        },
        { type: 'section', id: 'header.size', label: text('header.size') },
        { id: 'header.size.column', label: text('header.size.column'), action: () => autoResizeColumns(ctx, attribute) },
        { id: 'header.size.all', label: text('header.size.all'), action: () => autoResizeColumns(ctx) },
        { type: 'section', id: 'header.grouping', label: text('header.grouping') },
        {
            id: 'header.grouping.expandAll',
            label: text('header.grouping.expandAll'),
            action: () => ctx.gridInterface.getDatasource().expandGroup()
        },
        {
            id: 'header.grouping.collapseAll',
            label: text('header.grouping.collapseAll'),
            action: () => ctx.gridInterface.getDatasource().collapseGroup()
        },
        {
            id: 'header.grouping.clear',
            label: text('header.grouping.clear'),
            action: () => ctx.gridInterface.getDatasource().removeGroup()
        }
    ];
}
