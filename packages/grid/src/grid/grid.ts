import { GridInterface } from './gridInterface';
import { getElementByClassName } from './getElementByClassName';
import { asPx } from './asPx';
import { Attribute } from './gridConfig';
import { FilterArgument } from '../datasource/types';
import { renderHeaderFilter } from './renderHeaderFilter';
import { renderHeaderSelector } from './renderHeaderSelector';
import { renderRowSelector } from './renderRowSelector';
import { renderRowCell } from './renderRowCell';
import { renderHeaderLabel } from './renderHeaderLabel';
import { renderRowGroup } from './renderRowGroup';
import { generateFilterEditor } from './generateFilterEditor';
import { rebuildTopPanel } from './rebuildTopPanel';
import { rebuildFooter } from './rebuildFooter';
import { rebuildRows } from './rebuildRows';
import { rebuildRowColumns } from './rebuildRowColumns';
import { rebuildHeaderColumns } from './rebuildHeaderColumns';
import { verticalScrollHandler } from './verticalScrollHandler';
import { horizontalScrollHandler } from './horizontalScrollHandler';
import { createDom } from './createDom';
import { updateMainElementSizes } from './updateMainElementSizes';

export const MIDDLE_PINNED_COLTYPE = 'middle-pinned';
export const LEFT_PINNED_COLTYPE = 'left-pinned';
export const RIGH_PINNED_COLTYPE = 'right-pinned';
export const SELECTOR_COLTYPE = 'selector';
export const GROUP_COLTYPE = 'group';

export const DIV = 'DIV';

export type ColumnCache = { column: number; left: number; refID: number };
export type ColType =
    | typeof GROUP_COLTYPE
    | typeof SELECTOR_COLTYPE
    | typeof LEFT_PINNED_COLTYPE
    | typeof MIDDLE_PINNED_COLTYPE
    | typeof RIGH_PINNED_COLTYPE;
export type RowCache = { id: string; row: number; top: number };

export interface HTMLCellElement extends HTMLElement {
    $row: number;
    $column: number;
    $coltype: ColType;
    $celno: number;
    $attribute: string;
}

/**
 * Grid class, this has logic for all scrolling/events
 */
export class Grid {
    public element: HTMLElement;
    public gridInterface: GridInterface<any>;
    public body: HTMLElement;
    // row cache
    public containerGroupRowCache: RowCache[];
    public containerSelectorRowCache: RowCache[];
    public containerLeftRowCache: RowCache[];
    public containerMiddleRowCache: RowCache[];
    public containerRightRowCache: RowCache[];
    // column cache
    public containerLeftColumnCache: ColumnCache[] = [];
    public containerMiddleColumnCache: ColumnCache[] = [];
    public containerRightColumnCache: ColumnCache[] = [];
    // scroll helpers
    public lastScrollTop: number = 0;
    public lastScrollLeft: number = 0;
    public largeScrollLeftTimer: NodeJS.Timeout;
    public largeScrollTopTimer: NodeJS.Timeout;

    public rows: Map<string, HTMLElement> = new Map();
    public columns: Map<string, HTMLElement> = new Map();
    public oldHeight: number;
    public oldWidth: number;
    public resizeTimer: NodeJS.Timeout;
    public resizeInit = false;
    public columnsHeaders: Map<string, HTMLElement> = new Map();
    public skipInitResizeEvent: boolean = false;
    public contextMenu: HTMLElement;
    public filterEditorContainer: HTMLElement;
    public columnChooserMenu: HTMLElement;
    public clickListner: any;
    public focusElement: HTMLInputElement;

    /**
     * only to be used by grid interface
     * @param element
     */
    public connectElement(element: HTMLElement) {
        this.element = element;
        this.element.classList.add('simple-html-grid');
        if (this.gridInterface) {
            this.gridInterface.parseConfig();
            createDom(this);
            this.initResizerEvent();
        }
    }

    /**
     * only to be used by grid interface
     * @param gridInterface
     */
    public connectGridInterface(gridInterface: GridInterface<any>) {
        this.gridInterface = gridInterface;
        this.gridInterface.connectGrid(this);

        if (this.element) {
            this.gridInterface.parseConfig();
            createDom(this);
            this.initResizerEvent();
        }
    }

    public disconnectElement() {
        this.removeContextMenu();

        if (this.filterEditorContainer) {
            document.body.removeChild(this.filterEditorContainer);
            this.filterEditorContainer = null;
        }

        if (this.columnChooserMenu) {
            document.body.removeChild(this.columnChooserMenu);
            this.columnChooserMenu = null;
        }

        if (this.clickListner) {
            document.removeEventListener('click', this.clickListner);
        }

        this.gridInterface.__disconnectGrid();
    }

