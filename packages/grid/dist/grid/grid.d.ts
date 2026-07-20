import type { ColumnCache, RowCache } from './gridFunctions/colType';
import type { GridInterface } from './gridInterface';
/**
 * Grid class, this has logic for all scrolling/events
 * most of functionality is moved into function where we pass this context
 */
export declare class Grid {
    element: HTMLElement;
    gridInterface: GridInterface<any>;
    body: HTMLElement;
    containerGroupRowCache: RowCache[];
    containerSelectorRowCache: RowCache[];
    containerLeftRowCache: RowCache[];
    containerMiddleRowCache: RowCache[];
    containerRightRowCache: RowCache[];
    containerLeftColumnCache: ColumnCache[];
    containerMiddleColumnCache: ColumnCache[];
    containerRightColumnCache: ColumnCache[];
    lastScrollTop: number;
    lastScrollLeft: number;
    largeScrollLeftTimer: ReturnType<typeof setTimeout>;
    largeScrollTopTimer: ReturnType<typeof setTimeout>;
    rows: Map<string, HTMLElement>;
    columns: Map<string, HTMLElement>;
    oldHeight: number;
    oldWidth: number;
    resizeTimer: ReturnType<typeof setTimeout>;
    resizeInit: boolean;
    columnsHeaders: Map<string, HTMLElement>;
    skipInitResizeEvent: boolean;
    contextMenu: HTMLElement;
    filterEditorContainer: HTMLElement;
    columnChooserMenu: HTMLElement;
    clickListner: any;
    focusElement: HTMLInputElement;
    domCreated: boolean;
    /**
     * only to be used by grid interface
     * @param element
     */
    connectElement(element: HTMLElement): void;
    /**
     * only to be used by grid interface
     * @param gridInterface
     */
    connectGridInterface(gridInterface: GridInterface<any>): void;
    disconnectElement(): void;
    disableResizeEvent(): void;
    enableResizeEvent(): void;
    getElement(): HTMLElement;
    /**
     * this needs to be called on large changes, grouping/reorder of columns etc
     * @param rebuildHeader
     *
     */
    rebuild(rebuildHeader?: boolean): void;
}
//# sourceMappingURL=grid.d.ts.map