import type { Datasource } from './dataSource';
import { isGroupRow } from './entity';

export class Selection {
    private selectedRows: number;
    private selection: Set<number | string>;
    private lastRowSelected: number;
    private lastKeyCodeUsed: string;
    private dataSource: Datasource;

    constructor(dataSource: Datasource) {
        this.dataSource = dataSource;
        this.selectedRows = 0;
        this.selection = new Set([]);
        // start as after a plain click on nothing. Left undefined, the first ctrl or shift click
        // matched no case in highlightRow and selected nothing
        this.lastKeyCodeUsed = 'none';
        this.lastRowSelected = -1;
    }

    public isSelected(row: number): boolean {
        let result = false;
        if (this.selectedRows > 0 && this.isDataRow(row)) {
            result = this.selection.has(this.getRowKey(row));
        }

        return result;
    }

    /**
     * selects every displayed data row and sends selection-change - only in 'multiple' mode, in the
     * other modes nothing is selected and nothing is sent
     */
    public selectAll() {
        if (this.dataSource.getSelectionMode() !== 'multiple') {
            return;
        }
        this.selectRange(0, this.dataSource.length() - 1);
        // update selection on rows
        this.dataSource.__callSubscribers('selection-change', {});
    }

    /**
     * adds to selection
     * @param keys
     */
    public addSelectedKeys(keys: any[]) {
        keys.forEach((k) => {
            this.selection.add(k);
        });
        this.selectedRows = this.selection.size;
    }

    /**
     *
     * @param truggerEvent
     */
    public deselectAll(truggerEvent = false): void {
        this.selection.clear();
        this.selectedRows = this.selection.size;
        if (truggerEvent) {
            this.dataSource.__callSubscribers('selection-change', {});
        }
    }

    public highlightRow(e: MouseEvent, currentRow: number, overrideSelectionMode?: 'none' | 'single' | 'multiple'): void {
        if (overrideSelectionMode === 'none') {
            return;
        }

        // group header rows can never be selected or be the current entity
        if (isGroupRow(this.dataSource.getRow(currentRow))) {
            return;
        }

        const selectionMode = overrideSelectionMode || this.dataSource.getSelectionMode();

        let isSel: boolean;
        let currentselectedRows = this.getSelectedRows();
        let currentKeyCode = '';

        this.dataSource.__select(currentRow);

        if (currentRow !== this.lastRowSelected || currentselectedRows[0] !== currentRow) {
            if (currentRow <= this.dataSource.length() - 1) {
                // do I need to check this?

                if (selectionMode === 'multiple') {
                    // if multiselect duh!

                    if (e.shiftKey) {
                        currentKeyCode = 'shift';
                        currentselectedRows = this.getSelectedRows();
                        if (currentselectedRows.length > 0 && this.lastKeyCodeUsed === 'none') {
                            this.lastRowSelected = currentselectedRows[0];
                            this.lastKeyCodeUsed = 'shift';
                        }
                    }

                    if (e.ctrlKey) {
                        currentKeyCode = 'ctrl';
                    }

                    if (!e.ctrlKey && !e.shiftKey) {
                        currentKeyCode = 'none';
                    }

                    switch (true) {
                        case currentKeyCode === 'none':
                            this.select(currentRow, false);
                            break;
                        case this.lastKeyCodeUsed === 'shift' && currentKeyCode === 'ctrl':
                            isSel = this.isSelected(currentRow);
                            if (isSel === true) {
                                this.deselect(currentRow);
                            } else {
                                this.select(currentRow, true);
                            }
                            this.lastRowSelected = currentRow;
                            break;

                        case this.lastKeyCodeUsed === 'ctrl' && currentKeyCode === 'shift': {
                            const oldSel = this.getSelectedRows();
                            this.selectRange(this.lastRowSelected, currentRow);
                            const newSel = this.getSelectedRows();
                            this.setSelectedRows(oldSel.concat(newSel));

                            break;
                        }

                        case this.lastKeyCodeUsed === 'ctrl' && currentKeyCode === 'ctrl':
                            isSel = this.isSelected(currentRow);
                            if (isSel === true) {
                                this.deselect(currentRow);
                            } else {
                                this.select(currentRow, true);
                            }
                            this.lastRowSelected = currentRow;
                            break;

                        case this.lastKeyCodeUsed === 'none' && currentKeyCode === 'ctrl':
                            isSel = this.isSelected(currentRow);
                            if (isSel === true) {
                                this.deselect(currentRow);
                            } else {
                                this.select(currentRow, true);
                            }
                            this.lastRowSelected = currentRow;
                            break;

                        case this.lastKeyCodeUsed === 'shift' && currentKeyCode === 'shift':
                            if (this.lastRowSelected > currentRow) {
                                this.selectRange(currentRow, this.lastRowSelected);
                            } else {
                                this.selectRange(this.lastRowSelected, currentRow);
                            }

                            break;

                        case this.lastKeyCodeUsed === 'none' && currentKeyCode === 'shift':
                            if (this.lastRowSelected !== -1) {
                                if (this.lastRowSelected > currentRow) {
                                    this.selectRange(currentRow, this.lastRowSelected);
                                } else {
                                    this.selectRange(this.lastRowSelected, currentRow);
                                }
                            } else {
                                this.lastRowSelected = currentRow;
                                this.select(currentRow, false);
                            }
                            break;
                        default:
                            console.error('error, this should not happen, debug selection');
                    }
                } else {
                    this.select(currentRow, false);
                }
                this.lastKeyCodeUsed = currentKeyCode;

                // update selection on rows
                this.dataSource.__callSubscribers('selection-change', {});
            }
        } else {
            // same row clicked again
            if (e.ctrlKey) {
                currentKeyCode = 'ctrl';
            }

            // if ctrl button we want to remove selection
            if (currentKeyCode === 'ctrl') {
                this.lastKeyCodeUsed = currentKeyCode;
                isSel = this.isSelected(currentRow);
                if (isSel === true) {
                    this.deselect(currentRow);
                }
                this.lastRowSelected = currentRow;
            } else {
                // else we just want to make it current..
                this.select(currentRow, false);
            }
            // update selection on rows
            this.dataSource.__callSubscribers('selection-change', {});
        }
    }

