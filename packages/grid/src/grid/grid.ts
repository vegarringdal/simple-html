import { GridInterface } from './gridInterface';
import { rebuildTopPanel } from './rebuildTopPanel';
import { rebuildFooter } from './rebuildFooter';
import { rebuildRows } from './rebuildRows';
import { rebuildRowColumns } from './rebuildRowColumns';
import { rebuildHeaderColumns } from './rebuildHeaderColumns';
import { createDom } from './createDom';
import { updateMainElementSizes } from './updateMainElementSizes';
import { initResizerEvent } from './initResizerEvent';
import { triggerScrollEvent } from './triggerScrollEvent';
import { updateHorizontalScrollWidth } from './updateHorizontalScrollWidth';

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
            initResizerEvent(this);
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
            initResizerEvent(this);
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
     * this needs to be called on large changes, grouping/reorder of columns etc
     * @param rebuildHeader
     *
     */
    public rebuild(rebuildHeader = true) {
        this.gridInterface.__dataSourceUpdated(); // I really only need this for drag/drop
        updateHorizontalScrollWidth(this);
        updateMainElementSizes(this);

        rebuildRows(this);
        rebuildRowColumns(this);
        if (rebuildHeader) {
            rebuildHeaderColumns(this);
        }
        rebuildTopPanel(this);
        rebuildFooter(this);
        triggerScrollEvent(this);
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
     * helper
     */
    public removeContextMenu() {
        if (this.contextMenu) {
            document.body.removeChild(this.contextMenu);
            this.contextMenu = null;
        }
    }
}
