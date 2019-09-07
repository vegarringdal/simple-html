import { IColumns, ISortObjectInterface } from './interfaces';

export class ArraySort {
    private lastSort: ISortObjectInterface[];
    private curSort: ISortObjectInterface[];
    private localeCompareCode: string;
    private localeCompareOptions: any;

    constructor() {
        this.lastSort = [];
        this.curSort = [];
        this.localeCompareCode = null;
        this.localeCompareOptions = { sensitivity: 'base' };
    }

    public setLocaleCompare(code: string, options?: any): void {
        this.localeCompareCode = code ? code : null;
        this.localeCompareOptions = options ? options : { sensitivity: 'base' };
    }

    public reset(defaultSortAttribute?: string): void {
        if (defaultSortAttribute) {
            this.lastSort = [{ attribute: defaultSortAttribute, asc: true, no: 0 }];
            this.curSort = [{ attribute: defaultSortAttribute, asc: true, no: 0 }];
        } else {
            this.lastSort = [];
            this.curSort = [];
        }
    }

    public SetConfigSort(configColumns: IColumns[]) {
        const attribute: string[] = [];
        const asc: boolean[] = [];
        const no: number[] = [];
        this.lastSort.forEach(x => {
            attribute.push(x.attribute);
            asc.push(x.asc);
            no.push(x.no);
        });
        configColumns.forEach(col => {
            const i = attribute.indexOf(col.attribute);
            if (i !== -1) {
                col.sortable.sortAscending = asc[i] === true;
                col.sortable.sortNo = no[i];
            } else {
                col.sortable.sortAscending = null;
                col.sortable.sortNo = null;
            }
        });
    }

    public clearConfigSort(configColumns: IColumns[]) {
        configColumns.forEach(col => {
            if (col.sortable) {
                col.sortable.sortAscending = null;
                col.sortable.sortNo = null;
            }
        });
    }

    public setLastSort(array: ISortObjectInterface[]): void {
        this.lastSort = array;
        this.curSort = array;
    }

    public setOrderBy(
        param: ISortObjectInterface | string | ISortObjectInterface[],
        add?: boolean
    ): void {
        if (Array.isArray(param)) {
            this.lastSort = param;
            this.curSort = param;
        } else {
            let sort: any;
            const useSetValue = false;
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
            if (add && this.lastSort.length > 0) {
                // its adding, so lets get last one
                this.curSort = this.lastSort;
                let exist = false;

                // loop to se if it exist from before
                this.curSort.forEach(x => {
                    if (x.attribute === sort.attribute) {
                        exist = true;
                        x.asc = sort.asc;
                    }
                });

                // if it dont exist we add it, else there isnt anythin else to do for now
                if (!exist) {
                    this.curSort.push(sort);
                    this.curSort[this.curSort.length - 1].no = this.curSort.length;
                }
                this.lastSort = this.curSort;
            } else {
                // if not adding, just set it
                this.curSort = [sort];
                this.curSort[0].no = 1;
                if (this.lastSort[0]) {
                    if (this.lastSort[0].attribute === this.curSort[0].attribute) {
                        if (this.lastSort[0].asc === this.curSort[0].asc) {
                            if (!useSetValue) {
                                this.curSort[0].asc = this.curSort[0].asc === true ? false : true;
                            }
                        }
                    }
                }
                this.lastSort = this.curSort;
            }
        }
    }

    public getOrderBy(): ISortObjectInterface[] {
        return this.curSort;
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
                const v1 = obj1[currentObj.attribute];
                const v2 = obj2[currentObj.attribute];

                // compares with locale
                const getLocaleCompareResult = (x1: string, x2: string): number => {
                    let resultLocale = null;
                    if (this.localeCompareCode) {
                        resultLocale = x1.localeCompare(
                            x2,
                            this.localeCompareCode,
                            this.localeCompareOptions
                        );
                    } else {
                        resultLocale = x1.localeCompare(x2);
                    }

                    return resultLocale;
                };

                if (v1 !== v2) {
                    if (currentObj.asc) {
                        // ASC
                        if (typeof v1 === 'string' && typeof v1 === 'string') {
                            if (
                                getLocaleCompareResult(v1, v2) < 0 &&
                                getLocaleCompareResult(v1, v2) !== 0
                            ) {
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
                            if (
                                getLocaleCompareResult(v1, v2) < 0 &&
                                getLocaleCompareResult(v1, v2) !== 0
                            ) {
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
        this.lastSort = this.getOrderBy().slice(0);
    }
}
