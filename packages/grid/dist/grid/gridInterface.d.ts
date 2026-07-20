import type { Datasource } from '../datasource/dataSource';
import type { Entity } from '../datasource/entity';
import type { Grid } from './grid';
import type { GridConfig } from './gridConfig';
export type callF = (...args: any[]) => any;
export type callO = {
    handleEvent: (...args: any[]) => any;
};
export type callable = callF | callO;
/**
 * grid interface is what user have access to controll grid behavior
 */
export declare class GridInterface<T> {
    private grid;
    private gridConfig;
    private dataSource;
    private columnsSelected;
    private scrollTops;
    private scrollHeights;
    private scrollHeight;
    /**
     * for skipping events during setting gridconfig
     */
    private suppressEvents;
    /**
     * for setting readonly based on row values
     */
    private readonlySetterFn;
    /**
     * for adding classes on row lvl
     */
    private cellAppendClassSetterFn;
    /**
     * subscribed listerners, gets called when collection changes/is sorted/filtered etc
     */
    private listeners;
    private initConfig;
    /**
     *
     * @param gridConfig
     * @param datasource
     */
    constructor(gridConfig: GridConfig, datasource: Datasource);
    /**
     * loads init config, useful when saved/loaded many different configs
     */
    loadInitConfig(): void;
    /**
     * in case you need to set new init config, to be used with loadInitConfig()
     * @param gridConfig
     * @param load = false, but can be usedful if you want to update and load it
     */
    updateInitConfig(gridConfig: GridConfig, load?: boolean): void;
    /**
     * do not use - used by grid to connect
     * @param grid
     */
    connectGrid(grid: Grid): void;
    autoResizeColumns(): void;
    /**
     * contextMenu element can be used to attach own context menus
     * practical since it will be removed if new is open/scroll happens
     * @returns
     */
    getContextMenuElement(): HTMLElement;
    /**
     * small helper function to show context menu in same style as the rest
     * @param event
     * @param options
     * @param cell
     * @param callback
     */
    contextMenuCustom(event: MouseEvent, options: {
        label: string;
        value: string;
        isHeader?: boolean;
    }[], cell: HTMLElement, callback: (attribute: string) => void): void;
    /**
     * contextMenu element can be used to attach own context menus
     * practical since it will be removed if new is open/scroll happens
     * @param el
     */
    setContextMenuElement(el: HTMLElement): void;
    /**
     * contextMenu element can be used to attach own context menus
     * practical since it will be removed if new is open/scroll happens
     */
    removeContextMenuElement(): void;
    /**
     * this will force scroll event and update cells
     * usefull if you have done any manual edits to datasource data and want grid updated
     */
    triggerScrollEvent(): void;
    /**
     * when you need to save a copy
     */
    saveConfig(): GridConfig;
    openFilterEditor(): void;
    /**
     * when you need load grid config
     */
    loadConfig(gridConfig: GridConfig, skipRebuild?: boolean): void;
    /**
     * gets columns in order
     * by default it filters out selected columns only
     * @param filterSelectedColumns = true by default
     */
    getAttributeColumns(filterSelectedColumns?: boolean): string[];
    getOptionalAttributes(): string[];
    /**
     * trigger rebuild of all
     */
    triggerRebuild(): void;
    /**
     * adds event listener, useful when you need to do stuff based on
     * @param callable
     */
    addEventListener(callable: callable): void;
    /**
     * this is for enabling readonly based on row data
     * @param callback
     */
    readonlySetter(callback: (attribute: string, rowData: Entity, cellReadOnlyConfig: boolean) => boolean | null): void;
    /**
     * this is for enabling class append to input element and dimmed cell behind it
     * dimmed cell can be used for graphics in class
     * @param callback
     */
    cellAppendClassSetter(callback: (attribute: string, rowData: Entity, cellReadOnlyConfig: boolean) => {
        inputClass: string;
        dimmedClass: string;
    }): void;
    /**
     * removes listener from datasource
     * @param callable
     */
    removeEventListener(callable: callable): void;
    /**
     * current datasource
     * @returns
     */
    getDatasource(): Datasource<T>;
    /**
     * @internal
     * @private
     */
    __parseConfig(): void;
    /**
     * @internal
     * @private
     */
    __getGridConfig(): GridConfig;
    /**
     * @internal
     * @private
     */
    __disconnectGrid(): void;
    /**
     * @internal
     * @private
     */
    __setSelectedColumn(number: number, add?: boolean): void;
    /**
     * @internal
     * @private
     */
    __isColumnSelected(number: number): boolean;
    /**
     * @internal
     * @private
     */
    __selectedColumns(): number;
    /**
     * @internal
     * @private
     */
    __isConnected(): boolean;
    /**
     * @internal
     * @private
     */
    __dataSourceUpdated(): void;
    /**
     * scroll state have all row height and top values
     * this is used during a scroll event to move rows into right height
     * @internal
     * @private
     */
    __getScrollState(): {
        scrollHeight: number;
        scrollHeights: number[];
        scrollTops: number[];
    };
    /**
     * @internal
     * @private
     * called by grid calss
     */
    __callReadonlySetter(attribute: string, rowData: Entity, cellReadOnlyConfig: boolean): boolean;
    /**
     * @internal
     * @private
     * called by grid calss
     */
    __callCellAppendClass(attribute: string, rowData: Entity, cellReadOnlyConfig: boolean): {
        inputClass: string;
        dimmedClass: string;
    };
    /**
     * @internal
     * @private
     * do not use - used to handle event from datasource
     * cant use __ since datasource wants it without
     */
    handleEvent(e: any): boolean;
    /**
     * @internal
     * @private
     * used to call subscribers, used by selection/sorting/filter/grouping controller
     * @param event
     * @param data
     */
    __callSubscribers(event: string, data?: {}): void;
}
//# sourceMappingURL=gridInterface.d.ts.map