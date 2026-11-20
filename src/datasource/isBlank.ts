/**
 * @internal
 * One definition of "blank" for sorting, grouping and keys: null, undefined, '' and an invalid Date.
 * 0 and false are real values, not blanks.
 */
export function isBlank(value: unknown): boolean {
    if (value === null || value === undefined || value === '') {
        return true;
    }
    // new Date('x') is an object, so it needs its own check
    return value instanceof Date && Number.isNaN(value.getTime());
}