    public disableResizeEvent() {
        this.skipInitResizeEvent = false;
    }

    public enableResizeEvent() {
        this.skipInitResizeEvent = true;
    }

    public getElement() {
        return this.element;
    }

    public getBody() {
        return this.body;
    }

    /**
     * this just rerenders row values, usefull for selection etc
     */
    public triggerScrollEvent() {
        const elBody = getElementByClassName(this.element, 'simple-html-grid-body-scroller');
        const elMiddle = getElementByClassName(this.element, 'simple-html-grid-middle-scroller');

        function setScrollTop(element: HTMLElement, top: number) {
            element.scrollTop = top;
        }

        setScrollTop(getElementByClassName(this.element, 'simple-html-grid-middle-scroller'), elBody.scrollTop);
        setScrollTop(getElementByClassName(this.element, 'simple-html-grid-body-view-group'), elBody.scrollTop);
        setScrollTop(getElementByClassName(this.element, 'simple-html-grid-body-view-selector'), elBody.scrollTop);
        setScrollTop(getElementByClassName(this.element, 'simple-html-grid-body-view-pinned-left'), elBody.scrollTop);
        setScrollTop(getElementByClassName(this.element, 'simple-html-grid-body-view-pinned-middle'), elBody.scrollTop);
        setScrollTop(getElementByClassName(this.element, 'simple-html-grid-body-view-pinned-right'), elBody.scrollTop);
        horizontalScrollHandler(this, elMiddle.scrollLeft);
        verticalScrollHandler(this, elMiddle.scrollTop);
    }

    /**
     * this needs to be called on large changes, grouping/reorder of columns etc
     * @param rebuildHeader
     *
     */
    public rebuild(rebuildHeader = true) {
        this.gridInterface.__dataSourceUpdated(); // I really only need this for drag/drop
        this.updateHorizontalScrollWidth();
        updateMainElementSizes(this);

        rebuildRows(this);
        rebuildRowColumns(this);
        if (rebuildHeader) {
            rebuildHeaderColumns(this);
        }
        rebuildTopPanel(this);
        rebuildFooter(this);
        this.triggerScrollEvent();
    }

    public initResizerEvent() {
        if (this.skipInitResizeEvent) {
            return;
        }
        new ResizeObserver(() => {
            if (this.resizeInit) {
                if (this.oldHeight !== this.element.clientHeight || this.oldWidth !== this.element.clientWidth) {
                    if (this.oldHeight < this.element.clientHeight || this.oldWidth !== this.element.clientWidth) {
                        this.oldHeight = this.element.clientHeight;
                        this.oldWidth = this.element.clientWidth;
                        if (this.resizeTimer) clearTimeout(this.resizeTimer);
                        this.resizeTimer = setTimeout(() => {
                            this.rebuild();
                        }, 100);
                    }
                }
            } else {
                this.resizeInit = true;
            }
        }).observe(this.element);
    }

    public addClickEventListener() {
        const clickListner = (e: any) => {
            let node = e.target;
            let keep = false;
            while (node) {
                if (node.classList?.contains('simple-html-grid-menu')) {
                    keep = true;
                    break;
                }
                node = node.parentNode;
            }

            if (!keep) {
                this.removeContextMenu();
            }
        };

        document.addEventListener('click', clickListner);
    }

    public getGroupingWidth(coltype: ColType) {
        if (coltype !== LEFT_PINNED_COLTYPE) {
            return 0;
        }

        const grouping = this.gridInterface.getDatasource().getGrouping();
        const groupingWidth = grouping?.length * 15 || 0;

        return groupingWidth;
    }

    /**
     * this adjust viewports, so scrolling height is correct, compared to all rows and its height
     * @param height
     */
    public updateVerticalScrollHeight(height: number = 0) {
        // helper
        function setHeigth(element: HTMLElement, height: number) {
            element.style.height = asPx(height);
        }

        setHeigth(getElementByClassName(this.element, 'simple-html-grid-body-scroller-rows'), height);
        setHeigth(getElementByClassName(this.element, 'simple-html-grid-body-row-container-group'), height);
        setHeigth(getElementByClassName(this.element, 'simple-html-grid-body-row-container-selector'), height);
        setHeigth(getElementByClassName(this.element, 'simple-html-grid-body-row-container-pinned-left'), height);
        setHeigth(getElementByClassName(this.element, 'simple-html-grid-body-row-container-pinned-middle'), height);
        setHeigth(getElementByClassName(this.element, 'simple-html-grid-body-row-container-pinned-right'), height);
        setHeigth(getElementByClassName(this.element, 'simple-html-grid-middle-scroller-body'), height);
    }

