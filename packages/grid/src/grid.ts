import { GridInterface } from './gridInterface';
import { creatElement } from './createElement';
import { getElementByClassName } from './getElementByClassName';
import { asPx } from './asPx';
import { Attribute, Columns } from './gridConfig';
import { html, render, svg } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { Entity, FilterArgument } from '@simple-html/datasource';

const MIDDLE_PINNED_COLTYPE = 'middle-pinned';
const LEFT_PINNED_COLTYPE = 'left-pinned';
const RIGH_PINNED_COLTYPE = 'right-pinned';
const SELECTOR_COLTYPE = 'selector';
const GROUP_COLTYPE = 'group';

const DIV = 'DIV';

type ColumnCache = { column: number; left: number; refID: number };
type ColType =
    | typeof GROUP_COLTYPE
    | typeof SELECTOR_COLTYPE
    | typeof LEFT_PINNED_COLTYPE
    | typeof MIDDLE_PINNED_COLTYPE
    | typeof RIGH_PINNED_COLTYPE;
type RowCache = { id: string; row: number; top: number };

interface HTMLCellElement extends HTMLElement {
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
    private element: HTMLElement;
    private gridInterface: GridInterface;
    private body: HTMLElement;
    // row cache
    private containerGroupRowCache: RowCache[];
    private containerSelectorRowCache: RowCache[];
    private containerLeftRowCache: RowCache[];
    private containerMiddleRowCache: RowCache[];
    private containerRightRowCache: RowCache[];
    // column cache
    private containerLeftColumnCache: ColumnCache[];
    private containerMiddleColumnCache: ColumnCache[];
    private containerRightColumnCache: ColumnCache[];
    // scroll helpers
    private lastScrollTop: number = 0;
    private lastScrollLeft: number = 0;
    private largeScrollLeftTimer: NodeJS.Timeout;
    private largeScrollTopTimer: NodeJS.Timeout;

    private rows: Map<string, HTMLElement> = new Map();
    private columns: Map<string, HTMLElement> = new Map();
    private oldHeight: number;
    private oldWidth: number;
    private resizeTimer: NodeJS.Timeout;
    private resizeInit = false;
    private columnsHeaders: Map<string, HTMLElement> = new Map();
    private skipInitResizeEvent: boolean = false;

    connectElement(element: HTMLElement) {
        this.element = element;
        this.element.classList.add('simple-html-grid');
        if (this.gridInterface) {
            console.time('create');
            this.gridInterface.parseConfig();
            this.createDom();
            this.initResizerEvent();
            console.timeEnd('create');
        }
    }

    connectGridInterface(gridInterface: GridInterface) {
        this.gridInterface = gridInterface;
        this.gridInterface.connectGrid(this);

        if (this.element) {
            console.time('create');
            this.gridInterface.parseConfig();
            this.createDom();
            this.initResizerEvent();
            console.timeEnd('create');
        }
    }

    private initResizerEvent() {
        if (this.skipInitResizeEvent) {
            return;
        }
        new ResizeObserver(() => {
            if (this.resizeInit) {
                if (this.oldHeight !== this.element.clientHeight || this.oldWidth !== this.element.clientWidth) {
                    if (this.resizeTimer) clearTimeout(this.resizeTimer);
                    this.resizeTimer = setTimeout(() => {
                        this.rebuild();
                    }, 100);
                }
            } else {
                this.resizeInit = true;
            }
        }).observe(this.element);
    }

