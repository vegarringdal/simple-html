import { type Entity, type GroupRow, isGroupRow } from './entity';
import { isBlank } from './isBlank';

/**
 * How {@link Datasource.aggregate} sums up the values of a field over rows. Blank values (`null`,
 * `undefined`, `''`, an invalid `Date`) are left out by all of them; `0` and `false` are values.
 *
 * | function | the result | of no values |
 * | --- | --- | --- |
 * | `'sum'` | the sum of the numbers | `0` |
 * | `'avg'` | the average of the numbers: their sum / how many there are | `null` |
 * | `'min'` | the smallest number | `null` |
 * | `'max'` | the largest number | `null` |
 * | `'count'` | how many values are not blank, of any type | `0` |
 *
 * `sum`, `avg`, `min` and `max` take numbers only: a value that is no number (text, even `'12'`, a
 * `Date`, `NaN`, `Infinity`) is left out, as a blank is. Nothing is rounded: format the result with the field's
 * formatter. The sum is added up with a compensated sum (Neumaier), so it does not drift away over
 * many rows: 100 000 times `0.1` is `10000`.
 *
 * It is what a column's `aggregate` in the grid config shows, in the group rows and the totals row.
 *
 * @sample aggregates
 * @example
 * ```ts
 * import type { AggregateFunction } from '@simple-html/grid';
 *
 * const fn: AggregateFunction = 'sum';
 * datasource.aggregate('balance', fn); // over the rows the filter lets through
 * ```
 */
export type AggregateFunction = 'sum' | 'avg' | 'min' | 'max' | 'count';

/**
 * @internal
 * every aggregate function, for checking one that comes from plain js or JSON
 */
export const AGGREGATE_FUNCTIONS: readonly AggregateFunction[] = ['sum', 'avg', 'min', 'max', 'count'];

/**
 * @internal
 * true when the value is one of the aggregate functions
 */
export function isAggregateFunction(value: unknown): value is AggregateFunction {
    return AGGREGATE_FUNCTIONS.some((fn) => fn === value);
}

/**
 * @internal
 * The aggregate of a field over rows, see {@link AggregateFunction}: what `Datasource.aggregate()`
 * computes. One read of the field per row and nothing else: a row is a Proxy, every read of it goes
 * through its handler, and a read of a `__` field (isGroupRow() reads `__group`) is the slow way
 * through it
 * @param rows data rows, no group rows
 */
export function aggregateRows(rows: readonly Entity[], field: string, fn: AggregateFunction): number | null {
    if (fn === 'count') {
        let count = 0;
        for (const row of rows) {
            if (!isBlank(row[field])) {
                count++;
            }
        }
        return count;
    }

    // the numbers: their count, their sum (Neumaier: `compensation` collects what the additions lost
    // to rounding), the smallest and the largest
    let count = 0;
    let sum = 0;
    let compensation = 0;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const row of rows) {
        const value = row[field];
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            continue;
        }
        count++;
        const next = sum + value;
        compensation += Math.abs(sum) >= Math.abs(value) ? sum - next + value : value - next + sum;
        sum = next;
        if (value < min) {
            min = value;
        }
        if (value > max) {
            max = value;
        }
    }

    switch (fn) {
        case 'sum':
            return sum + compensation;
        case 'avg':
            return count ? (sum + compensation) / count : null;
        case 'min':
            return count ? min : null;
        default:
            return count ? max : null;
    }
}

/**
 * @internal
 * The data rows of a group: its own rows, and the rows of its sub groups - collapsed ones too - in the
 * order they are displayed in
 */
export function groupDataRows(group: GroupRow): Entity[] {
    const rows: Entity[] = [];
    const collect = (children: (Entity | GroupRow)[]) => {
        for (const child of children) {
            if (isGroupRow(child)) {
                collect(child.__groupChildren);
            } else {
                rows.push(child);
            }
        }
    };
    collect(group.__groupChildren);
    return rows;
}