    /**
     * helper for autoresize columns
     */
    public getTextWidth(text: string) {
        // if given, use cached canvas for better performance
        // else, create new canvas
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = this.getFont();
        const metrics = context.measureText(text);
        return Math.floor(metrics.width + 5);
    }

    /**
     * opens filter editor with current filter
     */
    public openFilterEditor() {
        this.removeContextMenu();

        const defaultStartFilter: FilterArgument = {
            type: 'GROUP',
            logicalOperator: 'AND',
            filterArguments: []
        };

        const dsFilter = this.gridInterface.getDatasource().getFilter();

        const filterArg = dsFilter?.type === 'GROUP' ? dsFilter : defaultStartFilter;

        if (dsFilter && dsFilter?.type !== 'GROUP' && !Array.isArray(dsFilter)) {
            filterArg.filterArguments = [dsFilter];
        }
        if (Array.isArray(dsFilter) && dsFilter.length) {
            filterArg.filterArguments = dsFilter;
        }

        generateFilterEditor(this, structuredClone(filterArg));
    }

    /**
     * this adjust middle viewport, so scrolling width is correct compared to total columns and their width
     * @param height
     */
    public updateHorizontalScrollWidth() {
        const middlec = getElementByClassName(this.element, 'simple-html-grid-middle-scroller-body');
        middlec.style.width = asPx(
            this.gridInterface
                .__getGridConfig()
                .columnsCenter.map((e) => e.width)
                .reduce((prev, cur) => prev + cur, 0)
        );

        const middlex = getElementByClassName(this.element, 'simple-html-grid-body-row-container-pinned-middle');
        middlex.style.width = asPx(
            this.gridInterface
                .__getGridConfig()
                .columnsCenter.map((e) => e.width)
                .reduce((prev, cur) => prev + cur, 0)
        );
        const middleh = getElementByClassName(this.element, 'simple-html-grid-header-row-container-pinned-middle');
        middleh.style.width = asPx(
            this.gridInterface
                .__getGridConfig()
                .columnsCenter.map((e) => e.width)
                .reduce((prev, cur) => prev + cur, 0)
        );
    }



    /**
     * helper for autoresize columns
     */
    public getFont() {
        const ele = this?.element;
        if (ele) {
            return (
                window.getComputedStyle(ele).getPropertyValue('font-size') +
                ' ' +
                window.getComputedStyle(ele).getPropertyValue('font-family')
            );
        } else {
            return '12px Arial';
        }
    }

    /**
     * filters columns
     * Internal usage only, do not call
     */
    public filterCallback(
        value: string | number | null | undefined,
        col: Attribute,
        filterArray?: any[],
        filterArrayAndValue?: string,
        notinArray?: boolean
    ) {
        switch (col.type) {
            case 'date':
                col.currentFilterValue = this.gridInterface
                    .getDatasource()
                    .getDateFormater()
                    .toDate(value as string);

                break;
            case 'number':
                col.currentFilterValue = value === '' ? null : this.gridInterface
                    .getDatasource()
                    .getNumberFormater()
                    .toNumber(value as string);

                break;
            case 'boolean':
                if (value === '') {
                    col.currentFilterValue = null;
                }
                if (value === 'false') {
                    col.currentFilterValue = false;
                }
                if (value === 'true') {
                    col.currentFilterValue = true;
                }

                break;
            default:
                col.currentFilterValue = filterArrayAndValue ? filterArrayAndValue : value;
        }

        const oldFilter = this.gridInterface.getDatasource().getFilter();
        let filter: FilterArgument = {
            type: 'GROUP',
            logicalOperator: 'AND',
            filterArguments: []
        };

        if (oldFilter?.logicalOperator === 'AND') {
            filter = oldFilter;
            filter.filterArguments = filter.filterArguments.filter((arg: FilterArgument) => {
                if (arg.attribute === col.attribute) {
                    return false;
                } else {
                    return true;
                }
            });
        }

        const keys = Object.keys(this.gridInterface.__getGridConfig().__attributes);
        const columns = keys.map((e) => this.gridInterface.__getGridConfig().__attributes[e]);
        columns.forEach((col) => {
            if (col.currentFilterValue !== null && col.currentFilterValue !== undefined && col.currentFilterValue !== '') {
                filter.filterArguments.push({
                    type: 'CONDITION',
                    logicalOperator: 'NONE',
                    valueType: 'VALUE',
                    attribute: col.attribute,
                    attributeType: (col.type as any) || 'text',
                    operator: col.operator || this.gridInterface.getDatasource().getFilterFromType(col.type),
                    value: col.currentFilterValue as any
                });
            }
        });

        if (filterArray) {
            filter.filterArguments.push({
                type: 'CONDITION',
                logicalOperator: 'NONE',
                valueType: 'VALUE',
                attribute: col.attribute,
                attributeType: (col.type as any) || 'text',
                operator: notinArray ? 'NOT_IN' : 'IN',
                value: filterArray as any
            });
        }

        // just add to beginning, duplicates get removed
        if (filterArrayAndValue) {
            filter.filterArguments.unshift({
                type: 'CONDITION',
                logicalOperator: 'NONE',
                valueType: 'VALUE',
                attribute: col.attribute,
                attributeType: (col.type as any) || 'text',
                operator: 'CONTAINS',
                value: filterArrayAndValue
            });
        }

        // remove duplicates
        const attributes: string[] = [];
        filter.filterArguments = filter.filterArguments.filter((arg: FilterArgument) => {
            if (attributes.indexOf(arg.attribute) !== -1 && arg.operator !== 'IN' && arg.operator !== 'NOT_IN') {
                return false;
            } else {
                attributes.push(arg.attribute);
                return true;
            }
        });

        if (filterArray && !filterArrayAndValue) {
            // we need to clear the value so it does not show
            col.currentFilterValue = '';
        }

        this.gridInterface.getDatasource().filter(filter);
    }

