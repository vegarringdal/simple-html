import { createDom } from './gridFunctions/createDom';
import { initResizerEvent } from './gridFunctions/initResizerEvent';
import { rebuildFooter } from './gridFunctions/rebuildFooter';
import { rebuildHeaderColumns } from './gridFunctions/rebuildHeaderColumns';
import { rebuildRowColumns } from './gridFunctions/rebuildRowColumns';
import { rebuildRows } from './gridFunctions/rebuildRows';
import { rebuildTopPanel } from './gridFunctions/rebuildTopPanel';
import { removeContextMenu } from './gridFunctions/removeContextMenu';
import { triggerScrollEvent } from './gridFunctions/triggerScrollEvent';
import { updateHorizontalScrollWidth } from './gridFunctions/updateHorizontalScrollWidth';
import { updateMainElementSizes } from './gridFunctions/updateMainElementSizes';
/**
 * Grid class, this has logic for all scrolling/events
 * most of functionality is moved into function where we pass this context
 */
export class Grid {
    element;
    gridInterface;
    body;
    // row cache
    containerGroupRowCache;
    containerSelectorRowCache;
    containerLeftRowCache;
    containerMiddleRowCache;
    containerRightRowCache;
    // column cache
    containerLeftColumnCache = [];
    containerMiddleColumnCache = [];
    containerRightColumnCache = [];
    // scroll helpers
    lastScrollTop = 0;
    lastScrollLeft = 0;
    largeScrollLeftTimer;
    largeScrollTopTimer;
    rows = new Map();
    columns = new Map();
    oldHeight;
    oldWidth;
    resizeTimer;
    resizeInit = false;
    columnsHeaders = new Map();
    skipInitResizeEvent = false;
    contextMenu;
    filterEditorContainer;
    columnChooserMenu;
    clickListner;
    focusElement;
    domCreated = false;
    /**
     * only to be used by grid interface
     * @param element
     */
    connectElement(element) {
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
    connectGridInterface(gridInterface) {
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
    disconnectElement() {
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
    disableResizeEvent() {
        this.skipInitResizeEvent = false;
    }
    enableResizeEvent() {
        this.skipInitResizeEvent = true;
    }
    getElement() {
        return this.element;
    }
    /**
     * this needs to be called on large changes, grouping/reorder of columns etc
     * @param rebuildHeader
     *
     */
    rebuild(rebuildHeader = true) {
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
//# sourceMappingURL=grid.js.map