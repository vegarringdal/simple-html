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
    // the simple-html-grid element. Empty until createDom builds the grid in it
    public element: HTMLElement;
    // set by connectGridInterface, and createDom, before anything reads them
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
    // true from a menu opening until the task that opened it ends, see showMenu
    public menuJustOpened = false;
    public filterEditorContainer?: HTMLElement | null;
    public columnChooserMenu?: HTMLElement | null;
    public clickListener: any;
    // set by createDom
    public focusElement!: HTMLInputElement;

    public domCreated = false;

    /**
     * @param element the simple-html-grid element the grid is built in
     */
    constructor(element: HTMLElement) {
        this.element = element;
    }

    /**
     * only to be used by grid element
     * called every time the element is added to the dom, also when it is just moved
     */
    public connectElement() {
        // here and not in the constructor: a custom element must not get attributes in its constructor
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
        if (this.element.isConnected) {
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

    /**
     * Removes the element from the dom for good, for `GridInterface.destroy()`: everything
     * disconnectElement() undoes, and the listeners on the element itself
     */
    public destroy() {
        this.element.remove();
        // the element may not have been in the dom, then remove() did not call disconnectedCallback.
        // Running disconnectElement() twice is harmless
        this.disconnectElement();
        this.scrollListenersAbort?.abort();
    }

    /**
     * Stops rebuilding the grid when the element changes size: the resize observer is disconnected,
     * and not made again when the element is put back in the dom. In v5 this did the opposite.
     */
    public disableResizeEvent() {
        this.skipInitResizeEvent = true;
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        clearTimeout(this.resizeTimer ?? undefined);
        this.resizeTimer = null;
    }

    /**
     * Rebuilds the grid when the element changes size again, after disableResizeEvent(). A grid in
     * the dom gets its resize observer back right away. In v5 this did the opposite.
     */
    public enableResizeEvent() {
        this.skipInitResizeEvent = false;
        if (this.domCreated && this.element.isConnected) {
            initResizerEvent(this);
        }
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
        // never rebuild before the dom is created
        // incase someone call resize column before grid is generated
        if (!this.domCreated) {
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
