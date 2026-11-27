import { isGroupRow } from '../../datasource/entity';
import { isBlank } from '../../datasource/isBlank';
import type { Grid } from '../grid';
import { isMoreThanOneCell } from './cellRanges';

/**
 * What the footer shows of the selected cells, like the status bar of a spreadsheet: see
 * selectionSummary
 */
export interface SelectionSummary {
    /** the cells with a value - not blank, any type */
    count: number;
    /** the numbers of the number fields among them: sum, average, smallest, largest. null without any */
    sum: number | null;
    avg: number | null;
    min: number | null;
    max: number | null;
    /** the first number field of the ranges, in the layout's order: its formatter shows the numbers */
    numberField: string | null;
}

/**
 * The summary of the cell ranges (gridInterface.getRanges()) for the footer: every cell of the ranges
 * once - ranges that overlap count their common cells once - the data rows only (a group row has no
 * cells). The numbers are the values of the number fields (`type: 'number'`) that are numbers: a blank
 * is left out, 0 counts. `null` when the ranges are one cell or none: one cell's value is on screen.
 *
 * It goes over the rectangle around the ranges, cell by cell: Ctrl+A on 100 000 rows of 10 fields is a
 * million cells, some ms.
 */
export function selectionSummary(ctx: Grid): SelectionSummary | null {
    const gridInterface = ctx.gridInterface;
    const state = gridInterface.__getRangeState();
    if (!state || !isMoreThanOneCell(gridInterface.getRanges())) {
        return null;
    }
    const datasource = gridInterface.getDatasource();
    const fields = state.layout.fields;
    const isNumber = fields.map((field) => datasource.getField(field).type === 'number');

    const top = Math.min(...state.rects.map((rect) => rect.top));
    const bottom = Math.max(...state.rects.map((rect) => rect.bottom));
    const left = Math.min(...state.rects.map((rect) => rect.left));
    const right = Math.max(...state.rects.map((rect) => rect.right));
    const inARange = (row: number, column: number) =>
        state.rects.some((rect) => row >= rect.top && row <= rect.bottom && column >= rect.left && column <= rect.right);

    let count = 0;
    let numbers = 0;
    let sum = 0;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    let numberColumn = -1;
    for (let row = top; row <= bottom; row++) {
        const entity = datasource.getRow(row);
        if (!entity || isGroupRow(entity)) {
            continue;
        }
        for (let column = left; column <= right; column++) {
            if (!inARange(row, column)) {
                continue;
            }
            const value = entity[fields[column]];
            if (isBlank(value)) {
                continue;
            }
            count++;
            if (isNumber[column] && typeof value === 'number' && Number.isFinite(value)) {
                numbers++;
                sum += value;
                min = Math.min(min, value);
                max = Math.max(max, value);
                if (numberColumn === -1 || column < numberColumn) {
                    numberColumn = column;
                }
            }
        }
    }
    return {
        count,
        sum: numbers ? sum : null,
        avg: numbers ? sum / numbers : null,
        min: numbers ? min : null,
        max: numbers ? max : null,
        numberField: numberColumn === -1 ? null : fields[numberColumn]
    };
}
