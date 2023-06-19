import { GridInterface } from './gridInterface';
import { rebuildTopPanel } from './gridFunctions/rebuildTopPanel';
import { rebuildFooter } from './gridFunctions/rebuildFooter';
import { rebuildRows } from './gridFunctions/rebuildRows';
import { rebuildRowColumns } from './gridFunctions/rebuildRowColumns';
import { rebuildHeaderColumns } from './gridFunctions/rebuildHeaderColumns';
import { createDom } from './gridFunctions/createDom';
import { updateMainElementSizes } from './gridFunctions/updateMainElementSizes';
import { initResizerEvent } from './gridFunctions/initResizerEvent';
import { triggerScrollEvent } from './gridFunctions/triggerScrollEvent';
import { updateHorizontalScrollWidth } from './gridFunctions/updateHorizontalScrollWidth';
import { RowCache, ColumnCache } from './gridFunctions/colType';
import { removeContextMenu } from './gridFunctions/removeContextMenu';

/**
 * Grid class, this has logic for all scrolling/events
 * most of functionality is moved into function where we pass this context
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

    public domCreated = false;

    /**
     * only to be used by grid interface
     * @param element
     */
    public connectElement(element: HTMLElement) {
        this.element = element;
        this.element.classList.add('simple-html-grid');
        if (this.gridInterface) {
            this.gridInterface.__parseConfig();
            this.gridInterface.__dataSourceUpdated();
            createDom(this);
            this.domCreated = true;
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
            this.gridInterface.__parseConfig();
            this.gridInterface.__dataSourceUpdated();
            createDom(this);
            this.domCreated = true;
            initResizerEvent(this);
        }
    }

    public disconnectElement() {
        removeContextMenu(this);

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

    /**
     * this needs to be called on large changes, grouping/reorder of columns etc
     * @param rebuildHeader
     *
     */
    public rebuild(rebuildHeader = true) {
        // never rebuild if element is not set/columns created
        // incase someone call resize column before grid is generated
        if (!this.element || !this.domCreated) {
            return;
        }

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
}
