import type { Datasource } from './dataSource';
export declare class Selection {
    private selectedRows;
    private selection;
    private lastRowSelected;
    private lastKeyKodeUsed;
    private dataSource;
    constructor(dataSource: Datasource);
    isSelected(row: number): boolean;
    /**
     * sleect all of visible rows
     */
    selectAll(): void;
    /**
     * adds to selection
     * @param keys
     */
    addSelectedKeys(keys: any[]): void;
    /**
     *
     * @param truggerEvent
     */
    deSelectAll(truggerEvent?: boolean): void;
    highlightRow(e: MouseEvent, currentRow: number, overrideSelectionMode?: 'none' | 'single' | 'multiple'): void;
    /**
     * todo, optional key
     */
    private getRowKey;
    private getRowKeys;
    private deSelect;
    private select;
    /**
     * internal, does not trigger event
     * @param start
     * @param end
     */
    private selectRange;
    selectRowRange(start: number, end: number, add?: boolean): void;
    /**
     * get selected rows
     * @returns number array
     */
    getSelectedRows(): number[];
    /**
     * returns selection keys
     */
    getSelectedKeys(): (string | number)[];
    /**
     * sets selection keys (replaces old)
     */
    setSelectedKeys(keys: any[]): void;
    /**
     * trigger grid to update row to show selection
     */
    triggerSelectionChange(): void;
    /**
     * selects new rows
     * @param newRows rows to be selected
     */
    private setSelectedRows;
}
//# sourceMappingURL=selection.d.ts.map