    /**
     * this is called by scrolling/rebuild logic, its job is to pass work to correct rendrer
     * @param cell
     * @param row
     * @param column
     * @param celno
     * @param colType
     */
    public cellRender(cell: HTMLElement, row: number, column: number, celno: number, colType: ColType) {
        const type = cell.getAttribute('type');
        const rowdata = this.gridInterface.getDatasource().getRow(row);

        let attribute: string;
        switch (colType) {
            case GROUP_COLTYPE:
                attribute = null;
                break;
            case SELECTOR_COLTYPE:
                attribute = null;
                break;
            case LEFT_PINNED_COLTYPE:
                attribute = this.gridInterface.__getGridConfig().columnsPinnedLeft[column]?.rows[celno];
                break;
            case MIDDLE_PINNED_COLTYPE:
                attribute = this.gridInterface.__getGridConfig().columnsCenter[column]?.rows[celno];
                break;
            case RIGH_PINNED_COLTYPE:
                attribute = this.gridInterface.__getGridConfig().columnsPinnedRight[column]?.rows[celno];
                break;
        }

        // todo: make type, so its easier to reuse
        (cell as HTMLCellElement).$row = row;
        (cell as HTMLCellElement).$column = column;
        (cell as HTMLCellElement).$coltype = colType;
        (cell as HTMLCellElement).$celno = celno;
        (cell as HTMLCellElement).$attribute = attribute;

        if (colType === GROUP_COLTYPE) {
            renderRowGroup(this, cell as HTMLCellElement, row, column, celno, colType, type, attribute, rowdata);
        }

        if (type === 'label') {
            renderHeaderLabel(this, cell as HTMLCellElement, row, column, celno, colType, type, attribute, rowdata);
        }

        if (type === 'filter') {
            renderHeaderFilter(this, cell as HTMLCellElement, row, column, celno, colType, type, attribute, rowdata);
        }

        if (type === SELECTOR_COLTYPE) {
            renderHeaderSelector(this, cell as HTMLCellElement, row, column, celno, colType, type, attribute, rowdata);
        }

        if (type === null && colType === SELECTOR_COLTYPE) {
            renderRowSelector(this, cell as HTMLCellElement, row, column, celno, colType, type, attribute, rowdata);
        }

        if (type === 'row-cell') {
            renderRowCell(this, cell as HTMLCellElement, row, column, celno, colType, type, attribute, rowdata);
        }
    }

    public clearAllColumnFilters() {
        const datasource = this.gridInterface.getDatasource();
        datasource.setFilter(null);
        const attributes = this.gridInterface.__getGridConfig().__attributes;
        const keys = Object.keys(attributes);
        keys.forEach((key) => {
            attributes[key].currentFilterValue = null;
        });
        rebuildHeaderColumns(this);
        datasource.filter();
    }

