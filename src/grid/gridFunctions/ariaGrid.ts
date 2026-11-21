import { isGroupRow } from '../../datasource/entity';
import type { Grid } from '../grid';
import type { ParsedGridConfig } from '../gridConfig';
import type { ColType, ColumnCache } from './colType';
import { LEFT_PINNED_COLTYPE, MIDDLE_PINNED_COLTYPE, RIGHT_PINNED_COLTYPE } from './GROUP_COLTYPE';
import { gridText } from './gridText';

/**
 * The grid as a screen reader sees it: one `grid` (a `treegrid` while grouped) of rows and cells, the
 * WAI-ARIA grid pattern.
 *
 * The dom does not have that shape. A row of the grid is five row elements, one in each section
 * (group, row selector, left pinned, middle, right pinned), every section scrolls on its own, and the
 * row and column elements are a pool that is reused while scrolling: the element of the first row
 * shows a row further down after a scroll, so the dom order is not the order of the rows (nor of the
 * middle columns after a horizontal scroll).
 *
 * `aria-owns` builds the right shape without moving anything in the dom. The browser puts the owned
 * elements in the accessibility tree as children of the owner, after its own children, in the order
 * of the `aria-owns` list (WAI-ARIA 1.2, aria-owns):
 *
 * - the grid is an element of its own, made by {@link createAriaGrid}. Its children are the header
 *   rows, it owns the body rows in the order of the rows
 * - a header row is an element of its own too: it owns the label cells (columnheader) or the filter
 *   cells (gridcell), in the order of the columns
 * - a body row is the row element of the row selector section, its own cell is the row number. It
 *   owns the group row's cell and the column elements of the left, middle and right sections, in the
 *   order of the columns
 * - the other row and column elements are `role="none"`: their cells come up into the row
 * - a group row's element has one cell over the columns, the name. With aggregates (aggregates.ts)
 *   the name cell spans the columns up to the first aggregate after it, then a cell per aggregate
 * - the totals row (GridConfig.totalsRow) is the last row the grid owns: "Total" (a rowheader at
 *   column 1) and a cell per aggregate. Its aria-rowindex is set where it is rendered
 *
 * `aria-rowindex` / `aria-colindex` say where a row / cell is in the whole grid, the rows and columns
 * not in the dom included, and `aria-rowcount` / `aria-colcount` how many there are. The spec wants
 * the indexes to go up in the order of the tree, which the aria-owns order gives.
 *
 * The columns: the row selector (the row numbers) is column 1, then every field of the layout is a
 * column, left to right - a column of the layout with two fields stacked is two columns here.
 *
 * {@link updateAriaGrid} runs after every render of the rows (verticalScrollHandler) and of the
 * columns (horizontalScrollHandler).
 */

/**
 * the order of the sections in a row, left to right
 */
const SECTIONS: ColType[] = [LEFT_PINNED_COLTYPE, MIDDLE_PINNED_COLTYPE, RIGHT_PINNED_COLTYPE];

/**
 * Sets an attribute when it changes, removes it for null: an attribute set to the value it has is
 * still a change the browser (and its accessibility tree) has to look at
 */
export function setAria(element: Element, name: string, value: string | null) {
    if (value === null) {
        if (element.hasAttribute(name)) {
            element.removeAttribute(name);
        }
    } else if (element.getAttribute(name) !== value) {
        element.setAttribute(name, value);
    }
}

/**
 * the columns of a section of the layout
 */
function sectionColumns(config: ParsedGridConfig, colType: ColType) {
    switch (colType) {
        case LEFT_PINNED_COLTYPE:
            return config.layout.left;
        case RIGHT_PINNED_COLTYPE:
            return config.layout.right;
        default:
            return config.layout.center;
    }
}

/**
 * the column cache of a section: which column of the layout each column element (slot) shows
 */
function sectionCache(ctx: Grid, colType: ColType): ColumnCache[] {
    switch (colType) {
        case LEFT_PINNED_COLTYPE:
            return ctx.containerLeftColumnCache;
        case RIGHT_PINNED_COLTYPE:
            return ctx.containerRightColumnCache;
        default:
            return ctx.containerMiddleColumnCache;
    }
}

/**
 * The number of header rows a screen reader gets: the labels and the filters, when shown. The
 * column selector (the column numbers under the filters) is hidden from it, see rebuildHeaderColumns
 */
export function headerRowCount(config: ParsedGridConfig) {
    return (config.hideLabels ? 0 : 1) + (config.hideFilter ? 0 : 1);
}

