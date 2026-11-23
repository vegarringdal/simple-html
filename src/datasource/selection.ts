import type { Datasource } from './dataSource';
import { isGroupRow } from './entity';

export class Selection {
    private selectedRows: number;
    private selection: Set<number | string>;
    /** the anchor of a Shift+click: the last row clicked without Shift, -1 before any */
    private lastRowSelected: number;
    /** the keys a Shift+click keeps: the rows selected at the last Ctrl+click, none after a plain click */
    private keptKeys: (number | string)[];
    private dataSource: Datasource;

    constructor(dataSource: Datasource) {
        this.dataSource = dataSource;
        this.selectedRows = 0;
        this.selection = new Set([]);
        this.lastRowSelected = -1;
        this.keptKeys = [];
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

    /**
     * A click on a row number: selects, adds or removes rows by the keys held - see SelectionMode. As the
     * column numbers (columnSelection.ts):
     * - a plain click selects the row only, it is the anchor
     * - Ctrl+click (Cmd+click on a Mac) adds or removes the row, it is the anchor, the rows selected then
     *   are kept
     * - Shift+click selects from the anchor (see {@link getAnchorRow}) to the row, and the rows kept at
     *   the anchor. So Shift+click again changes the range, and a range made after Ctrl+clicks adds to them
     *
     * In `'single'` mode every click selects the row only. The row is made the current entity,
     * `selection-change` is sent
     * @param e the keys held: a MouseEvent, or `{ ctrlKey: true }` for a click without the keyboard - a
     * finger's tap ({@link toggleRow}), the row menu's Select › (selectRowsTo)
     */
    public highlightRow(
        e: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean },
        currentRow: number,
        overrideSelectionMode?: 'none' | 'single' | 'multiple'
    ): void {
        if (overrideSelectionMode === 'none') {
            return;
        }

        // group header rows can never be selected or be the current entity
        if (isGroupRow(this.dataSource.getRow(currentRow))) {
            return;
        }

        this.dataSource.__select(currentRow);
        if (currentRow > this.dataSource.length() - 1) {
            return;
        }

        const selectionMode = overrideSelectionMode || this.dataSource.getSelectionMode();
        const anchor = this.getAnchorRow();

        if (selectionMode !== 'multiple') {
            this.select(currentRow, false);
        } else if (e.shiftKey && anchor !== -1) {
            // the anchor stays: a Shift+click after it changes the range
            this.lastRowSelected = anchor;
            this.selection = new Set(this.keptKeys);
            for (let i = Math.min(anchor, currentRow); i <= Math.max(anchor, currentRow); i++) {
                this.addRow(i);
            }
            this.selectedRows = this.selection.size;
        } else if (e.ctrlKey || e.metaKey) {
            if (this.isSelected(currentRow)) {
                this.deselect(currentRow);
            } else {
                this.select(currentRow, true);
            }
            this.lastRowSelected = currentRow;
            this.keptKeys = Array.from(this.selection);
        } else {
            // a plain click, or Shift+click with no anchor
            this.select(currentRow, false);
            this.lastRowSelected = currentRow;
            this.keptKeys = [];
        }

        // update selection on rows
        this.dataSource.__callSubscribers('selection-change', {});
    }

    /**
     * The row a Shift+click on a row number selects from, the anchor: the last row clicked without
     * Shift, in or out. Before any click the first selected row (a selection made by code). -1 when
     * there is none, or it is no displayed row any more. For the row menu's Select › (contextmenuRow.ts)
     */
    public getAnchorRow(): number {
        let anchor = this.lastRowSelected;
        if (anchor === -1) {
            const selected = this.getSelectedRows();
            if (selected.length > 0) {
                anchor = selected[0];
            }
        }
        return anchor >= 0 && anchor < this.dataSource.length() ? anchor : -1;
    }

    /**
     * Ctrl+click on a row number, without the keyboard: a finger's tap on a row number, the row menu's
     * Select › This row. The row is made the current entity and `selection-change` is sent:
     * - `'multiple'`: the row in or out of the selection, the others stay - as Ctrl+click, it is the
     *   anchor of a Shift+click after it
     * - `'single'`: a row not selected replaces the one selected, the row selected is deselected
     * - `'none'`: nothing
     */
    public toggleRow(row: number): void {
        const mode = this.dataSource.getSelectionMode();
        if (mode === 'multiple') {
            this.highlightRow({ ctrlKey: true }, row);
        } else if (mode === 'single' && this.isDataRow(row)) {
            if (this.isSelected(row)) {
                this.dataSource.__select(row);
                this.deselect(row);
                this.dataSource.__callSubscribers('selection-change', {});
            } else {
                this.highlightRow({}, row);
            }
        }
    }

    /**
     * Shift+click on a row number, without the keyboard: the row menu's Select › Rows from N to here -
     * the rows from the anchor ({@link getAnchorRow}) to this one. Only in `'multiple'` mode, see
     * highlightRow
     */
    public selectRowsTo(row: number): void {
        if (this.dataSource.getSelectionMode() === 'multiple') {
            this.highlightRow({ shiftKey: true }, row);
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

    /**
     * selects the displayed rows from start to end (the data rows of a group, a click on its row selector)
     * and sends selection-change. Only in 'multiple' mode: in the others nothing changes and nothing is
     * sent - it sent selection-change with nothing selected
     * @param add keep the rows selected already
     */
    public selectRowRange(start: number, end: number, add = false): void {
        if (this.dataSource.getSelectionMode() !== 'multiple') {
            return;
        }
        if (!add) {
            this.selection.clear();
        }

        for (let i = start; i < end + 1; i++) {
            this.addRow(i);
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
     * a row's key changed - acceptChanges() gave a new row the key from the server: when it was
     * selected under the old key, it is selected under the new one
     */
    public replaceKey(oldKey: string | number, newKey: string | number) {
        if (this.selection.delete(oldKey)) {
            this.selection.add(newKey);
        }
        this.selectedRows = this.selection.size;
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
}
