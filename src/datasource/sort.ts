import type { Entity } from './entity';
import type { FieldType } from './field';
import { isBlank } from './isBlank';
import type { SortArgument } from './sortArgument';
import { valueText } from './valueText';

export class Sort {
    private lastSorting: SortArgument[];
    private currentSorting: SortArgument[];
    private localeCompareCode: Intl.Collator | null;
    /**
     * the text a field is sorted on instead of its value, by field: see setSortValue. A field not in
     * it sorts on its value
     */
    private sortValues = new Map<string, (value: unknown, row: Entity) => string>();

    /**
     * @param fieldType the type of a field, from the datasource's schema: a `date` field sorts on the
     * day, everything else on the value (a `datetime` on the full timestamp)
     */
    constructor(
        private fieldType: (attribute: string) => FieldType,
        /**
         * the text a field's rows are sorted on, asked once per sort - for a field without a
         * setSortValue: the text a grid's template shows (Datasource.__setSortText). undefined: on the value
         */
        private sortText: (attribute: string) => ((value: unknown, row: Entity) => string) | undefined = () => undefined
    ) {
        this.lastSorting = [];
        this.currentSorting = [];
        this.localeCompareCode = null;
    }

    public setLocaleCompare(code: string, options?: any): void {
        this.localeCompareCode = new Intl.Collator(code, options);
    }

    /**
     * Sorts a field on a text made from its value (and its row) instead of the value: the label the grid
     * shows for it (a lookup column, the label of the picked row), the text a template shows (a text
     * column with `format.text`, `{first} {last}`). `''` for a row leaves it to the value. Values with the same text are sorted on the
     * value after it, so two values compare as equal only when they are - grouping relies on that.
     * @param sortValue the text of a value, null to sort the field on its value again
     */
    public setSortValue(attribute: string, sortValue: ((value: unknown, row: Entity) => string) | null): void {
        if (sortValue) {
            this.sortValues.set(attribute, sortValue);
        } else {
            this.sortValues.delete(attribute);
        }
    }

    /**
     * the function setSortValue() was given for a field, undefined without one
     */
    public getSortValue(attribute: string): ((value: unknown, row: Entity) => string) | undefined {
        return this.sortValues.get(attribute);
    }

    public reset(defaultSortAttribute?: string): void {
        if (defaultSortAttribute) {
            this.lastSorting = [{ attribute: defaultSortAttribute, ascending: true }];
            this.currentSorting = [{ attribute: defaultSortAttribute, ascending: true }];
        } else {
            this.lastSorting = [];
            this.currentSorting = [];
        }
    }

    public overrideSort(array: SortArgument[]): void {
        this.lastSorting = array;
        this.currentSorting = array;
    }

    public getLastSort(): SortArgument[] {
        return this.lastSorting;
    }

    public setOrderBy(param: SortArgument | SortArgument[], add?: boolean): void {
        if (Array.isArray(param)) {
            this.lastSorting = param;
            this.currentSorting = param;
        } else {
            // do we add or is it the first one
            if (add && this.lastSorting.length > 0) {
                // its adding, so lets get last one
                this.currentSorting = this.lastSorting;
                let exist = false;

                // loop to se if it exist from before
                this.currentSorting.forEach((x) => {
                    if (x.attribute === param.attribute) {
                        exist = true;
                        x.ascending = param.ascending;
                    }
                });

                // if it dont exist we add it, else there isnt anythin else to do for now
                if (!exist) {
                    this.currentSorting.push(param);
                }
                this.lastSorting = this.currentSorting;
            } else {
                // if not adding, just set it
                this.currentSorting = [param];
                this.lastSorting = this.currentSorting;
            }
        }
    }

    public getOrderBy(): SortArgument[] {
        return this.currentSorting;
    }

