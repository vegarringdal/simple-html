import type { Entity } from './entity';
import { isBlank } from './isBlank';
import type { SortArgument } from './sortArgument';

export class Sort {
    private lastSorting: SortArgument[];
    private currentSorting: SortArgument[];
    private localeCompareCode: Intl.Collator | null;
    dates: string[] = [];

    constructor() {
        this.lastSorting = [];
        this.currentSorting = [];
        this.localeCompareCode = null;
    }

    public setDateAttribute(dates: string[] = []) {
        this.dates = dates;
    }

    public setLocaleCompare(code: string, options?: any): void {
        this.localeCompareCode = new Intl.Collator(code, options);
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

        array.sort((obj1: any, obj2: any) => {
            // first sort argument that tells the rows apart decides
            for (const sortArg of thisSort) {
                const isDate = this.dates.indexOf(sortArg.attribute) !== -1;
                const result = this.compareAscending(obj1[sortArg.attribute], obj2[sortArg.attribute], isDate);
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
     *
     * Grouping relies on this: values this returns 0 for must end up next to each other
     * and get the same group key.
     */
    private compareAscending(v1: any, v2: any, isDate: boolean): number {
        const blank1 = isBlank(v1);
        const blank2 = isBlank(v2);
        if (blank1 || blank2) {
            if (blank1 && blank2) {
                return 0;
            }
            return blank1 ? -1 : 1;
        }

        if (isDate) {
            // attributes registered with setDates() sort on the day only
            v1 = this.toDay(v1);
            v2 = this.toDay(v2);
        }

        if (v1 === v2) {
            return 0;
        }

        // a string against anything compares as text both ways round. Mixing `localeCompare` one
        // way and `<` the other way made the sort disagree with itself
        if (typeof v1 === 'string' || typeof v2 === 'string') {
            const s1 = String(v1);
            const s2 = String(v2);
            if (s1 === s2) {
                return 0;
            }
            const result = this.localeCompareCode ? this.localeCompareCode.compare(s1, s2) : s1.localeCompare(s2);
            return result < 0 ? -1 : 1;
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
