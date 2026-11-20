import { addBodyClickListener } from './gridFunctions/addBodyClickListener';
import type { ColumnCache, RowCache } from './gridFunctions/colType';
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
import type { GridInterface } from './gridInterface';

/**
 * Grid class, this has logic for all scrolling/events
 * most of functionality is moved into function where we pass this context
 */
export class Grid {
    // set by connectElement/connectGridInterface, and createDom, before anything reads them
    public element!: HTMLElement;
    public gridInterface!: GridInterface<any>;
    public body!: HTMLElement;

    // row cache, set by rebuildRows (createDom)
    public containerGroupRowCache!: RowCache[];
    public containerSelectorRowCache!: RowCache[];
    public containerLeftRowCache!: RowCache[];
    public containerMiddleRowCache!: RowCache[];
    public containerRightRowCache!: RowCache[];

    // column cache
    public containerLeftColumnCache: ColumnCache[] = [];
    public containerMiddleColumnCache: ColumnCache[] = [];
    public containerRightColumnCache: ColumnCache[] = [];

    // scroll helpers
    public lastScrollTop: number = 0;
    public lastScrollLeft: number = 0;
    public largeScrollLeftTimer?: ReturnType<typeof setTimeout> | null;
    public largeScrollTopTimer?: ReturnType<typeof setTimeout> | null;

    public rows: Map<string, HTMLElement> = new Map();
    public columns: Map<string, HTMLElement> = new Map();
    // set by createDom
    public oldHeight!: number;
    public oldWidth!: number;
    public resizeTimer?: ReturnType<typeof setTimeout> | null;
    public resizeObserver?: ResizeObserver | null;
    /** aborts the listeners addScrollEventListeners added, see there */
    public scrollListenersAbort?: AbortController;
    public columnsHeaders: Map<string, HTMLElement> = new Map();
    public skipInitResizeEvent: boolean = false;
    // not there until a menu/editor is opened, null after it is closed
    public contextMenu?: HTMLElement | null;
    public filterEditorContainer?: HTMLElement | null;
    public columnChooserMenu?: HTMLElement | null;
    public clickListener: any;
    // set by createDom
    public focusElement!: HTMLInputElement;

    public domCreated = false;

    /**
     * only to be used by grid interface
     * called every time the element is added to the dom, also when it is just moved
     * @param element
     */
    public connectElement(element: HTMLElement) {
        this.element = element;
        this.element.classList.add('simple-html-grid');
        if (this.gridInterface) {
            this.attach();
        }
    }

    /**
     * only to be used by grid interface
     * @param gridInterface
     */
    public connectGridInterface(gridInterface: GridInterface<any>) {
        // the old interface would keep listening to its datasource and rebuilding this grid
        if (this.gridInterface && this.gridInterface !== gridInterface) {
            this.gridInterface.__disconnectGrid();
        }

        this.gridInterface = gridInterface;
        this.gridInterface.connectGrid(this);

        // not in the dom yet (or removed from it), connectElement does the rest when it is added
        if (this.element?.isConnected) {
            this.attach();
        }
    }

    /**
     * Builds the dom the first time. After that - element moved in the dom, or a new interface
     * connected - the dom is kept, and only the datasource/listeners are hooked back up.
     */
    private attach() {
        // disconnectElement unsubscribed it from the datasource, a moved element needs it back
        if (!this.gridInterface.__isConnected()) {
            this.gridInterface.connectGrid(this);
        }

        if (this.domCreated) {
            addBodyClickListener(this);
            // catch up on data changed while detached, or the new interface/config
            this.rebuild();
            this.oldHeight = this.element.clientHeight;
            this.oldWidth = this.element.clientWidth;
        } else {
            this.gridInterface.__parseConfig();
            this.gridInterface.__dataSourceUpdated();
            createDom(this);
            this.domCreated = true;
        }

        initResizerEvent(this);
    }

    /**
     * called every time the element is removed from the dom, also when it is just moved
     * everything that points from outside the element to the grid is undone here,
     * else the grid (and its datasource) can never be garbage collected
     */
    public disconnectElement() {
        removeContextMenu(this);

        // remove() and not body.removeChild(), the user can already have closed these
        this.filterEditorContainer?.remove();
        this.filterEditorContainer = null;
        this.columnChooserMenu?.remove();
        this.columnChooserMenu = null;

        if (this.clickListener) {
            document.removeEventListener('click', this.clickListener);
            this.clickListener = null;
        }

        this.resizeObserver?.disconnect();
        this.resizeObserver = null;

        // nothing to render into anymore, attach() rebuilds if the element comes back
        // clearTimeout(null) and clearTimeout(undefined) both do nothing
        clearTimeout(this.resizeTimer ?? undefined);
        clearTimeout(this.largeScrollTopTimer ?? undefined);
        clearTimeout(this.largeScrollLeftTimer ?? undefined);
        this.resizeTimer = null;
        this.largeScrollTopTimer = null;
        this.largeScrollLeftTimer = null;

        // the element can be removed before an interface was ever connected
        this.gridInterface?.__disconnectGrid();
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
