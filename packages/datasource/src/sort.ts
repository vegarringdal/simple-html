import { SortArgument } from './interfaces';
import { Entity } from '@simple-html/grid/src/interfaces';

export class Sort {
    private lastSorting: SortArgument[];
    private currentSorting: SortArgument[];
    private localeCompareCode: Intl.Collator;

    constructor() {
        this.lastSorting = [];
        this.currentSorting = [];
        this.localeCompareCode = null;
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
        // super simple for now.. atleast I have som form for sort
        const thisSort = this.getOrderBy();

        // this is mix from different sources... from what I can tell it works now
        array.sort((obj1: object, obj2: object) => {
            let result = 0;

            for (let i = 0; i < thisSort.length && result === 0; ++i) {
                // loop until all are sorted
                const currentObj = thisSort[i];
                const v1 = obj1[currentObj.attribute] || '';
                const v2 = obj2[currentObj.attribute] || '';

                // compares with locale if set so it handles æ ø etc if needed
                const localCompare = (v1: string, v2: string): number => {
                    let resultLocale = null;

                    if (this.localeCompareCode) {
                        // this just isnt behaving like expecte with norwegian..
                        resultLocale = this.localeCompareCode.compare(v1, v2);
                    } else {
                        resultLocale = v1.localeCompare(v2);
                    }

                    return resultLocale;
                };

                if (v1 !== v2) {
                    if (currentObj.ascending === true) {
                        // ASC
                        if (typeof v1 === 'string' && typeof v1 === 'string') {
                            if (localCompare(v1, v2) < 0 && localCompare(v1, v2) !== 0) {
                                result = -1;
                            } else {
                                result = 1;
                            }
                        } else {
                            if (v1 < v2) {
                                result = -1;
                            } else {
                                result = 1;
                            }
                        }
                    } else {
                        if (typeof v1 === 'string' && typeof v1 === 'string') {
                            if (localCompare(v1, v2) < 0 && localCompare(v1, v2) !== 0) {
                                result = 1;
                            } else {
                                result = -1;
                            }
                        } else {
                            if (v1 < v2) {
                                result = 1;
                            } else {
                                result = -1;
                            }
                        }
                    }
                }
            }

            return result;
        });

        // set current sort as last sort that was used
        this.lastSorting = this.getOrderBy().slice(0);
    }
}