    disconnectElement() {
        this.gridInterface.disconnectGrid();
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

    getBody() {
        return this.body;
    }

    /**
     * this just rerenders row values, usefull for selection etc
     */
    public triggerScrollEvent() {
        const el = getElementByClassName(this.element, 'simple-html-grid-middle-scroller');
        if (true) {
            this.horizontalScrollHandler(el.scrollLeft);
            this.verticalScrollHandler(el.scrollTop);
        }
    }

    /**
     * this needs to be called on large changes, grouping/reorder of columns etc
     * @param rebuildHeader
     */
    public rebuild(rebuildHeader = true) {
        console.time('create');
        this.gridInterface.dataSourceUpdated(); // I really only need this for drag/drop
        this.updateHorizontalScrollWidth();
        this.updateMainElementSizes();

        this.rebuildRows();
        this.rebuildRowColumns();
        if (rebuildHeader) {
            this.rebuildHeaderColumns();
        }
        this.rebuildTopPanel();
        this.rebuildFooter();
        this.triggerScrollEvent();
        console.timeEnd('create');
    }

    private createDom() {
        const panel = creatElement(DIV, 'simple-html-grid-panel');
        const header = creatElement(DIV, 'simple-html-grid-header');
        const body = creatElement(DIV, 'simple-html-grid-body');

        // will be used for scrollbar on right
        const bodyScroller = creatElement(DIV, 'simple-html-grid-body-scroller');
        const bodyScrollerRows = creatElement(DIV, 'simple-html-grid-body-scroller-rows');
        bodyScroller.appendChild(bodyScrollerRows);

        // will be used for scrollbar on middle bottom
        const middleScroller = creatElement(DIV, 'simple-html-grid-middle-scroller');
        const middleScrollerBody = creatElement(DIV, 'simple-html-grid-middle-scroller-body');
        middleScroller.appendChild(middleScrollerBody);

        const footer = creatElement(DIV, 'simple-html-grid-footer');

        this.element.appendChild(panel);
        this.element.appendChild(header);
        this.element.appendChild(body);
        this.element.appendChild(footer);
        this.element.appendChild(bodyScroller);
        this.element.appendChild(middleScroller);

        const headerViewSelector = creatElement(DIV, 'simple-html-grid-header-view-selector');
        const headerViewPinnedLeft = creatElement(DIV, 'simple-html-grid-header-view-pinned-left');
        const headerViewPinnedMiddle = creatElement(DIV, 'simple-html-grid-header-view-pinned-middle');
        const headerViewPinnedRight = creatElement(DIV, 'simple-html-grid-header-view-pinned-right');

        header.appendChild(headerViewSelector);
        header.appendChild(headerViewPinnedLeft);
        header.appendChild(headerViewPinnedMiddle);
        header.appendChild(headerViewPinnedRight);

        const bodyViewGroup = creatElement(DIV, 'simple-html-grid-body-view-group');
        const bodyViewSelector = creatElement(DIV, 'simple-html-grid-body-view-selector');
        const bodyViewPinnedLeft = creatElement(DIV, 'simple-html-grid-body-view-pinned-left');
        const bodyViewPinnedMiddle = creatElement(DIV, 'simple-html-grid-body-view-pinned-middle');
        const bodyViewPinnedRight = creatElement(DIV, 'simple-html-grid-body-view-pinned-right');

        body.appendChild(bodyViewGroup);
        body.appendChild(bodyViewSelector);
        body.appendChild(bodyViewPinnedLeft);
        body.appendChild(bodyViewPinnedMiddle);
        body.appendChild(bodyViewPinnedRight);

        const bodyRowConainerGroup = creatElement(DIV, 'simple-html-grid-body-row-container-group');
        const bodyRowConainerSelector = creatElement(DIV, 'simple-html-grid-body-row-container-selector');
        const bodyRowConainerPinnedLeft = creatElement(DIV, 'simple-html-grid-body-row-container-pinned-left');
        const bodyRowConainerPinnedMiddle = creatElement(DIV, 'simple-html-grid-body-row-container-pinned-middle');
        const bodyRowConainerPinnedRight = creatElement(DIV, 'simple-html-grid-body-row-container-pinned-right');

        bodyViewGroup.appendChild(bodyRowConainerGroup);
        bodyViewSelector.appendChild(bodyRowConainerSelector);
        bodyViewPinnedLeft.appendChild(bodyRowConainerPinnedLeft);
        bodyViewPinnedMiddle.appendChild(bodyRowConainerPinnedMiddle);
        bodyViewPinnedRight.appendChild(bodyRowConainerPinnedRight);

        const headerRowConainerSelector = creatElement(DIV, 'simple-html-grid-header-row-container-selector');
        const headerRowConainerPinnedLeft = creatElement(DIV, 'simple-html-grid-header-row-container-pinned-left');
        const headerRowConainerPinnedMiddle = creatElement(DIV, 'simple-html-grid-header-row-container-pinned-middle');
        const headerRowConainerPinnedRight = creatElement(DIV, 'simple-html-grid-header-row-container-pinned-right');

        headerViewSelector.appendChild(headerRowConainerSelector);
        headerViewPinnedLeft.appendChild(headerRowConainerPinnedLeft);
        headerViewPinnedMiddle.appendChild(headerRowConainerPinnedMiddle);
        headerViewPinnedRight.appendChild(headerRowConainerPinnedRight);

        this.body = body;
        this.updateMainElementSizes();
        this.rebuildRows();
        this.rebuildRowColumns();
        this.rebuildHeaderColumns();
        this.rebuildTopPanel();
        this.rebuildFooter();
        this.addScrollEventListeners();

        this.updateVerticalScrollHeight(this.gridInterface.getScrollState().scrollHeight);
        this.updateHorizontalScrollWidth();
        this.horizontalScrollHandler(0);
        this.verticalScrollHandler(0);
        this.element.appendChild(body);
    }

    private updateMainElementSizes() {
        const config = this.gridInterface.getGridConfig();

        /**
         * main elements
         */

        const leftWidth = config.__leftWidth + this.getGroupingWidth(LEFT_PINNED_COLTYPE);

        const panel = getElementByClassName(this.element, 'simple-html-grid-panel');
        panel.style.height = asPx(config.panelHeight);

        const header = getElementByClassName(this.element, 'simple-html-grid-header');
        header.style.top = asPx(config.panelHeight);
        header.style.height = asPx(config.__rowHeight * 2 + config.selectSizeHeight);

        const body = getElementByClassName(this.element, 'simple-html-grid-body');
        body.style.top = asPx(config.panelHeight + config.__rowHeight * 2 + config.selectSizeHeight);
        body.style.bottom = asPx(config.footerHeight);

        const scrollerBody = getElementByClassName(this.element, 'simple-html-grid-body-scroller');
        scrollerBody.style.top = asPx(config.panelHeight + config.__rowHeight * 2 + config.selectSizeHeight);
        scrollerBody.style.bottom = asPx(config.footerHeight);

        const scrollerMiddle = getElementByClassName(this.element, 'simple-html-grid-middle-scroller');
        scrollerMiddle.style.top = asPx(config.panelHeight + config.__rowHeight * 2 + config.selectSizeHeight);
        scrollerMiddle.style.bottom = asPx(config.footerHeight - config.__scrollbarSize);
        scrollerMiddle.style.left = asPx(config.__selectSizeWidth + leftWidth);
        scrollerMiddle.style.right = asPx(config.__rightWidth + config.__scrollbarSize);

        const footer = getElementByClassName(this.element, 'simple-html-grid-footer');
        footer.style.height = asPx(config.footerHeight);

        /**
         * header viewports
         */

        const headerViewPortSelector = getElementByClassName(this.element, 'simple-html-grid-header-view-selector');
        headerViewPortSelector.style.width = asPx(config.__selectSizeWidth);

        const headerViewPortLeft = getElementByClassName(this.element, 'simple-html-grid-header-view-pinned-left');
        headerViewPortLeft.style.left = asPx(config.__selectSizeWidth);
        headerViewPortLeft.style.width = asPx(leftWidth);
        if (leftWidth === 0) {
            headerViewPortLeft.style.display = 'none';
        } else {
            headerViewPortLeft.style.display = 'block';
        }

        const headerViewPortMiddle = getElementByClassName(this.element, 'simple-html-grid-header-view-pinned-middle');
        headerViewPortMiddle.style.left = asPx(config.__selectSizeWidth + leftWidth);
        headerViewPortMiddle.style.right = asPx(config.__rightWidth);

        const headerViewPortRight = getElementByClassName(this.element, 'simple-html-grid-header-view-pinned-right');
        headerViewPortRight.style.width = asPx(config.__rightWidth);
        if (config.__rightWidth === 0) {
            headerViewPortRight.style.display = 'none';
        } else {
            headerViewPortRight.style.display = 'block';
        }

        /**
         * body viewports
         */

        const bodyViewPortGroup = getElementByClassName(this.element, 'simple-html-grid-body-view-group');
        bodyViewPortGroup.style.left = asPx(config.__selectSizeWidth);
        bodyViewPortGroup.style.right = asPx(config.__scrollbarSize);

        const bodyViewPortSelector = getElementByClassName(this.element, 'simple-html-grid-body-view-selector');
        bodyViewPortSelector.style.width = asPx(config.__selectSizeWidth);

        const bodyViewPortLeft = getElementByClassName(this.element, 'simple-html-grid-body-view-pinned-left');
        bodyViewPortLeft.style.left = asPx(config.__selectSizeWidth);
        bodyViewPortLeft.style.width = asPx(leftWidth);

        const bodyViewPortMiddle = getElementByClassName(this.element, 'simple-html-grid-body-view-pinned-middle');
        bodyViewPortMiddle.style.left = asPx(config.__selectSizeWidth + leftWidth);
        bodyViewPortMiddle.style.right = asPx(config.__rightWidth + config.__scrollbarSize);

        const bodyViewPortRight = getElementByClassName(this.element, 'simple-html-grid-body-view-pinned-right');
        bodyViewPortRight.style.width = asPx(config.__rightWidth);
        bodyViewPortRight.style.right = asPx(config.__scrollbarSize);
        if (config.__rightWidth === 0) {
            bodyViewPortRight.style.display = 'none';
        } else {
            bodyViewPortRight.style.display = 'block';
        }
    }

    /**
     * this also includes some of the grouping logic
     * like adding boxes for gouping
     * logic for removing a group
     * hoving left side of grouping box
     */
    private rebuildTopPanel() {
        const panel = getElementByClassName(this.element, 'simple-html-grid-panel');
        panel.onmousemove = () => {
            if (panel.classList.contains('dragdrop-state') && !panel.classList.contains('simple-html-grid-col-resize-hover')) {
                panel.classList.toggle('simple-html-grid-col-resize-hover');
            }
        };
        panel.onmouseleave = () => {
            if (panel.classList.contains('dragdrop-state')) {
                panel.classList.remove('simple-html-grid-col-resize-hover');
            }
        };

        while (panel.firstChild) {
            panel.removeChild(panel.firstChild);
        }

        const grouping = this.gridInterface.getDatasource().getGrouping();

        grouping.forEach((group) => {
            const label = creatElement('DIV', 'simple-html-grid-panel-label');
            (label as HTMLCellElement).$attribute = group.attribute;
            label.style.width = asPx(this.getTextWidth(group.title) + 20);

            render(
                html`<div>
                    <span class="simple-html-grid-panel-label-text">${group.title}</span>
                    <i
                        class="simple-html-grid-icon-group"
                        @click=${() => {
                            // TODO: look into group logic
                            const updateGrouping = this.gridInterface
                                .getDatasource()
                                .getGrouping()
                                .filter((e) => e.attribute !== group.attribute);
                            if (updateGrouping.length === 0) {
                                this.gridInterface.getDatasource().group([]);
                            } else {
                                this.gridInterface.getDatasource().group(updateGrouping);
                            }

                            this.rebuild();
                        }}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            stroke-width="1.5"
                            stroke="currentColor"
                            class="simple-html-grid-icon-group-svg"
                        >
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </i>
                </div>`,
                label
            );

            const addEvent = (child: HTMLElement, parent: HTMLElement) => {
                child.onmouseenter = () => {
                    if ((parent as HTMLCellElement).$attribute) {
                        child.classList.toggle('simple-html-grid-col-resize-hover');
                    }
                };
                child.onmouseleave = () => {
                    if ((parent as HTMLCellElement).$attribute) {
                        child.classList.toggle('simple-html-grid-col-resize-hover');
                    }
                };
                parent.appendChild(child);
            };

            addEvent(creatElement(DIV, 'simple-html-grid-drop-zone-left-panel'), label);

            panel.appendChild(label);
        });
    }

    private rebuildFooter() {
        const footer = getElementByClassName(this.element, 'simple-html-grid-footer');
        const totalRows = this.gridInterface.getDatasource().getAllData().length;
        const filteredRows = this.gridInterface.getDatasource().length();
        const filterString = this.gridInterface.getDatasource().getFilterString();
        const scrollbarHeight = this.gridInterface.getGridConfig().__scrollbarSize;

        // TODO : add svg to remove filter if any

        render(
            html`<div style="display:flex;flex-direction: column;">
                <div style="flex: 1 1 ${scrollbarHeight}px;"></div>
                <span style="margin:auto">${filteredRows}/${totalRows}</span>
                <span style="margin:auto">${filterString}</span>
            </div>`,
            footer
        );
    }

    private rebuildRows() {
        const scroller = getElementByClassName(this.element, 'simple-html-grid-body-scroller');

        const rect = scroller.getBoundingClientRect();
        const height = rect.height;
        const config = this.gridInterface.getGridConfig();
        const rowsNeeded = Math.floor(height / config.cellHeight) + 5;

        /**
         * helper to generate row elements
         * @param parent
         * @param prefix
         * @returns
         */
        const addRows = (parent: HTMLElement, prefix: string) => {
            const rowCache: RowCache[] = [];

            while (parent.firstChild) {
                parent.removeChild(parent.firstChild);
            }

            for (let i = 0; i < rowsNeeded; i++) {
                const element = creatElement(DIV, 'simple-html-grid-row');
                const top = i * config.__rowHeight;
                const id = prefix + i.toString();
                element.setAttribute('row-id', id);
                element.style.transform = `translate3d(0px, ${top}px, 0px)`;
                element.style.height = asPx(this.gridInterface.getScrollState().scrollHeights[i]);

                if (i % 2 === 0) {
                    element.classList.add('simple-html-grid-row-even');
                } else {
                    element.classList.add('simple-html-grid-row-odd');
                }

                parent.appendChild(element);
                rowCache.push({ id, row: i, top });

                this.rows.set(id, element);
            }
            return rowCache;
        };

        this.rows.clear();

        const containerGroup = getElementByClassName(this.element, 'simple-html-grid-body-row-container-group');
        this.containerGroupRowCache = addRows(containerGroup, GROUP_COLTYPE);

        const containerSelector = getElementByClassName(this.element, 'simple-html-grid-body-row-container-selector');
        this.containerSelectorRowCache = addRows(containerSelector, SELECTOR_COLTYPE);

        const containerLeft = getElementByClassName(this.element, 'simple-html-grid-body-row-container-pinned-left');
        this.containerLeftRowCache = addRows(containerLeft, LEFT_PINNED_COLTYPE);

        const containerMiddle = getElementByClassName(this.element, 'simple-html-grid-body-row-container-pinned-middle');
        this.containerMiddleRowCache = addRows(containerMiddle, MIDDLE_PINNED_COLTYPE);

        const containerRight = getElementByClassName(this.element, 'simple-html-grid-body-row-container-pinned-right');
        this.containerRightRowCache = addRows(containerRight, RIGH_PINNED_COLTYPE);
    }

    /**
     * this also applies on drag/drop logic and resize column
     */
    private rebuildHeaderColumns() {
        const config = this.gridInterface.getGridConfig();

        /**
         * helper to generate cols and rows elements
         */
        const addColumns = (parent: HTMLElement, columns: Columns[], maxColumns: number, coltype: ColType) => {
            let columnsNeeded = maxColumns === 0 ? columns.length : maxColumns;
            if (columns.length < columnsNeeded) {
                columnsNeeded = columns.length;
            }

            if (!parent) {
                console.log('err');
            } else {
                let left = this.getGroupingWidth(coltype);

                while (parent.firstChild) {
                    parent.removeChild(parent.firstChild);
                }
                if (coltype === 'left-pinned') {
                    const columnElement = creatElement(DIV, 'simple-html-grid-grouping-row');
                    columnElement.style.width = asPx(left);
                    if (left === 0) {
                        columnElement.style.display = 'none';
                    }
                    parent.appendChild(columnElement);
                }
                for (let i = 0; i < columnsNeeded; i++) {
                    /**
                     * generate column
                     */

                    const columnElement = creatElement(DIV, 'simple-html-grid-col');

                    columnElement.style.transform = `translate3d(${left}px, 0px, 0px)`;
                    columnElement.style.width = asPx(columns[i].width);
                    columnElement.setAttribute('refID', i.toString());

                    parent.appendChild(columnElement);
                    const id = coltype + i.toString();
                    this.columnsHeaders.set(id, columnElement);

                    left = left + columns[i].width;

                    /**
                     * generate cells
                     */

                    let top = 0;

                    /**
                     * label cells
                     */
                    for (let y = 0; y < config.__columnCells; y++) {
                        const cell = creatElement(DIV, 'simple-html-grid-col-cell');
                        cell.classList.add('simple-html-label');
                        cell.style.top = asPx(top);
                        cell.style.height = asPx(config.cellHeight);
                        cell.setAttribute('type', 'label');
                        cell.setAttribute('cellNo', y.toString());

                        columnElement.appendChild(cell);

                        this.cellRender(cell, 0, i, y, coltype);
                        top = top + config.cellHeight;

                        /**
                         * next part handles drop zones in cells, but only if they are/have attribute set
                         */
                        const addEvent = (child: HTMLElement, parent: HTMLElement) => {
                            child.onmouseenter = () => {
                                if ((parent as HTMLCellElement).$attribute) {
                                    child.classList.toggle('simple-html-grid-col-resize-hover');
                                }
                            };
                            child.onmouseleave = () => {
                                if ((parent as HTMLCellElement).$attribute) {
                                    child.classList.toggle('simple-html-grid-col-resize-hover');
                                }
                            };
                            parent.appendChild(child);
                        };

                        addEvent(creatElement(DIV, 'simple-html-grid-drop-zone-left'), cell);
                        addEvent(creatElement(DIV, 'simple-html-grid-drop-zone-right'), cell);
                        addEvent(creatElement(DIV, 'simple-html-grid-drop-zone-top'), cell);
                        addEvent(creatElement(DIV, 'simple-html-grid-drop-zone-bottom'), cell);
                        addEvent(creatElement(DIV, 'simple-html-grid-drop-zone-center'), cell);

                        /**
                         * logic for dragdrop and sort event
                         */
                        cell.addEventListener('mousedown', (e) => {
                            if (e.button !== 0) {
                                return;
                            }

                            const attribute = (cell as HTMLCellElement).$attribute;
                            const cellno = (cell as HTMLCellElement).$celno;
                            const coltype = (cell as HTMLCellElement).$coltype;
                            const column = (cell as HTMLCellElement).$column;
                            const gridConfig = this.gridInterface.getGridConfig();
                            const mainX = e.clientX;
                            const mainY = e.clientY;

                            let dragElement: HTMLElement;
                            let mouseUp = false;

                            // this is helpr to track if user is clicking or planing to use drag/drop
                            let isClickEvent = setTimeout(() => {
                                if (attribute && !mouseUp) {
                                    isClickEvent = null;

                                    const width = this.getTextWidth(attribute) + 10;
                                    const backgroundColor = getComputedStyle(this.element).getPropertyValue(
                                        '--simple-html-grid-main-bg-color'
                                    );
                                    const fontSize = getComputedStyle(this.element).getPropertyValue(
                                        '--simple-html-grid-font-size'
                                    );
                                    const fontWeight = getComputedStyle(this.element).getPropertyValue(
                                        '--simple-html-grid-font-weight-header'
                                    );
                                    const fontFamily = getComputedStyle(this.element).getPropertyValue(
                                        '--simple-html-grid-font-family'
                                    );

                                    const color = getComputedStyle(this.element).getPropertyValue(
                                        '--simple-html-grid-main-font-color'
                                    );

                                    const boxShadowColor = getComputedStyle(this.element).getPropertyValue(
                                        '--simple-html-grid-boxshadow'
                                    );

                                    const borderColor = getComputedStyle(this.element).getPropertyValue(
                                        '--simple-html-grid-main-bg-border'
                                    );

                                    dragElement = creatElement(DIV, 'simple-html-draggable-element');
                                    dragElement.style.height = asPx(gridConfig.cellHeight);
                                    dragElement.style.width = asPx(width < 100 ? 100 : width);
                                    dragElement.style.backgroundColor = backgroundColor;
                                    dragElement.style.boxShadow = 'inset 1px 1px 3px 0 ' + boxShadowColor;
                                    dragElement.style.outline = '1px solid ' + backgroundColor;
                                    dragElement.style.border = '1px solid ' + borderColor;
                                    dragElement.style.left = asPx(mainX);
                                    dragElement.style.top = asPx(mainY);
                                    dragElement.style.color = color;

                                    const label = creatElement('SPAN', 'simple-html-draggable-element-label');
                                    label.innerText = attribute;
                                    label.style.fontFamily = fontFamily;
                                    label.style.fontWeight = fontWeight;
                                    label.style.fontSize = fontSize;
                                    dragElement.appendChild(label);
                                    const header = getElementByClassName(this.element, 'simple-html-grid-header');
                                    header.classList.toggle('dragdrop-state');

                                    const panel = getElementByClassName(this.element, 'simple-html-grid-panel');
                                    panel.classList.toggle('dragdrop-state');

                                    document.body.appendChild(dragElement);
                                }
                            }, 200);

                            const mousemove = (event: MouseEvent) => {
                                if (dragElement) {
                                    dragElement.style.transform = `translate3d(${event.clientX - mainX}px, ${
                                        event.clientY - mainY
                                    }px, 0px)`;
                                }
                            };

                            const mouseup = (event: MouseEvent) => {
                                if (e.button !== 0) {
                                    return;
                                }

                                mouseUp = true;
                                document.removeEventListener('mousemove', mousemove);
                                document.removeEventListener('mouseup', mouseup);
                                if (dragElement) {
                                    document.body.removeChild(dragElement);
                                    const header = getElementByClassName(this.element, 'simple-html-grid-header');
                                    header.classList.toggle('dragdrop-state');
                                    const panel = getElementByClassName(this.element, 'simple-html-grid-panel');
                                    panel.classList.toggle('dragdrop-state');
                                    panel.classList.remove('simple-html-grid-col-resize-hover');

                                    const classList = (event.target as HTMLElement)?.classList;
                                    const parent = (event.target as HTMLElement).parentElement as HTMLCellElement;

                                    if (parent && classList) {
                                        const newAttribute = (parent as HTMLCellElement).$attribute;
                                        const newCellno = (parent as HTMLCellElement).$celno;
                                        const newColtype = (parent as HTMLCellElement).$coltype;
                                        const newColumn = (parent as HTMLCellElement).$column;
                                        const isPanel = classList?.contains('simple-html-grid-panel');

                                        if ((newAttribute && newAttribute !== attribute) || isPanel) {
                                            const columnCenter = this.gridInterface.getGridConfig().columnsCenter;
                                            const columnLeft = this.gridInterface.getGridConfig().columnsPinnedLeft;
                                            const columnRight = this.gridInterface.getGridConfig().columnsPinnedRight;

                                            switch (true) {
                                                case classList?.contains('simple-html-grid-panel'):
                                                    const newGrouping = this.gridInterface.getDatasource().getGrouping();
                                                    newGrouping.push({ attribute: attribute, title: attribute });
                                                    this.gridInterface.getDatasource().group(newGrouping);

                                                    break;
                                                case classList?.contains('simple-html-grid-drop-zone-left-panel'):
                                                    const updateGrouping = this.gridInterface
                                                        .getDatasource()
                                                        .getGrouping()
                                                        .filter((e) => e.attribute !== attribute);

                                                    let index = 0;
                                                    updateGrouping.forEach((e, i) => {
                                                        if (e.attribute === newAttribute) {
                                                            index = i;
                                                        }
                                                    });
                                                    updateGrouping.splice(index, 0, { attribute: attribute, title: attribute });

                                                    this.gridInterface.getDatasource().group(updateGrouping);

                                                    break;
                                                case classList?.contains('simple-html-grid-drop-zone-left'):
                                                    /**
                                                     * old
                                                     */
                                                    if (coltype === 'left-pinned') {
                                                        columnLeft[column].rows.splice(cellno, 1);
                                                    }

                                                    if (coltype === 'middle-pinned') {
                                                        columnCenter[column].rows.splice(cellno, 1);
                                                    }

                                                    if (coltype === 'right-pinned') {
                                                        columnRight[column].rows.splice(cellno, 1);
                                                    }

                                                    /**
                                                     * new
                                                     */
                                                    if (newColtype === 'left-pinned') {
                                                        columnLeft.splice(newColumn, 0, { rows: [attribute], width: 100 });
                                                    }

                                                    if (newColtype === 'middle-pinned') {
                                                        columnCenter.splice(newColumn, 0, { rows: [attribute], width: 100 });
                                                    }

                                                    if (newColtype === 'right-pinned') {
                                                        columnRight.splice(newColumn, 0, { rows: [attribute], width: 100 });
                                                    }

                                                    this.rebuild();

                                                    break;
                                                case classList?.contains('simple-html-grid-drop-zone-top'):
                                                    /**
                                                     * new
                                                     */
                                                    if (newColtype === 'left-pinned') {
                                                        columnLeft[newColumn].rows.splice(newCellno, 0, attribute);
                                                    }

                                                    if (newColtype === 'middle-pinned') {
                                                        columnCenter[newColumn].rows.splice(newCellno, 0, attribute);
                                                    }

                                                    if (newColtype === 'right-pinned') {
                                                        columnRight[newColumn].rows.splice(newCellno, 0, attribute);
                                                    }
                                                    /**
                                                     * old
                                                     */
                                                    if (coltype === 'left-pinned') {
                                                        columnLeft[column].rows.splice(cellno, 1);
                                                    }

                                                    if (coltype === 'middle-pinned') {
                                                        columnCenter[column].rows.splice(cellno, 1);
                                                    }

                                                    if (coltype === 'right-pinned') {
                                                        columnRight[column].rows.splice(cellno, 1);
                                                    }

                                                    this.rebuild();

                                                    break;
                                                case classList?.contains('simple-html-grid-drop-zone-bottom'):
                                                    /**
                                                     * new
                                                     */
                                                    if (newColtype === 'left-pinned') {
                                                        columnLeft[newColumn].rows.splice(newCellno + 1, 0, attribute);
                                                    }

                                                    if (newColtype === 'middle-pinned') {
                                                        columnCenter[newColumn].rows.splice(newCellno + 1, 0, attribute);
                                                    }

                                                    if (newColtype === 'right-pinned') {
                                                        columnRight[newColumn].rows.splice(newCellno + 1, 0, attribute);
                                                    }
                                                    /**
                                                     * old
                                                     */
                                                    if (coltype === 'left-pinned') {
                                                        columnLeft[column].rows.splice(cellno, 1);
                                                    }

                                                    if (coltype === 'middle-pinned') {
                                                        columnCenter[column].rows.splice(cellno, 1);
                                                    }

                                                    if (coltype === 'right-pinned') {
                                                        columnRight[column].rows.splice(cellno, 1);
                                                    }

                                                    this.rebuild();
                                                    break;
                                                case classList?.contains('simple-html-grid-drop-zone-right'):
                                                    /**
                                                     * old
                                                     */
                                                    if (coltype === 'left-pinned') {
                                                        columnLeft[column].rows.splice(cellno, 1);
                                                    }

                                                    if (coltype === 'middle-pinned') {
                                                        columnCenter[column].rows.splice(cellno, 1);
                                                    }

                                                    if (coltype === 'right-pinned') {
                                                        columnRight[column].rows.splice(cellno, 1);
                                                    }
                                                    /**
                                                     * new
                                                     */
                                                    if (newColtype === 'left-pinned') {
                                                        let x = newColumn + 1;
                                                        columnLeft.splice(x, 0, { rows: [attribute], width: 100 });
                                                    }

                                                    if (newColtype === 'middle-pinned') {
                                                        let x = newColumn + 1;
                                                        columnCenter.splice(x, 0, { rows: [attribute], width: 100 });
                                                    }

                                                    if (newColtype === 'right-pinned') {
                                                        let x = newColumn + 1;
                                                        columnRight.splice(x, 0, { rows: [attribute], width: 100 });
                                                    }

                                                    this.rebuild();

                                                    break;
                                                case classList?.contains('simple-html-grid-drop-zone-center'):
                                                    /**
                                                     * new
                                                     */
                                                    if (newColtype === 'left-pinned') {
                                                        columnLeft[newColumn].rows[newCellno] = attribute;
                                                    }

                                                    if (newColtype === 'middle-pinned') {
                                                        columnCenter[newColumn].rows[newCellno] = attribute;
                                                    }

                                                    if (newColtype === 'right-pinned') {
                                                        columnRight[newColumn].rows[newCellno] = attribute;
                                                    }
                                                    /**
                                                     * old - just replace
                                                     */
                                                    if (coltype === 'left-pinned') {
                                                        columnLeft[column].rows[cellno] = newAttribute;
                                                    }

                                                    if (coltype === 'middle-pinned') {
                                                        columnCenter[column].rows[cellno] = newAttribute;
                                                    }

                                                    if (coltype === 'right-pinned') {
                                                        columnRight[column].rows[cellno] = newAttribute;
                                                    }

                                                    this.rebuild();

                                                    break;
                                            }
                                        }
                                    }
                                }
                                if (isClickEvent && attribute) {
                                    /**
                                     * its a click event
                                     * not we need to get old sorting an and check if we need to reverse it
                                     * if not then we sort in ascending order
                                     */
                                    const sortOrder = this.gridInterface
                                        .getDatasource()
                                        .getLastSorting()
                                        ?.filter((e) => e.attribute === attribute);
                                    if (sortOrder.length) {
                                        this.gridInterface
                                            .getDatasource()
                                            .sort(
                                                { ascending: sortOrder[0].ascending ? false : true, attribute },
                                                event.shiftKey
                                            );
                                    } else {
                                        this.gridInterface.getDatasource().sort({ ascending: true, attribute }, event.shiftKey);
                                    }
                                }
                            };

                            document.addEventListener('mousemove', mousemove);
                            document.addEventListener('mouseup', mouseup);
                        });
                    }

                    /**
                     * input cells
                     */
                    for (let y = 0; y < config.__columnCells; y++) {
                        const cell = creatElement(DIV, 'simple-html-grid-col-cell');
                        cell.style.top = asPx(top);
                        cell.style.height = asPx(config.cellHeight);
                        cell.setAttribute('type', 'filter');
                        cell.setAttribute('cellNo', y.toString());
                        columnElement.appendChild(cell);
                        this.cellRender(cell, 0, i, y, coltype);
                        top = top + config.cellHeight;
                    }

                    /**
                     * column selector
                     */
                    const cell = creatElement(DIV, 'simple-html-grid-col-cell');
                    cell.classList.add('simple-html-label');
                    cell.style.top = asPx(top);
                    cell.style.height = asPx(config.cellHeight);
                    cell.setAttribute('type', SELECTOR_COLTYPE);
                    cell.setAttribute('cellNo', '0');

                    columnElement.appendChild(cell);
                    this.cellRender(cell, 0, i, 0, coltype);

                    /**
                     * logic for reszing column
                     */

                    // create element we use for resizing, right pinned needs own class
                    let resizeElement: HTMLElement;
                    if (coltype === RIGH_PINNED_COLTYPE) {
                        resizeElement = creatElement(DIV, 'simple-html-grid-col-resize-right');
                    } else {
                        resizeElement = creatElement(DIV, 'simple-html-grid-col-resize');
                    }
                    columnElement.appendChild(resizeElement);

                    /**
                     * event for resizing
                     */
                    resizeElement.onmousedown = (event) => {
                        // resizing event started, we need to get refID (created column number)
                        const refID = parseInt((event.target as HTMLElement).parentElement.getAttribute('refID'));

                        // first section here is to collect data we need
                        const clientX = event.clientX;
                        let column: ColumnCache[];
                        let columnNumber: number;
                        let col: Columns;

                        const scrollLeft = getElementByClassName(
                            this.element,
                            'simple-html-grid-body-view-pinned-middle'
                        ).scrollLeft;

                        if (coltype === LEFT_PINNED_COLTYPE) {
                            column = this.containerLeftColumnCache.filter((e) => e.refID === refID);
                            columnNumber = column[0].column;
                            col = this.gridInterface.getGridConfig().columnsPinnedLeft[columnNumber];
                        }

                        if (coltype === MIDDLE_PINNED_COLTYPE) {
                            column = this.containerMiddleColumnCache.filter((e) => e.refID === refID);
                            columnNumber = column[0].column;
                            col = this.gridInterface.getGridConfig().columnsCenter[columnNumber];
                        }

                        if (coltype === RIGH_PINNED_COLTYPE) {
                            column = this.containerRightColumnCache.filter((e) => e.refID === refID);
                            columnNumber = column[0].column;
                            col = this.gridInterface.getGridConfig().columnsPinnedRight[columnNumber];
                        }

                        const originalWidth = col.width;

                        // when user move mouse, we update
                        const mousemove = (event: MouseEvent) => {
                            if (col) {
                                if (coltype === RIGH_PINNED_COLTYPE) {
                                    col.width = originalWidth - (event.clientX - clientX);
                                } else {
                                    col.width = originalWidth + (event.clientX - clientX);
                                }

                                if (col.width < 50) {
                                    col.width = 50;
                                }
                                this.gridInterface.parseConfig();
                                this.updateMainElementSizes();

                                if (coltype === LEFT_PINNED_COLTYPE) {
                                    this.horizontalScrollHandler(0, coltype);
                                    this.horizontalScrollHandler(scrollLeft, MIDDLE_PINNED_COLTYPE);
                                }

                                if (coltype === RIGH_PINNED_COLTYPE) {
                                    this.horizontalScrollHandler(0, coltype);
                                    this.horizontalScrollHandler(scrollLeft, MIDDLE_PINNED_COLTYPE);
                                }

                                if (coltype === MIDDLE_PINNED_COLTYPE) {
                                    this.horizontalScrollHandler(scrollLeft, coltype);
                                }

                                this.verticalScrollHandler(
                                    getElementByClassName(this.element, 'simple-html-grid-body-view-pinned-middle').scrollTop
                                );

                                this.updateHorizontalScrollWidth();
                            }
                        };

                        // when user lets go of mouse button we need to clean up events
                        const mouseup = () => {
                            document.removeEventListener('mousemove', mousemove);
                            document.removeEventListener('mouseup', mouseup);
                        };

                        // add events to when user moves/stops resizing
                        document.addEventListener('mousemove', mousemove);
                        document.addEventListener('mouseup', mouseup);
                    };
                }
            }
        };

        // clear old config
        this.columnsHeaders.clear();

        addColumns(
            getElementByClassName(this.element, 'simple-html-grid-header-row-container-pinned-left'),
            config.columnsPinnedLeft,
            0,
            LEFT_PINNED_COLTYPE
        );

        // get params we will use to apply max columns
        const bodyWidth = getElementByClassName(this.element, 'simple-html-grid-body').clientWidth;
        const middleWidth =
            bodyWidth - (config.__leftWidth + config.__scrollbarSize + config.__rightWidth + config.selectSizeHeight);

        addColumns(
            getElementByClassName(this.element, 'simple-html-grid-header-row-container-pinned-middle'),
            config.columnsCenter,
            middleWidth / 50,
            MIDDLE_PINNED_COLTYPE
        );

        addColumns(
            getElementByClassName(this.element, 'simple-html-grid-header-row-container-pinned-right'),
            config.columnsPinnedRight,
            0,
            RIGH_PINNED_COLTYPE
        );
    }

    private getGroupingWidth(coltype: ColType) {
        if (coltype !== LEFT_PINNED_COLTYPE) {
            return 0;
        }

        const grouping = this.gridInterface.getDatasource().getGrouping();
        const groupingWidth = grouping?.length * 15 || 0;

        return groupingWidth;
    }

    private rebuildRowColumns() {
        const config = this.gridInterface.getGridConfig();

        /**
         * helper to generate cols and rows elements
         */
        const addColumns = (rowId: string, columns: Columns[], maxColumns: number, coltype: ColType) => {
            const parent = this.rows.get(rowId);

            const columnCache: ColumnCache[] = [];
            let columnsNeeded = maxColumns === 0 ? columns.length : maxColumns;
            if (columns.length < columnsNeeded) {
                columnsNeeded = columns.length;
            }

            if (!parent) {
                console.log('err');
            } else {
                let left = this.getGroupingWidth(coltype);
                while (parent.firstChild) {
                    parent.removeChild(parent.firstChild);
                }

                if (coltype === 'left-pinned') {
                    const columnElement = creatElement(DIV, 'simple-html-grid-grouping-row');
                    columnElement.style.width = asPx(left);
                    if (left === 0) {
                        columnElement.style.display = 'none';
                    }
                    parent.appendChild(columnElement);
                }

                for (let i = 0; i < columnsNeeded; i++) {
                    /**
                     * generate column
                     */
                    const columnElement = creatElement(DIV, 'simple-html-grid-col');

                    const id = rowId + ':' + i.toString();
                    this.columns.set(id, columnElement);
                    columnElement.style.transform = `translate3d(${left}px, 0px, 0px)`;
                    columnElement.style.width = asPx(columns[i].width);
                    columnElement.setAttribute('refID', i.toString());
                    parent.appendChild(columnElement);

                    columnCache.push({ column: i, left, refID: i });
                    left = left + columns[i].width;

                    /**
                     * generate cells
                     */

                    for (let y = 0; y < config.__columnCells; y++) {
                        const cellElement = creatElement(DIV, 'simple-html-grid-col-cell');
                        cellElement.style.top = asPx(config.cellHeight * y);
                        cellElement.style.height = asPx(config.cellHeight);
                        cellElement.setAttribute('type', 'row-cell');
                        columnElement.appendChild(cellElement);
                    }
                }
            }

            return columnCache;
        };

        // clear old config
        this.columns.clear();

        this.containerLeftRowCache.forEach((e) => {
            this.containerLeftColumnCache = addColumns(e.id, config.columnsPinnedLeft, 0, LEFT_PINNED_COLTYPE);
        });

        // get params we will use to apply max columns
        const bodyWidth = getElementByClassName(this.element, 'simple-html-grid-body').clientWidth;
        const middleWidth =
            bodyWidth - (config.__leftWidth + config.__scrollbarSize + config.__rightWidth + config.selectSizeHeight);

        this.containerMiddleRowCache.forEach((e) => {
            this.containerMiddleColumnCache = addColumns(e.id, config.columnsCenter, middleWidth / 50, MIDDLE_PINNED_COLTYPE);
        });

        this.containerRightRowCache.forEach((e) => {
            this.containerRightColumnCache = addColumns(e.id, config.columnsPinnedRight, 0, RIGH_PINNED_COLTYPE);
        });
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
     * this adjust middle viewport, so scrolling width is correct compared to total columns and their width
     * @param height
     */
    private updateHorizontalScrollWidth() {
        const middlec = getElementByClassName(this.element, 'simple-html-grid-middle-scroller-body');
        middlec.style.width = asPx(
            this.gridInterface
                .getGridConfig()
                .columnsCenter.map((e) => e.width)
                .reduce((prev, cur) => prev + cur, 0)
        );

        const middlex = getElementByClassName(this.element, 'simple-html-grid-body-row-container-pinned-middle');
        middlex.style.width = asPx(
            this.gridInterface
                .getGridConfig()
                .columnsCenter.map((e) => e.width)
                .reduce((prev, cur) => prev + cur, 0)
        );
        const middleh = getElementByClassName(this.element, 'simple-html-grid-header-row-container-pinned-middle');
        middleh.style.width = asPx(
            this.gridInterface
                .getGridConfig()
                .columnsCenter.map((e) => e.width)
                .reduce((prev, cur) => prev + cur, 0)
        );
    }

    private addScrollEventListeners() {
        const scroller = getElementByClassName(this.element, 'simple-html-grid-body-scroller');

        // helper
        function setScrollTop(element: HTMLElement, top: number) {
            element.scrollTop = top;
        }

        // helper
        function setScrollLeft(element: HTMLElement, left: number) {
            element.scrollLeft = left;
        }

        /**
         * right scrollbar
         */
        scroller.addEventListener(
            'scroll',
            (event) => {
                const x = event.currentTarget as HTMLElement;
                setScrollTop(getElementByClassName(this.element, 'simple-html-grid-middle-scroller'), x.scrollTop);
                setScrollTop(getElementByClassName(this.element, 'simple-html-grid-body-view-group'), x.scrollTop);
                setScrollTop(getElementByClassName(this.element, 'simple-html-grid-body-view-selector'), x.scrollTop);
                setScrollTop(getElementByClassName(this.element, 'simple-html-grid-body-view-pinned-left'), x.scrollTop);
                setScrollTop(getElementByClassName(this.element, 'simple-html-grid-body-view-pinned-middle'), x.scrollTop);
                setScrollTop(getElementByClassName(this.element, 'simple-html-grid-body-view-pinned-right'), x.scrollTop);

                // get scrolltop
                const el = event.target as HTMLElement;
                const scrollTop = el.scrollTop;
                this.verticalScrollHandler(scrollTop);
            },
            { passive: false }
        );

        /**
         * middle scrollbar
         */
        const middle = getElementByClassName(this.element, 'simple-html-grid-middle-scroller');
        middle.addEventListener(
            'scroll',
            (event) => {
                const el = event.currentTarget as HTMLElement;
                setScrollLeft(getElementByClassName(this.element, 'simple-html-grid-body-view-pinned-middle'), el.scrollLeft);
                setScrollLeft(getElementByClassName(this.element, 'simple-html-grid-header-view-pinned-middle'), el.scrollLeft);
                const scrollLeft = el.scrollLeft;
                if (this.lastScrollLeft !== el.scrollLeft) {
                    this.horizontalScrollHandler(scrollLeft);
                }

                setScrollTop(getElementByClassName(this.element, 'simple-html-grid-body-scroller'), el.scrollTop);
            },
            { passive: false }
        );

        /**
         *wheel event, only way to get it unless we disable pointer events
         */
        this.element.addEventListener(
            'wheel',
            (event) => {
                const x = getElementByClassName(this.element, 'simple-html-grid-body-view-pinned-middle');

                const movement = x.scrollTop - (event as any).wheelDeltaY;

                setScrollTop(getElementByClassName(this.element, 'simple-html-grid-body-scroller'), movement);
            },
            { passive: false }
        );
    }

    private verticalScrollHandler(scrollTop: number) {
        if (this.largeScrollTopTimer) {
            return;
        }

        const lastScrollTop = this.lastScrollTop;
        const config = this.gridInterface.getGridConfig();
        const rowTops = this.gridInterface.getScrollState().scrollTops;
        const heights = this.gridInterface.getScrollState().scrollHeights;

        const getTopRow = (fromtop = 0, findTop: number) => {
            let result = 0;
            const tops = this.gridInterface.getScrollState().scrollTops;
            for (let i = fromtop; i < tops.length; i++) {
                if (findTop <= tops[i]) {
                    result = i;
                    break;
                }
            }
            if (fromtop && result === 0) {
                return tops.length;
            }

            return result;
        };

        const scrollEl = getElementByClassName(this.element, 'simple-html-grid-middle-scroller');
        const currentTopRow = getTopRow(0, scrollTop || 0.1);
        const currentBottomRow = getTopRow(currentTopRow, scrollTop + scrollEl.clientHeight);

        let largeScroll = false;

        if (Math.abs(lastScrollTop - scrollTop) > config.__rowHeight * 15) {
            largeScroll = true;
        }

        this.lastScrollTop = scrollTop;

        if (largeScroll) {
            clearTimeout(this.largeScrollTopTimer);

            this.largeScrollTopTimer = setTimeout(() => {
                this.largeScrollTopTimer = null;
                const el = getElementByClassName(this.element, 'simple-html-grid-middle-scroller');
                this.verticalScrollHandler(el.scrollTop);
            }, 100);
        } else {
            const rowsWanted = new Set<number>();

            for (let i = currentTopRow - 1; i < currentBottomRow; i++) {
                rowsWanted.add(i);
            }

            // hack 1 row
            if (currentBottomRow === 0 && currentTopRow === 0 && rowTops.length === 1) {
                rowsWanted.add(0);
            }

            this.containerGroupRowCache.forEach((e) => {
                if (e.row >= 0) {
                    if (!rowsWanted.has(e.row)) {
                        e.row = -1;
                    } else {
                        rowsWanted.delete(e.row);
                    }
                } else {
                    if (e.row <= currentTopRow) {
                        e.row = -1;
                    }
                    if (e.row >= currentBottomRow) {
                        e.row = -1;
                    }
                }
            });

            const rowsWantedArray = Array.from(rowsWanted);

            this.containerGroupRowCache.forEach((e) => {
                if (e.row < 0 && rowsWantedArray.length) {
                    e.row = rowsWantedArray.pop() as any;
                }
            });

            const widths: number[] = [];
            let lastLeft = 0;
            const config = this.gridInterface.getGridConfig();
            config.columnsCenter.forEach((c) => {
                widths.push(c.width);
                lastLeft = lastLeft + c.width;
            });

            const widthsLeft: number[] = [];
            lastLeft = 0;
            config.columnsPinnedLeft.forEach((c) => {
                widthsLeft.push(c.width);
                lastLeft = lastLeft + c.width;
            });

            const widthsRight: number[] = [];
            lastLeft = 0;
            config.columnsPinnedRight.forEach((c) => {
                widthsRight.push(c.width);
                lastLeft = lastLeft + c.width;
            });

            const updateRow = (e: RowCache, colType: ColType) => {
                if (e.row !== -1) {
                    const rowdata = this.gridInterface.getDatasource().getRow(e.row);
                    e.top = rowTops[e.row];
                    const rowEl = this.rows.get(e.id);
                    if (rowEl) {
                        const selection = this.gridInterface.getDatasource().getSelection();

                        rowEl.classList.remove('simple-html-grid-row-even');
                        rowEl.classList.remove('simple-html-grid-row-odd');

                        rowEl.classList.remove('simple-html-grid-selected-row-odd');
                        rowEl.classList.remove('simple-html-grid-selected-row-even');
                        if (selection.isSelected(e.row)) {
                            if (e.row % 2 === 0) {
                                rowEl.classList.add('simple-html-grid-selected-row-even');
                            } else {
                                rowEl.classList.add('simple-html-grid-selected-row-odd');
                            }
                        } else {
                            if (e.row % 2 === 0) {
                                rowEl.classList.add('simple-html-grid-row-even');
                            } else {
                                rowEl.classList.add('simple-html-grid-row-odd');
                            }
                        }

                        rowEl.style.display = 'block';
                        rowEl.style.transform = `translate3d(0px, ${e.top}px, 0px)`;
                        rowEl.style.height = asPx(heights[e.row]);

                        rowEl.classList.remove('simple-html-grid-row-extended');
                        if (heights[e.row] > config.cellHeight) {
                            rowEl.classList.add('simple-html-grid-row-extended');
                        }

                        if (colType === LEFT_PINNED_COLTYPE) {
                            this.containerLeftColumnCache.forEach((x, i) => {
                                const id = e.id + ':' + i.toString();
                                const elc = this.columns.get(id);

                                if (elc && x.column !== -1) {
                                    if (rowdata?.__group) {
                                        elc.style.display = 'none';
                                    } else {
                                        if (elc.style.display !== 'block') {
                                            elc.style.display = 'block';
                                        }

                                        const transform = `translate3d(${x.left}px, 0px, 0px)`;
                                        const width = asPx(widthsLeft[x.column]);

                                        if (transform !== elc.style.transform) {
                                            elc.style.transform = transform;
                                        }
                                        if (width !== elc.style.width) {
                                            elc.style.width = width;
                                        }

                                        for (let cc = 0; cc < elc.children.length; cc++) {
                                            this.cellRender(elc.children[cc] as HTMLElement, e.row, x.column, cc, colType);
                                        }
                                    }
                                }
                            });
                        }
                        if (colType === MIDDLE_PINNED_COLTYPE) {
                            this.containerMiddleColumnCache.forEach((x, i) => {
                                const id = e.id + ':' + i.toString();
                                const colEl = this.columns.get(id);

                                if (colEl && x.column !== -1) {
                                    if (rowdata?.__group) {
                                        colEl.style.display = 'none';
                                    } else {
                                        if (colEl.style.display !== 'block') {
                                            colEl.style.display = 'block';
                                        }

                                        // middle part will need to have to left/widths

                                        const transform = `translate3d(${x.left}px, 0px, 0px)`;
                                        const width = asPx(widths[x.column]);

                                        if (transform !== colEl.style.transform) {
                                            colEl.style.transform = transform;
                                        }
                                        if (width !== colEl.style.width) {
                                            colEl.style.width = width;
                                        }

                                        for (let cc = 0; cc < colEl.children.length; cc++) {
                                            this.cellRender(colEl.children[cc] as HTMLElement, e.row, x.column, cc, colType);
                                        }
                                    }
                                }
                            });
                        }
                        if (colType === RIGH_PINNED_COLTYPE) {
                            this.containerRightColumnCache.forEach((x, i) => {
                                const id = e.id + ':' + i.toString();
                                const colEl = this.columns.get(id);

                                if (colEl && x.column !== -1) {
                                    if (rowdata?.__group) {
                                        colEl.style.display = 'none';
                                    } else {
                                        if (colEl.style.display !== 'block') {
                                            colEl.style.display = 'block';
                                        }

                                        const transform = `translate3d(${x.left}px, 0px, 0px)`;
                                        const width = asPx(widthsRight[x.column]);

                                        if (transform !== colEl.style.transform) {
                                            colEl.style.transform = transform;
                                        }
                                        if (width !== colEl.style.width) {
                                            colEl.style.width = width;
                                        }

                                        for (let cc = 0; cc < colEl.children.length; cc++) {
                                            this.cellRender(colEl.children[cc] as HTMLElement, e.row, x.column, cc, colType);
                                        }
                                    }
                                }
                            });
                        }
                        if (colType === GROUP_COLTYPE) {
                            this.cellRender(rowEl as HTMLElement, e.row, 0, 0, colType);
                        }
                        if (colType === SELECTOR_COLTYPE) {
                            this.cellRender(rowEl as HTMLElement, e.row, 0, 0, colType);
                        }
                    }
                } else {
                    const el = this.rows.get(e.id);
                    if (el) {
                        el.style.display = 'none';
                    }
                }
            };

            this.containerGroupRowCache.forEach((e) => {
                if (e.row) {
                    e.top = rowTops[e.row];
                }

                updateRow(e, GROUP_COLTYPE);
            });

            this.containerSelectorRowCache.forEach((e, i) => {
                e.row = this.containerGroupRowCache[i].row;
                updateRow(e, SELECTOR_COLTYPE);
            });

            this.containerLeftRowCache.forEach((e, i) => {
                e.row = this.containerGroupRowCache[i].row;
                updateRow(e, LEFT_PINNED_COLTYPE);
            });

            this.containerMiddleRowCache.forEach((e, i) => {
                e.row = this.containerGroupRowCache[i].row;
                updateRow(e, MIDDLE_PINNED_COLTYPE);
            });

            this.containerRightRowCache.forEach((e, i) => {
                e.row = this.containerGroupRowCache[i].row;
                updateRow(e, RIGH_PINNED_COLTYPE);
            });
        }
    }

    private horizontalScrollHandler(scrollLeft: number, type: ColType = MIDDLE_PINNED_COLTYPE) {
        const config = this.gridInterface.getGridConfig();

        let columns = config.columnsCenter;
        let columnCache = this.containerMiddleColumnCache;
        let rowCache = this.containerMiddleRowCache;
        let idPrefix: ColType = MIDDLE_PINNED_COLTYPE;

        /**
         * section like left/middle/right side
         */
        let sectionElement = 'simple-html-grid-middle-scroller';

        if (type === LEFT_PINNED_COLTYPE) {
            columns = config.columnsPinnedLeft;
            columnCache = this.containerLeftColumnCache;
            rowCache = this.containerLeftRowCache;
            idPrefix = LEFT_PINNED_COLTYPE;
            sectionElement = 'simple-html-grid-body-view-pinned-left';
        }

        if (type === RIGH_PINNED_COLTYPE) {
            columns = config.columnsPinnedRight;
            columnCache = this.containerRightColumnCache;
            rowCache = this.containerRightRowCache;
            idPrefix = RIGH_PINNED_COLTYPE;
            sectionElement = 'simple-html-grid-body-view-pinned-right';
        }

        if (this.largeScrollLeftTimer) {
            return;
        }

        const lastScrollLeft = this.lastScrollLeft;

        /**
         * build ca
         */
        const colLeft: number[] = [];
        const widths: number[] = [];
        let lastLeft = 0;

        columns.forEach((c) => {
            colLeft.push(lastLeft);
            widths.push(c.width);
            lastLeft = lastLeft + c.width;
        });

        const getLeftCol = (fromLeft = 0, toRight: number) => {
            let result = 0;

            for (let i = fromLeft; i < colLeft.length; i++) {
                if (toRight <= colLeft[i]) {
                    result = i;
                    break;
                }
            }
            if (fromLeft && result === 0) {
                return colLeft.length;
            }

            return result;
        };

        const sectionEl = getElementByClassName(this.element, sectionElement);
        const currentLeftCol = getLeftCol(0, scrollLeft);
        const currentRightCol = getLeftCol(currentLeftCol, scrollLeft + sectionEl.clientWidth) || columnCache.length;

        const scrolllength = Math.abs(lastScrollLeft - scrollLeft);

        let largeScroll = false;
        if (scrolllength > 100) {
            largeScroll = false; // lets disable this for now
        }
        this.lastScrollLeft = scrollLeft;
        if (largeScroll) {
            // large scroll will break logic on moving one and one, why bother
            clearTimeout(this.largeScrollLeftTimer);

            this.largeScrollLeftTimer = setTimeout(() => {
                this.largeScrollLeftTimer = null;

                const el = getElementByClassName(this.element, sectionElement);
                this.lastScrollLeft = el.scrollLeft - 5;
                this.horizontalScrollHandler(el.scrollLeft);
            }, 200);
        } else {
            const rowsWanted = new Set<number>();

            for (let i = currentLeftCol - 1; i < currentRightCol; i++) {
                rowsWanted.add(i);
            }

            columnCache.forEach((e) => {
                if (e.column < currentLeftCol) {
                    e.column = -1;
                }
                if (e.column > currentRightCol) {
                    e.column = -1;
                }
                if (e.column >= 0) {
                    if (!rowsWanted.has(e.column)) {
                        e.column = -1;
                    } else {
                        rowsWanted.delete(e.column);
                    }
                }
            });

            const rowsWantedArray = Array.from(rowsWanted);

            const LeftOffset = this.getGroupingWidth(type);

            columnCache.forEach((e) => {
                if (e.column < 0 && rowsWantedArray.length) {
                    e.column = rowsWantedArray.pop() as any;
                }
                e.left = colLeft[e.column] + LeftOffset;
            });

            rowCache.forEach((e) => {
                if (e.row !== -1) {
                    columnCache.forEach((x, i) => {
                        const id = e.id + ':' + i.toString();
                        const colEl = this.columns.get(id);

                        if (x.column === -1) {
                            if (colEl) {
                                colEl.style.display = 'none';
                            }
                            const header = this.columnsHeaders.get(idPrefix + i.toString());
                            if (header) {
                                header.style.display = 'none';
                            }
                        } else {
                            /**
                             * rows
                             */

                            if (colEl) {
                                const rowdata = this.gridInterface.getDatasource().getRow(e.row);
                                if (rowdata?.__group) {
                                    colEl.style.display = 'none';
                                } else {
                                    colEl.style.display = 'block';
                                    const transform = `translate3d(${x.left}px, 0px, 0px)`;
                                    const width = asPx(widths[x.column]);

                                    if (transform !== colEl.style.transform) {
                                        colEl.style.transform = transform;
                                        for (let c = 0; c < colEl.children.length; c++) {
                                            this.cellRender(colEl.children[c] as HTMLElement, e.row, x.column, c, idPrefix);
                                        }
                                    }
                                    if (width !== colEl.style.width) {
                                        colEl.style.width = width;
                                    }
                                }
                            }

                            /**
                             * header
                             */
                            const header = this.columnsHeaders.get(idPrefix + i.toString());
                            if (header) {
                                header.style.display = 'block';
                                const transform = `translate3d(${x.left}px, 0px, 0px)`;
                                const width = asPx(widths[x.column]);

                                if (transform !== header.style.transform) {
                                    header.style.transform = transform;

                                    for (let c = 0; c < header.children.length; c++) {
                                        const cellNo = parseInt(header.children[c].getAttribute('cellNo'));
                                        this.cellRender(header.children[c] as HTMLElement, 0, x.column, cellNo, idPrefix);
                                    }
                                }
                                if (width !== header.style.width) {
                                    header.style.width = width;
                                }
                            }
                        }
                    });
                }
            });
        }
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
        return metrics.width + 5;
    }

    /**
     * helper for autoresize columns
     */
    private getFont() {
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
    private filterCallback(
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
                col.currentFilterValue = this.gridInterface
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

        const keys = Object.keys(this.gridInterface.getGridConfig().attributes);
        const columns = keys.map((e) => this.gridInterface.getGridConfig().attributes[e]);
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

    private renderRowGroup(
        cell: HTMLCellElement,
        _row: number,
        column: number,
        _celno: number,
        colType: ColType,
        _cellType: string,
        _attribute: string,
        rowData: Entity
    ) {
        if (rowData.__group) {
            cell.style.display = 'block';
            cell.style.zIndex = '10';
        } else {
            cell.style.display = 'none';
        }

        // TODO: I do not like how hardcoded grouping indent is
        // add it as a option

        render(
            html`<div
                class="simple-html-absolute-fill simple-html-label-group"
                style="padding-left:${rowData.__groupLvl * 15}px"
                @click=${() => {
                    console.log('column selected:', column, colType);
                }}
            >
                <div
                    class="simple-html-grid-grouping-row"
                    style="width:${rowData.__groupLvl * 15}px;display:${rowData.__groupLvl ? 'block' : 'none'}"
                ></div>
                <i
                    @click=${() => {
                        if (rowData.__groupExpanded) {
                            this.gridInterface.getDatasource().collapseGroup(rowData.__groupID);
                        } else {
                            this.gridInterface.getDatasource().expandGroup(rowData.__groupID);
                        }
                    }}
                >
                    <svg class="simple-html-grid-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
                        ${rowData.__groupExpanded
                            ? svg`<path d="M4.8 7.5h6.5v1H4.8z" />`
                            : svg`<path d="M7.4 4.8v2.7H4.7v1h2.7v3h1v-3h2.8v-1H8.5V4.8h-1z" />`}
                    </svg></i
                >
                <span class=""> ${rowData.__groupName} (${rowData.__groupTotal})</span>
            </div>`,
            cell as any
        );
    }

    private renderHeaderLabel(
        cell: HTMLCellElement,
        _row: number,
        _column: number,
        _celno: number,
        _colType: ColType,
        _cellType: string,
        attribute: string,
        _rowData: Entity
    ) {
        /**
         * first get sort logic
         */
        let iconAsc: any = '';
        this.gridInterface
            .getDatasource()
            .getLastSorting()
            .forEach((sort, i) => {
                if (sort.attribute === attribute) {
                    iconAsc = html`<i class="simple-html-grid-sort-number" data-sortno=${i + 1}>
                        <svg class="simple-html-grid-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
                            ${sort.ascending
                                ? svg`<path d="M7.4 6L3 10h1.5L8 7l3.4 3H13L8.5 6h-1z" />`
                                : svg`<path d="M7.4 10L3 6h1.5L8 9.2 11.3 6H13l-4.5 4h-1z" />`}
                        </svg></i
                    >`;
                }
            });

        const value = attribute;
        if (attribute) {
            render(
                html`<div
                    class="simple-html-label"
                    @contextmenu=${(e: any) => {
                        e.preventDefault();
                        console.log('context menu call on label');
                    }}
                >
                    ${value} ${iconAsc}
                </div>`,
                cell as any
            );
        } else {
            render(html`<div class="simple-html-dimmed"></div>`, cell as any);
        }
    }

    private renderHeaderFilter(
        cell: HTMLCellElement,
        _row: number,
        _column: number,
        _celno: number,
        _colType: ColType,
        _cellType: string,
        attribute: string,
        _rowData: Entity
    ) {
        if (attribute) {
            const cellConfig = this.gridInterface.getGridConfig().attributes[attribute];

            const placeHolder = cellConfig.placeHolder || '🔍';
            let currentValue = cellConfig.currentFilterValue || ('' as any);

            if (cellConfig?.type === 'date') {
                currentValue = this.gridInterface.getDatasource().getDateFormater().fromDate(currentValue);
            }

            // stop duplicate events
            let filterRunning = false;

            if (cellConfig.type === 'boolean') {
                render(
                    html`<input
                        type="checkbox"
                        .checked=${live(currentValue)}
                        .indeterminate=${currentValue !== true && currentValue !== false}
                        placeholder=${placeHolder}
                        @contextmenu=${(e: any) => {
                            e.preventDefault();
                            console.log('context menu call on filter');
                        }}
                        @change=${(e: any) => {
                            if (!filterRunning) {
                                filterRunning = true;

                                switch (true) {
                                    case currentValue === '' &&
                                        (e.target as any).checked === true &&
                                        e.target.indeterminate === false:
                                        this.filterCallback((e.target as any).checked.toString(), cellConfig);
                                        currentValue = (e.target as any).checked.toString();
                                        break;
                                    case currentValue === 'true' &&
                                        (e.target as any).checked === false &&
                                        e.target.indeterminate === false:
                                        this.filterCallback((e.target as any).checked.toString(), cellConfig);
                                        currentValue = (e.target as any).checked.toString();
                                        break;
                                    case currentValue === 'false' &&
                                        (e.target as any).checked === true &&
                                        e.target.indeterminate === false:
                                        this.filterCallback('', cellConfig);
                                        e.target.indeterminate = true;
                                        (e.target as any).checked = false;
                                        currentValue = '';
                                }

                                filterRunning = false;
                            }
                        }}
                    />`,
                    cell as any
                );
            } else {
                render(
                    html`<input
                        style=${cellConfig?.type === 'number' ? 'text-align: right' : ''}
                        .value=${live(currentValue)}
                        placeholder=${placeHolder}
                        @contextmenu=${(e: any) => {
                            e.preventDefault();
                            console.log('context menu call on filter');
                        }}
                        @keydown=${(e: KeyboardEvent) => {
                            const keycode = e.keyCode ? e.keyCode : e.which;
                            if (keycode === 13) {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!filterRunning) {
                                    filterRunning = true;
                                    this.filterCallback((e.target as any).value, cellConfig);
                                    filterRunning = false;
                                }
                            }
                        }}
                        @change=${(e: any) => {
                            if (!filterRunning) {
                                filterRunning = true;
                                this.filterCallback((e.target as any).value, cellConfig);
                                filterRunning = false;
                            }
                        }}
                    />`,
                    cell as any
                );
            }
        } else {
            render(html`<div class="simple-html-dimmed"></div>`, cell as any);
        }
    }

    private renderHeaderSelector(
        cell: HTMLCellElement,
        _row: number,
        column: number,
        _celno: number,
        colType: ColType,
        _cellType: string,
        _attribute: string,
        _rowData: Entity
    ) {
        let colNo = 0;
        if (colType === LEFT_PINNED_COLTYPE) {
            colNo = column + 1;
        }
        if (colType === MIDDLE_PINNED_COLTYPE) {
            colNo = this.gridInterface.getGridConfig().columnsPinnedLeft.length || 0;
            colNo = colNo + column + 1;
        }
        if (colType === RIGH_PINNED_COLTYPE) {
            colNo = this.gridInterface.getGridConfig().columnsPinnedLeft.length || 0;
            colNo = colNo + this.gridInterface.getGridConfig().columnsCenter.length || 0;
            colNo = colNo + column + 1;
        }
        render(
            html`<div
                class="simple-html-absolute-fill simple-html-label"
                @click=${() => {
                    console.log('column selected:', column, colType);
                }}
            >
                <span class="simple-html-selector-text">${colNo}</span>
            </div>`,
            cell as any
        );
    }

    private renderRowSelector(
        cell: HTMLCellElement,
        row: number,
        _column: number,
        _celno: number,
        _colType: ColType,
        _cellType: string,
        _attribute: string,
        rowData: Entity
    ) {
        let currentEntitySelected = '';
        if (rowData === this.gridInterface.getDatasource().currentEntity) {
            currentEntitySelected = row % 0 == 0 ? 'simple-html-label-even' : 'simple-html-label-odd';
        } else {
            currentEntitySelected = 'simple-html-label';
        }

        render(
            html`<div
                class=${currentEntitySelected + ' simple-html-absolute-fill'}
                @click=${(e: any) => {
                    if (rowData.__group) {
                        console.log('row selected:', row);
                    } else {
                        this.gridInterface
                            .getDatasource()
                            .getSelection()
                            .highlightRow(e as any, row);
                    }
                }}
            >
                <span class="simple-html-selector-text">${row}</span>
            </div>`,
            cell as any
        );
    }

    private renderRowCell(
        cell: HTMLCellElement,
        row: number,
        _column: number,
        _celno: number,
        _colType: ColType,
        _cellType: string,
        attribute: string,
        _rowData: Entity
    ) {
        const entity = this.gridInterface.getDatasource().getRow(row);
        let value = (entity && entity[attribute]?.toString()) || '';

        if (entity?.__group) {
            return;
        }

        if (attribute) {
            const cellConfig = this.gridInterface.getGridConfig().attributes[attribute];

            if (cellConfig?.type === 'date') {
                value = this.gridInterface.getDatasource().getDateFormater().fromDate(value);
            }

            if (cellConfig.type === 'boolean') {
                value = (entity && entity[attribute]) || false;
            }
            let dimmed = '';
            if (cellConfig.readonly) {
                dimmed = 'simple-html-readonly';
            }

            if (cellConfig.type === 'boolean') {
                render(
                    html`<input
                        .checked=${live(value)}
                        type="checkbox"
                        .readonly=${cellConfig.readonly}
                        .disabled=${cellConfig.readonly}
                        @contextmenu=${(e: any) => {
                            e.preventDefault();
                            console.log('context menu call on row');
                        }}
                        @click=${() => {
                            this.gridInterface.getDatasource().setRowAsCurrentEntity(row);
                            this.triggerScrollEvent();
                        }}
                        @change=${(e: any) => {
                            if (!cellConfig.readonly) {
                                entity[attribute] = e.target.checked ? false : true;
                                e.target.checked = entity[attribute];
                            }
                        }}
                    />`,
                    cell as any
                );
            } else {
                render(
                    html` <div>
                        <div class=${dimmed}></div>
                        <input
                            style=${cellConfig?.type === 'number' ? 'text-align: right' : ''}
                            .value=${live(value?.toString())}
                            .readonly=${cellConfig.readonly}
                            .disabled=${cellConfig.readonly}
                            @contextmenu=${(e: any) => {
                                e.preventDefault();
                                console.log('context menu call on row');
                            }}
                            @click=${() => {
                                this.gridInterface.getDatasource().setRowAsCurrentEntity(row);
                                this.triggerScrollEvent();
                            }}
                            @input=${(e: any) => {
                                if (!cellConfig.readonly && cellConfig?.type !== 'date') {
                                    entity[attribute] = e.target.value;
                                }
                            }}
                            @change=${(e: any) => {
                                if (!cellConfig.readonly && cellConfig?.type === 'date') {
                                    entity[attribute] = this.gridInterface
                                        .getDatasource()
                                        .getDateFormater()
                                        .toDate(e.target.value);
                                }
                            }}
                        />
                    </div>`,
                    cell as any
                );
            }
        } else {
            render(html`<div class="simple-html-dimmed"></div>`, cell as any);
        }
    }

    /**
     * this is called by scrolling/rebuild logic, its job is to pass work to correct rendrer
     * @param cell
     * @param row
     * @param column
     * @param celno
     * @param colType
     */
    private cellRender(cell: HTMLElement, row: number, column: number, celno: number, colType: ColType) {
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
                attribute = this.gridInterface.getGridConfig().columnsPinnedLeft[column]?.rows[celno];
                break;
            case MIDDLE_PINNED_COLTYPE:
                attribute = this.gridInterface.getGridConfig().columnsCenter[column]?.rows[celno];
                break;
            case RIGH_PINNED_COLTYPE:
                attribute = this.gridInterface.getGridConfig().columnsPinnedRight[column]?.rows[celno];
                break;
        }

        // todo: make type, so its easier to reuse
        (cell as HTMLCellElement).$row = row;
        (cell as HTMLCellElement).$column = column;
        (cell as HTMLCellElement).$coltype = colType;
        (cell as HTMLCellElement).$celno = celno;
        (cell as HTMLCellElement).$attribute = attribute;

        if (colType === GROUP_COLTYPE) {
            this.renderRowGroup(cell as HTMLCellElement, row, column, celno, colType, type, attribute, rowdata);
        }

        if (type === 'label') {
            this.renderHeaderLabel(cell as HTMLCellElement, row, column, celno, colType, type, attribute, rowdata);
        }

        if (type === 'filter') {
            this.renderHeaderFilter(cell as HTMLCellElement, row, column, celno, colType, type, attribute, rowdata);
        }

        if (type === SELECTOR_COLTYPE) {
            this.renderHeaderSelector(cell as HTMLCellElement, row, column, celno, colType, type, attribute, rowdata);
        }

        if (type === null && colType === SELECTOR_COLTYPE) {
            this.renderRowSelector(cell as HTMLCellElement, row, column, celno, colType, type, attribute, rowdata);
        }

        if (type === 'row-cell') {
            this.renderRowCell(cell as HTMLCellElement, row, column, celno, colType, type, attribute, rowdata);
        }
    }
}