/**
 * The `aria-colindex` of a cell, 1 based: column 1 is the row selector, then the fields of the left,
 * middle and right sections - every field of a column, a column can stack several
 * @param column the column in its section
 * @param celno the field in the column
 */
export function ariaColIndex(config: ParsedGridConfig, colType: ColType, column: number, celno: number) {
    let index = 1;
    for (const section of SECTIONS) {
        const columns = sectionColumns(config, section);
        if (section === colType) {
            for (let i = 0; i < column; i++) {
                index = index + columns[i].fields.length;
            }
            return index + celno + 1;
        }
        for (const col of columns) {
            index = index + col.fields.length;
        }
    }
    return index;
}

/**
 * The `aria-colcount`: the row selector and every field of the layout
 */
export function ariaColCount(config: ParsedGridConfig) {
    let count = 1;
    for (const section of SECTIONS) {
        for (const col of sectionColumns(config, section)) {
            count = count + col.fields.length;
        }
    }
    return count;
}

/**
 * The id of an element the grid points to with aria-owns: the grid's own prefix, so two grids on a
 * page never share an id
 * @param name what the element is, unique in the grid: `selector3`, `middle-pinned3-0`
 */
export function ariaId(ctx: Grid, name: string) {
    return `${ctx.ariaIdPrefix}-${name}`;
}

/**
 * The id of a header cell, see rebuildHeaderColumns
 * @param slot the column element in its section, not the column it shows
 */
export function headerCellId(ctx: Grid, colType: ColType, slot: number, type: 'label' | 'filter', celno: number) {
    return ariaId(ctx, `${colType}${slot}-${type}${celno}`);
}

/**
 * Makes the grid element and its header rows, for createDom. They have no size and show nothing: the
 * grid is in the accessibility tree only. Put after the grouping panel, so a screen reader reads the
 * panel, the grid, then the footer
 */
export function createAriaGrid(ctx: Grid) {
    const grid = document.createElement('div');
    grid.classList.add('simple-html-grid-aria');
    grid.setAttribute('role', 'grid');

    const labels = document.createElement('div');
    labels.setAttribute('role', 'row');
    const filters = document.createElement('div');
    filters.setAttribute('role', 'row');
    grid.appendChild(labels);
    grid.appendChild(filters);

    ctx.ariaGrid = grid;
    ctx.ariaLabelRow = labels;
    ctx.ariaFilterRow = filters;
    return grid;
}

/**
 * The ids of the cells of a header row, in the order of the columns: the corner first (the header
 * of the row numbers) when this is the first header row
 */
function headerRowOwns(ctx: Grid, type: 'label' | 'filter', withCorner: boolean) {
    const config = ctx.gridInterface.__getGridConfig();
    const ids: string[] = withCorner ? [ariaId(ctx, 'corner')] : [];
    for (const section of SECTIONS) {
        const columns = sectionColumns(config, section);
        for (const { slot, column } of slotsInOrder(sectionCache(ctx, section))) {
            for (let celno = 0; celno < (columns[column]?.fields.length ?? 0); celno++) {
                ids.push(headerCellId(ctx, section, slot, type, celno));
            }
        }
    }
    return ids.join(' ');
}

/**
 * the column elements (slots) of a section that show a column, in the order of the columns
 */
function slotsInOrder(cache: ColumnCache[]) {
    return cache
        .map((entry, slot) => ({ slot, column: entry.column }))
        .filter((entry) => entry.column >= 0)
        .sort((a, b) => a.column - b.column);
}

/**
 * Updates the grid for a screen reader after the rows or the columns were rendered: the role
 * (treegrid while grouped), the name, the counts, which rows are in it and in what order, and the
 * order of the cells in each row. See the top of this file
 */
