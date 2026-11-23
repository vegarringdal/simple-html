import { AGGREGATE_FUNCTIONS, type AggregateFunction } from '../../datasource/aggregate';
import type { SortArgument } from '../../datasource/sortArgument';
import type { TextId } from '../../texts';
import type { Grid } from '../grid';
import type { MenuContext, MenuEntry, MenuSubmenu } from '../gridMenus';
import { aggregatesOf } from './aggregates';
import type { ColType } from './colType';
import { columnSettingsEntry } from './columnSettings';
import { contextMenuColumnChooser } from './contextMenuColumnChooser';
import { formatSubmenu } from './formatSubmenu';
import { gridText } from './gridText';
import type { HTMLCellElement } from './HTMLCellElement';
import { openImportDialog } from './importDialog';
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
    attribute: string
) {
    const context: MenuContext = {
        menu: 'header',
        field: attribute,
        // the first displayed row as it is now, not the header's: a group row when grouped, undefined
        // without rows. It was the one when the header was rendered, a filter since left it stale
        row: ctx.gridInterface.getDatasource().getRow(0),
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
 * The header menu's default entries, new objects every call: pin (a submenu), hide, remove sorting,
 * the column chooser, then the submenus size, format (formatSubmenu.ts), the grid config dialog
 * (columnSettings.ts), the submenus aggregate and grouping. The ids are documented in MENU_IDS.header
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
        {
            type: 'submenu',
            id: 'header.column.pin',
            label: text('header.column.pin'),
            entries: [
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
                }
            ]
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
        {
            type: 'submenu',
            id: 'header.size',
            label: text('header.size'),
            // fitted to the content, like Excel's AutoFit, and back to the widths of the config
            entries: [
                {
                    id: 'header.size.column',
                    label: text('header.size.column'),
                    action: () => ctx.gridInterface.fitColumns([attribute])
                },
                { id: 'header.size.all', label: text('header.size.all'), action: () => ctx.gridInterface.fitColumns() },
                {
                    id: 'header.size.resetColumn',
                    label: text('header.size.resetColumn'),
                    action: () => ctx.gridInterface.resetColumnWidths([attribute])
                },
                {
                    id: 'header.size.resetAll',
                    label: text('header.size.resetAll'),
                    action: () => ctx.gridInterface.resetColumnWidths()
                }
            ]
        },
        formatSubmenu(ctx, attribute),
        columnSettingsEntry(ctx, attribute),
        // GridConfig.importMenu: the import dialog, also for a grid without rows - it has no cell to right click
        {
            id: 'header.import',
            label: text('header.import'),
            visible: () => ctx.gridInterface.__showImportMenu(),
            action: () => openImportDialog(ctx)
        },
        aggregateSubmenu(ctx, attribute),
        {
            type: 'submenu',
            id: 'header.grouping',
            label: text('header.grouping'),
            entries: [
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
            ]
        }
    ];
}

/**
 * The aggregates of the column, turned on and off by the user: a toggle with a ✓ for each function -
 * sum, average, min and max on a number field only - and one for the totals row. They change the grid's
 * state (GridState.aggregates / totalsRow), so getState() keeps them and resetState() goes back to the
 * config's. See aggregates.ts
 */
function aggregateSubmenu(ctx: Grid, attribute: string): MenuSubmenu {
    const gridInterface = ctx.gridInterface;
    const isNumber = gridInterface.getDatasource().getField(attribute).type === 'number';
    const current = () => aggregatesOf(gridInterface.__getGridConfig(), attribute);
    const toggle = (fn: AggregateFunction) => {
        const aggregates = gridInterface.getState().aggregates;
        const now = current();
        aggregates[attribute] = now.includes(fn) ? now.filter((other) => other !== fn) : [...now, fn];
        gridInterface.setState({ aggregates });
    };
    return {
        type: 'submenu',
        id: 'header.aggregate',
        label: gridText(ctx, 'header.aggregate'),
        entries: [
            ...AGGREGATE_FUNCTIONS.map(
                (fn): MenuEntry => ({
                    id: `header.aggregate.${fn}`,
                    label: gridText(ctx, `header.aggregate.${fn}`),
                    visible: () => fn === 'count' || isNumber,
                    selected: () => current().includes(fn),
                    action: () => toggle(fn)
                })
            ),
            // the totals row is for every column, the functions above are this column's
            { type: 'separator', id: 'header.aggregate.totalsSeparator' },
            {
                id: 'header.aggregate.totalsRow',
                label: gridText(ctx, 'header.aggregate.totalsRow'),
                selected: () => gridInterface.__getGridConfig().totalsRow,
                action: () => gridInterface.setState({ totalsRow: !gridInterface.__getGridConfig().totalsRow })
            }
        ]
    };
}