    /**
     * helper for column excel similar filter
     * @param attribute
     * @param availableOnly
     * @param searchInput
     * @returns
     */
    public dropDownFilterData(attribute: string, availableOnly: boolean, searchInput: string) {
        const datasource = this.gridInterface.getDatasource();
        const type = this.gridInterface.__getGridConfig().__attributes[attribute].type || 'text';
        let dataFilterSet = new Set();

        if (type !== 'text') {
            return null;
        }

        const data = availableOnly ? datasource.getRows(true) : datasource.getAllData();

        const length = data.length;
        let haveNull = false;
        const search = searchInput && searchInput.replaceAll('%', '').replaceAll('*', '');

        for (let i = 0; i < length; i++) {
            // maybe I should let this be aoption ? the 200 size..
            if (data[i] && data[i][attribute] && dataFilterSet.size < 50) {
                if (typeof data[i][attribute] === 'string') {
                    if (search) {
                        if (data[i][attribute].toLocaleUpperCase().indexOf(search.toLocaleUpperCase()) !== -1) {
                            dataFilterSet.add(data[i][attribute].toLocaleUpperCase());
                        }
                    } else {
                        dataFilterSet.add(data[i][attribute].toLocaleUpperCase());
                    }
                }
                if (typeof data[i][attribute] === 'number') {
                    if (search) {
                        if (data[i][attribute].toString().indexOf(search) !== -1) {
                            dataFilterSet.add(data[i][attribute]);
                        }
                    } else {
                        dataFilterSet.add(data[i][attribute]);
                    }
                }
            } else {
                haveNull = true;
            }
        }

        if (haveNull) {
            dataFilterSet.add('NULL'); // null so we can get the blanks
        }

        const tempArray = Array.from(dataFilterSet).sort();

        if (haveNull) {
            tempArray.unshift('NULL'); // null so we can get the blanks
        }

        const dataFilterSetFull = new Set(tempArray);
        let selectAll = true;

        // check if top level filter have attribute, if so.. use it
        const oldFilter = datasource.getFilter();
        if (oldFilter?.filterArguments?.length) {
            oldFilter?.filterArguments.forEach((f: FilterArgument) => {
                if (f.attribute === attribute) {
                    if (Array.isArray(f.value as any)) {
                        if (f.operator === 'IN') {
                            dataFilterSet = new Set(f.value as any);
                            selectAll = false;
                        }
                        if (f.operator === 'NOT_IN') {
                            const tempSet = new Set(f.value as any);
                            dataFilterSet = new Set(Array.from(dataFilterSetFull).filter((x) => !tempSet.has(x)));
                            selectAll = false;
                        }
                    }
                }
            });
        }

        const dataSize = datasource.getRows(true).length;
        const totalSize = datasource.getAllData().length;
        const filterSetsSameSize = dataFilterSet.size === dataFilterSetFull.size;
        const enableAvailableOnlyOption = dataSize !== totalSize && filterSetsSameSize;

        return {
            enableAvailableOnlyOption,
            dataFilterSet,
            dataFilterSetFull,
            selectAll
        };
    }

    /**
     * gets all attributes displayed
     * @param filterSelectedColumns - by default filters out selected
     * @returns
     */
    public getAttributeColumns(filterSelectedColumns = true) {
        const colLeft = this.gridInterface.__getGridConfig().columnsPinnedLeft.flatMap((e) => e.rows.map((e) => e));
        const colCenter = this.gridInterface.__getGridConfig().columnsCenter.flatMap((e) => e.rows.map((e) => e));
        const colRight = this.gridInterface.__getGridConfig().columnsPinnedRight.flatMap((e) => e.rows.map((e) => e));
        const allAttributes = colLeft.concat(colCenter).concat(colRight);

        let attributes: string[] = [];
        if (filterSelectedColumns && this.gridInterface.__selectedColumns()) {
            allAttributes.forEach((name, i) => {
                if (this.gridInterface.__isColumnSelected(i + 1)) {
                    attributes.push(name);
                }
            });
        } else {
            attributes = allAttributes;
        }

        return attributes;
    }

    /**
     * takes and turn first letter to upper/rest lowercase and lower hyphen into space
     * @param text
     * @returns
     */
    public prettyPrintString(text: string) {
        const prettytext = text
            .split('_')
            .map((e) => e[0].toUpperCase() + e.substring(1, e.length).toLowerCase())
            .join(' ');
        return prettytext;
    }

    /**
     * helper
     */
    public removeContextMenu() {
        if (this.contextMenu) {
            document.body.removeChild(this.contextMenu);
            this.contextMenu = null;
        }
    }
}
