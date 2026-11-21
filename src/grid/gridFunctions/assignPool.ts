/**
 * Which row (or column) each element of a pool shows after a scroll.
 *
 * The row and column elements of the grid are a pool, reused while scrolling (made by rebuildRows and
 * rebuildRowColumns): the row caches and column caches say which row or column each element shows.
 * After a scroll the rows (columns) from `first` up to `end` are wanted on screen:
 *
 * - an element that shows a wanted one keeps it, it needs no new row or column
 * - the other elements are free, they get the wanted ones no element shows yet - the last of them
 *   first
 * - a free element left over shows nothing, -1
 *
 * The pool is made big enough for every row (column) that can be on screen at once, then every wanted
 * one gets an element.
 *
 * @param shown what each element of the pool shows now, in the order of the pool. -1 for nothing
 * @param first the first wanted one
 * @param end one past the last wanted one
 * @returns what each element of the pool shows from now on, in the order of the pool
 *
 * @example
 * ```ts
 * // rows 2 to 5 wanted: the elements showing 2 and 3 keep them, the others get 5 and 4
 * assignPool([0, 1, 2, 3], 2, 6); // [5, 4, 2, 3]
 * ```
 */
export function assignPool(shown: readonly number[], first: number, end: number): number[] {
    const wanted = new Set<number>();
    for (let i = first; i < end; i++) {
        wanted.add(i);
    }

    // kept, or free (-1). Set.delete() is true when the value was in the set: the second element
    // showing the same one is free
    const next = shown.map((index) => (wanted.delete(index) ? index : -1));

    // the wanted ones no element shows, for the free elements
    const missing = Array.from(wanted);
    return next.map((index) => (index === -1 && missing.length ? (missing.pop() as number) : index));
}