export function updateAriaGrid(ctx: Grid) {
    // the grid element is made by createDom, the handlers can run before (rebuildHeaderColumns)
    const grid = ctx.ariaGrid;
    if (!grid || !ctx.containerSelectorRowCache) {
        return;
    }
    const config = ctx.gridInterface.__getGridConfig();
    const datasource = ctx.gridInterface.getDatasource();
    const headerRows = headerRowCount(config);

    // grouped, the rows have levels and the group rows can be expanded: that is a treegrid. A grid
    // must not have aria-level and aria-expanded on its rows (WAI-ARIA 1.2, row)
    setAria(grid, 'role', datasource.getGrouping().length ? 'treegrid' : 'grid');
    setAria(grid, 'aria-label', gridText(ctx, 'grid.label'));
    // the totals row is a row too, the last
    const totalsRow = config.__totalsRowHeight > 0;
    setAria(grid, 'aria-rowcount', String(headerRows + datasource.length() + (totalsRow ? 1 : 0)));
    setAria(grid, 'aria-colcount', String(ariaColCount(config)));
    setAria(grid, 'aria-multiselectable', datasource.getSelectionMode() === 'multiple' ? 'true' : null);

    // the header rows: the first one also has the corner, the header of the row numbers
    const labels = ctx.ariaLabelRow;
    const filters = ctx.ariaFilterRow;
    labels.hidden = !!config.hideLabels;
    filters.hidden = !!config.hideFilter;
    setAria(labels, 'aria-rowindex', config.hideLabels ? null : '1');
    setAria(filters, 'aria-rowindex', config.hideFilter ? null : String(headerRows));
    setAria(labels, 'aria-owns', config.hideLabels ? null : headerRowOwns(ctx, 'label', true));
    setAria(filters, 'aria-owns', config.hideFilter ? null : headerRowOwns(ctx, 'filter', !!config.hideLabels));

    // the cells of a body row: the group row's cell, then the column elements of the sections. The
    // column caches are the same for every row, the order is worked out once
    const slots = SECTIONS.map((section) => ({ section, slots: slotsInOrder(sectionCache(ctx, section)) }));
    const rowCaches = {
        [LEFT_PINNED_COLTYPE]: ctx.containerLeftRowCache,
        [MIDDLE_PINNED_COLTYPE]: ctx.containerMiddleRowCache,
        [RIGHT_PINNED_COLTYPE]: ctx.containerRightRowCache
    } as Record<ColType, typeof ctx.containerLeftRowCache>;

    const shown: { row: number; id: string }[] = [];
    ctx.containerSelectorRowCache.forEach((entry, i) => {
        const rowElement = ctx.rows.get(entry.id);
        if (!rowElement) {
            return;
        }
        const owns = [ariaId(ctx, ctx.containerGroupRowCache[i].id)];
        for (const { section, slots: sectionSlots } of slots) {
            const rowId = rowCaches[section][i].id;
            for (const { slot } of sectionSlots) {
                owns.push(ariaId(ctx, `${rowId}-${slot}`));
            }
        }
        setAria(rowElement, 'aria-owns', owns.join(' '));
        if (entry.row >= 0) {
            shown.push({ row: entry.row, id: rowElement.id });
        }
    });

    // the body rows, in the order of the rows: the dom order is the order of the pool. Then the totals row
    shown.sort((a, b) => a.row - b.row);
    const owns = shown.map((entry) => entry.id);
    if (totalsRow) {
        owns.push(ariaId(ctx, 'totals'));
    }
    setAria(grid, 'aria-owns', owns.join(' ') || null);
}

/**
 * The states of a body row, for verticalScrollHandler: where it is, whether it is selected, and its
 * level and whether it is expanded while grouped. Set on the row element of the row selector, the
 * element that is the row (see the top of this file)
 * @param row the index in the displayed rows
 */
export function updateAriaRow(ctx: Grid, rowElement: HTMLElement, row: number) {
    const config = ctx.gridInterface.__getGridConfig();
    const datasource = ctx.gridInterface.getDatasource();
    const rowData = datasource.getRow(row);
    const grouping = datasource.getGrouping();

    setAria(rowElement, 'aria-rowindex', String(headerRowCount(config) + row + 1));

    // aria-selected only where a row can be selected: a group row can not, and not with selectionMode
    // 'none'. Single and multiple both say false on the rows that are not selected, so a screen
    // reader does not take the focused row as the selected one
    const selectable = datasource.getSelectionMode() !== 'none' && !isGroupRow(rowData);
    setAria(rowElement, 'aria-selected', selectable ? String(datasource.getSelection().isSelected(row)) : null);

    // a group row is at the level of its grouping (__groupLvl is 0 based), a data row one below the
    // last grouping level. Only in a treegrid, see updateAriaGrid
    if (grouping.length) {
        const level = isGroupRow(rowData) ? rowData.__groupLvl + 1 : grouping.length + 1;
        setAria(rowElement, 'aria-level', String(level));
        setAria(rowElement, 'aria-expanded', isGroupRow(rowData) ? String(rowData.__groupExpanded) : null);
    } else {
        setAria(rowElement, 'aria-level', null);
        setAria(rowElement, 'aria-expanded', null);
    }
}
