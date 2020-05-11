import { Filter } from './filter';
import { Sort } from './sort';
import { Grouping } from './grouping';
import { Selection } from './selection';
import { IEntity, DatasourceConfigOptions, SelectionMode } from './interfaces';
import { DataContainer } from './dataContainer';

type callable = Function | { handleEvent: Function };

/**
 * Helper class for calling internal sort, filter and grouping classes
 *
 */
export class Datasource {
    private __filter: Filter;
    private __sorting: Sort;
    private __grouping: Grouping;
    private __collectionFiltered: IEntity[] = [];
    private __collectionDisplayed: IEntity[] = [];

    private __dataContainer: DataContainer;
    private __selection: Selection;
    private __selectionMode: SelectionMode = 'multiple';

    private __listeners: Set<callable> = new Set();

    public currentEntity: IEntity | null = null;

    constructor(dataContainer?: DataContainer, options?: DatasourceConfigOptions) {
        this.__dataContainer = dataContainer || new DataContainer();
        this.__selectionMode = options?.selectionMode || 'multiple';
        this.__selection = new Selection(this);
        this.__filter = new Filter();
        this.__sorting = new Sort();
        this.__grouping = new Grouping();
    }

    public getAllData(): IEntity[] {
        return this.__dataContainer.getDataSet();
    }

    /**
     * INTERNAL: Used by selection to se new current entity
     * @param row
     */
    public __select(row: number) {
        this.currentEntity = this.__collectionDisplayed[row];
        this.__callSubscribers('currentEntity');
    }

    public setData(data: any[], add = false, reRunFilter = false) {
        if (add) {
            const x = this.__dataContainer.setData(data, add);
            if (x) {
                this.__collectionFiltered.push(...x);
            }
        } else {
            this.__dataContainer.setData(data, add);
            this.__collectionFiltered = this.getAllData().slice();
        }

        // TODO:  rerun filter ?
    }

    sort() {
        // TODO: not started yet

        this.__callSubscribers('collection-sorted');
    }

    filter() {
        // TODO: not started yet
        this.__callSubscribers('collection-filtered');
    }

    group() {
        // TODO: not started yet
        this.__callSubscribers('collection-grouped');
    }

    expandGroup(id: string) {
        // TODO: not started yet
        if (!id) {
            //all
        } else {
            // just the id
        }
        this.__callSubscribers('collection-expand');
    }

    collpseGroup(id: string) {
        // TODO: not started yet
        if (!id) {
            //all
        } else {
            // just the id
        }
        this.__callSubscribers('collection-collapse');
    }

    public __callSubscribers(event: string, data = {}): void {
        this.__listeners.forEach((callable) => {
            if (typeof callable === 'function') {
                callable({ type: event, data: data });
            } else {
                if (typeof callable?.handleEvent === 'function') {
                    callable.handleEvent({ type: event, data: data });
                }
            }
        });
    }

    public addEventListner(callable: callable): void {
        if (typeof callable !== 'function' && typeof callable?.handleEvent !== 'function') {
            throw new Error('callable sent to datasource event listner is wrong type');
        }

        if (!this.__listeners.has(callable)) {
            this.__listeners.add(callable);
        }
    }

    public removeEventListner(callable: callable): void {
        if (this.__listeners.has(callable)) {
            this.__listeners.delete(callable);
        }
    }

    public length(onlyDataRows?: boolean): number {
        if (onlyDataRows) {
            return this.__collectionFiltered.length;
        } else {
            return this.__collectionDisplayed.length;
        }
    }

    public getSelectionMode(): SelectionMode {
        return this.__selectionMode;
    }

    public setSelectionMode(mode: SelectionMode): void {
        this.__selectionMode = mode;
    }

    public getRow(rowNo: number): IEntity {
        return this.__collectionDisplayed[rowNo];
    }

    public getRows(): IEntity[] {
        return this.__collectionDisplayed;
    }

    public select(row: number): void {
        this.__selection.highlightRow({} as any, row - 1);
    }

    public selectFirst(): void {
        this.__selection.highlightRow({} as any, 0);
    }

    public selectPrev(): void {
        let row = this.__collectionDisplayed.indexOf(this.currentEntity) - 1;
        if (row < 0) {
            row = this.__collectionDisplayed.length - 1;
            this.__selection.highlightRow({} as any, row);
        }
        this.__selection.highlightRow({} as any, row);
    }

    public selectNext(): void {
        let row = this.__collectionDisplayed.indexOf(this.currentEntity) + 1;
        if (this.__collectionDisplayed.length - 1 < row) {
            row = 0;
        }
        this.__selection.highlightRow({} as any, row);
    }

    public selectLast(): void {
        this.__selection.highlightRow({} as any, this.__collectionDisplayed.length - 1);
    }
}