    public runOrderBy(array: Entity[]): void {
        const thisSort = this.getOrderBy();
        // looked up once, not for every compare
        const dayOnly = thisSort.map((sortArg) => this.fieldType(sortArg.attribute) === 'date');
        // the text of each row (setSortValue, else sortText), made once per sort - not twice for every compare
        const texts = thisSort.map((sortArg) => {
            const sortValue = this.sortValues.get(sortArg.attribute) ?? this.sortText(sortArg.attribute);
            return sortValue ? new Map(array.map((row) => [row, sortValue(row[sortArg.attribute], row)])) : null;
        });
        // a field with values of more than one kind (a number and a date in a text field, or a column
        // of several types) compares every value as its text: a number to a number as numbers and to a
        // date as text is no order - 3 < 10 but "10" < "2026-01-01" < "3" - and equal values end up apart
        const asText = thisSort.map((sortArg) => mixedKinds(array, sortArg.attribute));

        array.sort((obj1: any, obj2: any) => {
            // first sort argument that tells the rows apart decides
            for (const [i, sortArg] of thisSort.entries()) {
                const value1 = obj1[sortArg.attribute];
                const value2 = obj2[sortArg.attribute];
                const text = texts[i];
                // the text of the value first (setSortValue), then the value: the same text for two
                // values is no tie
                let result = text ? this.compareAscending(text.get(obj1), text.get(obj2), false) : 0;
                if (result === 0) {
                    result = asText[i]
                        ? this.compareAscending(textOrBlank(value1), textOrBlank(value2), false)
                        : this.compareAscending(value1, value2, dayOnly[i]);
                }
                if (result !== 0) {
                    // descending is the ascending result flipped, so blanks end up last
                    return sortArg.ascending === true ? result : -result;
                }
            }
            return 0;
        });

        // set current sort as last sort that was used
        this.lastSorting = this.getOrderBy().slice(0);
    }

    /**
     * compares two values for an ascending sort
     * - blanks (null, undefined, '', invalid Date) are equal to each other and come before any value
     * - 0 and false are real values, so 0 sorts between negative and positive numbers, false before true
     * - strings use the collator when one is set
     * - two dates compare by their timestamp, or by their day only with `dayOnly`
     *
     * Grouping relies on this: values this returns 0 for must end up next to each other
     * and get the same group key.
     */
    private compareAscending(v1: any, v2: any, dayOnly: boolean): number {
        const blank1 = isBlank(v1);
        const blank2 = isBlank(v2);
        if (blank1 || blank2) {
            if (blank1 && blank2) {
                return 0;
            }
            return blank1 ? -1 : 1;
        }

        if (dayOnly) {
            // a `date` field sorts on the day only
            v1 = this.toDay(v1);
            v2 = this.toDay(v2);
        }

        if (v1 === v2) {
            return 0;
        }

        // a string against anything compares as text both ways round. Mixing `localeCompare` one
        // way and `<` the other way made the sort disagree with itself. So do two values of different
        // kinds - a number and a date of a column of several types (dynamicCellTypeColumn): as their text
        if (typeof v1 === 'string' || typeof v2 === 'string' || kindOf(v1) !== kindOf(v2)) {
            const s1 = valueText(v1);
            const s2 = valueText(v2);
            if (s1 === s2) {
                return 0;
            }
            const result = this.localeCompareCode ? this.localeCompareCode.compare(s1, s2) : s1.localeCompare(s2);
            if (result !== 0) {
                return result < 0 ? -1 : 1;
            }
            // different strings the collator calls equal ('a' and 'A' with sensitivity 'base'): by their
            // code points, so the order is the same whatever order they came in. Not 0 - grouping keys
            // them by their own text, equal ones must be the same
            return s1 < s2 ? -1 : 1;
        }

        if (v1 < v2) {
            return -1;
        }
        if (v1 > v2) {
            return 1;
        }
        return 0;
    }

    /**
     * midnight timestamp of a Date, other values are returned as they are
     */
    private toDay(value: any) {
        if (typeof value?.getTime !== 'function') {
            return value;
        }
        return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
    }
}

/** the kind of a value for the sort: a Date, else its typeof */
function kindOf(value: unknown): string {
    return value instanceof Date ? 'date' : typeof value;
}

/**
 * true when the rows have values of more than one kind in a field - a number and a string, a date and
 * a number - blanks left out
 */
function mixedKinds(rows: Entity[], attribute: string): boolean {
    let kind: string | null = null;
    for (const row of rows) {
        const value = row[attribute];
        if (isBlank(value)) {
            continue;
        }
        const each = kindOf(value);
        if (kind === null) {
            kind = each;
        } else if (each !== kind) {
            return true;
        }
    }
    return false;
}

/** a value as its text for the sort (valueText), a blank stays blank */
function textOrBlank(value: unknown): unknown {
    return isBlank(value) ? value : valueText(value);
}
