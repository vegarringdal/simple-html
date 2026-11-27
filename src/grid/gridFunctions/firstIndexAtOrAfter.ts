/**
 * The first index, from `from` on, whose value is `value` or more: a binary search in a list sorted
 * from low to high. The scroll handlers use it to find the first row (column) that starts at a
 * position, in the tops of the rows (lefts of the columns) - a scroll event looks it up in a long list
 * without walking it from the start.
 *
 * Equal values are allowed, the first of them is found: the same index as walking the list from
 * `from` and stopping at the first value that is `value` or more.
 *
 * @param values sorted from low to high
 * @param value the value to look for
 * @param from where to start, 0 by default
 * @returns the index, `values.length` when there is none
 *
 * @example
 * ```ts
 * firstIndexAtOrAfter([0, 22, 44], 22); // 1
 * firstIndexAtOrAfter([0, 22, 44], 23); // 2
 * firstIndexAtOrAfter([0, 22, 44], 45); // 3, none
 * ```
 */
export function firstIndexAtOrAfter(values: readonly number[], value: number, from = 0): number {
    let low = Math.min(Math.max(from, 0), values.length);
    let high = values.length;

    // the answer is between low and high: every index before low has a smaller value, high is
    // either the end or an index whose value is large enough
    while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (values[middle] < value) {
            low = middle + 1;
        } else {
            high = middle;
        }
    }

    return low;
}
