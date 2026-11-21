import { type Entity, isGroupRow } from '../../datasource/entity';
import type { Grid } from '../grid';
import { cellTextOf } from './cellText';
import { getLayoutFields } from './getLayoutFields';

/**
 * The model of Find (Ctrl+F in the grid, see findBar.ts for the bar and the cells): which cells show a
 * text, and which of them comes at or after a cell. No dom - it reads the interface and the datasource
 * only.
 */

/**
 * A cell that shows the text searched for
 */
export interface FindMatch {
    /** the displayed row, an index in `datasource.getRows()` - good until the displayed rows change */
    row: number;
    /** the row itself: a match is found again after the rows moved, see matchAtOrAfter */
    entity: Entity;
    /** the field of the cell */
    field: string;
    /** the index of the field in getLayoutFields() */
    column: number;
}

/**
 * A cell to look from: the current match, or the cell that had the focus when the find bar opened. The
 * row and the field, and the displayed row it was at - for when the row is not displayed any more
 */
export interface FindAnchor {
    entity: Entity;
    field: string;
    row: number;
}

/**
 * The cells that show a text: the text each cell shows - its value through the field's formatter, with
 * the column's `numberOverride`, as renderRowCell shows it (cellTextOf) - holds the text, in any case.
 * The whole text of a cell of several lines, not only its first line. Not a checkbox (a `boolean` cell
 * shows no text), not a group row, not the rows of a collapsed group (they are not displayed).
 *
 * In the order of the grid: the displayed rows top to bottom, and in a row the fields of the layout
 * left to right (getLayoutFields(): pinned left, center, pinned right, the stacked fields of a column
 * top to bottom).
 *
 * Every cell's text is made: 100 000 rows of 10 fields are a million texts, some hundred ms.
 * @param ctx the grid, or an object with the grid's interface
 * @param text the text to find. An empty text finds nothing
 */
export function findMatches(ctx: Pick<Grid, 'gridInterface'>, text: string): FindMatch[] {
    const needle = text.toLowerCase();
    if (needle === '') {
        return [];
    }
    const fields = getLayoutFields(ctx.gridInterface);
    const textOf = fields.map((field) => cellTextOf(ctx, field));
    const matches: FindMatch[] = [];

    ctx.gridInterface
        .getDatasource()
        .getRows()
        .forEach((entity, row) => {
            if (isGroupRow(entity)) {
                return;
            }
            for (let column = 0; column < fields.length; column++) {
                const cell = textOf[column](entity);
                // a formatter of plain JavaScript can give something else than text
                if (
                    cell.type !== 'boolean' &&
                    String(cell.text ?? '')
                        .toLowerCase()
                        .includes(needle)
                ) {
                    matches.push({ row, entity, field: fields[column], column });
                }
            }
        });
    return matches;
}

/**
 * The match at or after a cell, in the order of findMatches: the anchor itself when it is still a
 * match, else the next one after it - wrapping to the first. The anchor's row is looked up in the
 * displayed rows: a sort moved it. When it is not displayed any more (a filter), from the displayed row
 * it was at.
 * @param matches the matches, from findMatches
 * @param rows the displayed rows the matches were found in (`datasource.getRows()`)
 * @param fields the fields of the layout they were found in (getLayoutFields())
 * @param anchor where to look from, null for the first match
 * @returns the index in `matches`, -1 when there is none
 */
export function matchAtOrAfter(
    matches: readonly FindMatch[],
    rows: readonly Entity[],
    fields: readonly string[],
    anchor: FindAnchor | null
): number {
    if (!matches.length) {
        return -1;
    }
    if (!anchor) {
        return 0;
    }
    const same = matches.findIndex((match) => match.entity === anchor.entity && match.field === anchor.field);
    if (same !== -1) {
        return same;
    }
    const displayed = rows.indexOf(anchor.entity);
    const row = displayed === -1 ? anchor.row : displayed;
    // a field no longer in the layout is -1: every field of its row comes after it
    const column = fields.indexOf(anchor.field);
    const after = matches.findIndex((match) => match.row > row || (match.row === row && match.column >= column));
    return after === -1 ? 0 : after;
}