    /**
     * todo, optional key
     */
    private getRowKey(row: number): string | number {
        return this.dataSource.getRow(row)?.__KEY;
    }

    /**
     * true if the row exists and is not a group header
     */
    private isDataRow(row: number): boolean {
        const entity = this.dataSource.getRow(row);
        return !!entity && !isGroupRow(entity);
    }

    /**
     * adds the key of a row to the selection, skipping group headers and rows that do not exist.
     * Those have no key, and an undefined key in the selection made every group header selected
     */
    private addRow(row: number): void {
        if (this.isDataRow(row)) {
            this.selection.add(this.getRowKey(row));
        }
    }

    private deselect(row: number): void {
        this.selection.delete(this.getRowKey(row));
        this.selectedRows = this.selection.size;
    }

    private select(row: number, add?: boolean): void {
        switch (this.dataSource.getSelectionMode()) {
            case 'none':
            case null:
            case undefined:
                break;
            case 'single':
                this.selection.clear();
                this.addRow(row);
                this.selectedRows = this.selection.size;
                break;
            case 'multiple':
                if (!add) {
                    this.selection.clear();
                    this.addRow(row);
                    this.selectedRows = this.selection.size;
                } else {
                    this.addRow(row);
                    this.selectedRows = this.selection.size;
                }
                break;
            default:
            // nothing-> warn ?
        }
    }

    /**
     * internal, does not trigger event
     * @param start
     * @param end
     */
    private selectRange(start: number, end: number): void {
        if (this.dataSource.getSelectionMode() === 'multiple') {
            this.selection.clear();

            for (let i = start; i < end + 1; i++) {
                this.addRow(i);
            }
            this.selectedRows = this.selection.size;
        }
        this.selectedRows = this.selection.size;
    }

    public selectRowRange(start: number, end: number, add = false): void {
        if (this.dataSource.getSelectionMode() === 'multiple') {
            if (!add) {
                this.selection.clear();
            }

            for (let i = start; i < end + 1; i++) {
                this.addRow(i);
            }
            this.selectedRows = this.selection.size;
        }
        this.selectedRows = this.selection.size;
        this.dataSource.__callSubscribers('selection-change', {});
    }

    /**
     * get selected rows
     * @returns number array
     */
    public getSelectedRows(): number[] {
        const array: number[] = [];
        if (this.selectedRows > 0) {
            this.dataSource.getRows().forEach((row, index) => {
                // group headers have no key, never report them even if undefined got into the selection
                if (!isGroupRow(row) && this.selection.has(row.__KEY)) {
                    array.push(index);
                }
            });
        }

        return array;
    }

    /**
     * returns selection keys
     */
    public getSelectedKeys() {
        return Array.from(this.selection);
    }

    /**
     * sets selection keys (replaces old)
     */
    public setSelectedKeys(keys: any[]) {
        this.selection.clear();
        keys.forEach((k) => {
            this.selection.add(k);
        });
        this.selectedRows = this.selection.size;
    }

    /**
     * trigger grid to update row to show selection
     */
    public triggerSelectionChange() {
        this.dataSource.__callSubscribers('selection-change', {});
    }

    /**
     * selects new rows
     * @param newRows rows to be selected
     */
    private setSelectedRows(newRows: number[]): void {
        if (this.selectedRows > 0) {
            this.selection.clear();
        }
        for (let i = 0; i < newRows.length; i++) {
            this.addRow(newRows[i]);
        }
        this.selectedRows = this.selection.size;
    }
}
