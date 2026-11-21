import type { Entity } from '../datasource/entity';
import { addMenuListeners } from './gridFunctions/addMenuListeners';
import type { ColumnCache, RowCache } from './gridFunctions/colType';
import { createDom } from './gridFunctions/createDom';
import { initResizerEvent } from './gridFunctions/initResizerEvent';
import { rebuildFooter } from './gridFunctions/rebuildFooter';
import { rebuildHeaderColumns } from './gridFunctions/rebuildHeaderColumns';
import { rebuildRowColumns } from './gridFunctions/rebuildRowColumns';
import { rebuildRows } from './gridFunctions/rebuildRows';
import { rebuildTopPanel } from './gridFunctions/rebuildTopPanel';
import { removeContextMenu } from './gridFunctions/removeContextMenu';
import { cancelRowsRender } from './gridFunctions/renderChangedRows';
import { closeFilterEditor } from './gridFunctions/renderFilterEditor';
import { closeTextEditor, type TextEditor } from './gridFunctions/textEditor';
import { hideTooltip } from './gridFunctions/tooltip';
import { triggerScrollEvent } from './gridFunctions/triggerScrollEvent';
import { updateHorizontalScrollWidth } from './gridFunctions/updateHorizontalScrollWidth';
import { updateMainElementSizes } from './gridFunctions/updateMainElementSizes';
import type { GridInterface } from './gridInterface';

/**
 * how many grids were made, for the id prefix of each (Grid.ariaIdPrefix)
 */
let gridCount = 0;

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

    // scroll helpers: where the rows / middle columns were last rendered, see the scroll handlers
    public lastScrollTop: number = 0;
    public lastScrollLeft: number = 0;
    // the render of the rows after a large jump, when the scrolling stops: see addScrollEventListeners
    public largeScrollTopTimer?: ReturnType<typeof setTimeout> | null;

    // reactive cells, see renderChangedRows.ts: the rows whose values changed, rendered in the next
    // animation frame (its id, null when none is requested). And a render of every row on screen in
    // that frame, or once the focus leaves the cell a render had to leave out while it was typed in
    public changedRows: Set<Entity> = new Set();
    public rowsFrame: number | null = null;
    public renderAllInFrame = false;
    public renderAllOnFocusOut = false;

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
    // the open menu, a popover: see openMenuElement. Null when no menu is open
    public contextMenu?: HTMLElement | null;
    // the element that had the focus when the open menu opened, see removeContextMenu
    public menuReturnFocus: Element | null = null;
    // true from a menu opening until the task that opened it ends, see openMenuElement
    public menuJustOpened = false;
    // the filter editor, a modal dialog: see renderFilterEditor. Null when it is closed
    public filterEditor?: HTMLDialogElement | null;
    // the column chooser, a popover that stays open while columns are dragged from it
    public columnChooserMenu?: HTMLElement | null;
    // the editor of a multiline cell, a popover over the cell: see openTextEditor. Null when it is closed
    public textEditor: TextEditor | null = null;
    /** aborts the document listeners addMenuListeners added, see there */
    public menuListenersAbort?: AbortController;
    // set by createDom
    public focusElement!: HTMLInputElement;

    /**
     * The grid for a screen reader, and its header rows: see ariaGrid.ts. Made by createDom
     */
    public ariaGrid!: HTMLElement;
    public ariaLabelRow!: HTMLElement;
    public ariaFilterRow!: HTMLElement;
    /**
     * the start of the ids of the elements aria-owns points to: an id is unique in the page, and a
     * page can have several grids
     */
    public readonly ariaIdPrefix = `simple-html-grid-${++gridCount}`;
    /**
     * Tab and Shift+Tab leave the grid from these, at its start and its end: see tabExit.ts. Made by
     * createDom
     */
    public tabExitStart!: HTMLElement;
    public tabExitEnd!: HTMLElement;

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
            addMenuListeners(this);
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
        // the menus and the editors are on the body (or in a dialog), not in the element: they would stay.
        // remove() and not removeChild(), the user can already have closed them.
        // The text of a multiline cell is saved, as a click outside its editor does, while the
        // datasource is still connected
        closeTextEditor(this);
        removeContextMenu(this);
        closeFilterEditor(this);
        this.columnChooserMenu?.remove();
        this.columnChooserMenu = null;
        // shown for a cell of this grid maybe: it is not in the element either
        hideTooltip();

        this.menuListenersAbort?.abort();

        this.resizeObserver?.disconnect();
        this.resizeObserver = null;

        // nothing to render into anymore, attach() rebuilds if the element comes back
        // clearTimeout(null) and clearTimeout(undefined) both do nothing
        clearTimeout(this.resizeTimer ?? undefined);
        clearTimeout(this.largeScrollTopTimer ?? undefined);
        cancelRowsRender(this);
        this.resizeTimer = null;
        this.largeScrollTopTimer = null;

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
