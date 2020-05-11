import { ISortObjectInterface } from './interfaces';

export class Sort {
    private lastSorting: ISortObjectInterface[];
    private currentSorting: ISortObjectInterface[];
    private localeCompareCode: string;
    private localeCompareOptions: any;

    constructor() {
        this.lastSorting = [];
        this.currentSorting = [];
        this.localeCompareCode = null;
        this.localeCompareOptions = { sensitivity: 'base' };
    }

    public setLocaleCompare(code: string, options?: any): void {
        this.localeCompareCode = code ? code : null;
        this.localeCompareOptions = options ? options : { sensitivity: 'base' };
    }

    public reset(defaultSortAttribute?: string): void {
        if (defaultSortAttribute) {
            this.lastSorting = [{ attribute: defaultSortAttribute, asc: true, no: 0 }];
            this.currentSorting = [{ attribute: defaultSortAttribute, asc: true, no: 0 }];
        } else {
            this.lastSorting = [];
            this.currentSorting = [];
        }
    }

    public setLastSort(array: ISortObjectInterface[]): void {
        this.lastSorting = array;
        this.currentSorting = array;
    }

    public setOrderBy(
        param: ISortObjectInterface | string | ISortObjectInterface[],
        add?: boolean
    ): void {
        if (Array.isArray(param)) {
            this.lastSorting = param;
            this.currentSorting = param;
        } else {
            let sort: any;
            if (typeof param === 'string') {
                sort = {
                    attribute: param,
                    asc: true
                };
            } else {
                if (param.asc === undefined) {
                    sort = {
                        attribute: param.attribute,
                        asc: true
                    };
                } else {
                    sort = {
                        attribute: param.attribute,
                        asc: param.asc
                    };
                }
            }

            // do we add or is it the first one
            if (add && this.lastSorting.length > 0) {
                // its adding, so lets get last one
                this.currentSorting = this.lastSorting;
                let exist = false;

                // loop to se if it exist from before
                this.currentSorting.forEach((x) => {
                    if (x.attribute === sort.attribute) {
                        exist = true;
                        x.asc = sort.asc;
                    }
                });

                // if it dont exist we add it, else there isnt anythin else to do for now
                if (!exist) {
                    this.currentSorting.push(sort);
                    const lastItem = this.currentSorting.length - 1;
                    this.currentSorting[lastItem].no = this.currentSorting.length;
                }
                this.lastSorting = this.currentSorting;
            } else {
                // if not adding, just set it
                this.currentSorting = [sort];
                this.currentSorting[0].no = 1;
                this.lastSorting = this.currentSorting;
            }
        }
    }

    public getOrderBy(): ISortObjectInterface[] {
        return this.currentSorting;
    }

    public runOrderbyOn(array: object[]): void {
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
                        resultLocale = v1.localeCompare(
                            v2,
                            this.localeCompareCode,
                            this.localeCompareOptions
                        );
                    } else {
                        resultLocale = v1.localeCompare(v2);
                    }

                    return resultLocale;
                };

                if (v1 !== v2) {
                    if (currentObj.asc) {
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
