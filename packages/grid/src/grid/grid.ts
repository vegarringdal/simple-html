import { GridInterface } from './gridInterface';
import { creatElement } from './createElement';
import { getElementByClassName } from './getElementByClassName';
import { asPx } from './asPx';
import { Attribute, Columns } from './gridConfig';
import { html, render } from 'lit-html';
import { FilterArgument } from '../datasource/types';
import { renderHeaderFilter } from './renderHeaderFilter';
import { renderHeaderSelector } from './renderHeaderSelector';
import { renderRowSelector } from './renderRowSelector';
import { renderRowCell } from './renderRowCell';
import { renderHeaderLabel } from './renderHeaderLabel';
import { renderRowGroup } from './renderRowGroup';
import { generateFilterEditor } from './generateFilterEditor';

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
            this.createDom();
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
            this.createDom();
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
        this.horizontalScrollHandler(elMiddle.scrollLeft);
        this.verticalScrollHandler(elMiddle.scrollTop);
    }

    /**
     * this needs to be called on large changes, grouping/reorder of columns etc
     * @param rebuildHeader
     *
     */
    public rebuild(rebuildHeader = true) {
        this.gridInterface.__dataSourceUpdated(); // I really only need this for drag/drop
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

    public createDom() {
        const panel = creatElement(DIV, 'simple-html-grid-panel');
        const header = creatElement(DIV, 'simple-html-grid-header');
        const body = creatElement(DIV, 'simple-html-grid-body');

        // focus helper
        const tmp = document.createElement('input');
        tmp.style.opacity = '0';

        body.appendChild(tmp);
        this.focusElement = tmp;

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
        this.addClickEventListener();

        this.updateVerticalScrollHeight(this.gridInterface.__getScrollState().scrollHeight);
        this.updateHorizontalScrollWidth();
        this.horizontalScrollHandler(0);
        this.verticalScrollHandler(0);
        this.element.appendChild(body);

        this.oldHeight = this.element.clientHeight;
        this.oldWidth = this.element.clientWidth;
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

    public updateMainElementSizes() {
        const config = this.gridInterface.__getGridConfig();

        /**
         * main elements
         */

        const leftGrouping = this.getGroupingWidth(LEFT_PINNED_COLTYPE);
        const leftWidth = config.__leftWidth + leftGrouping;

        const panel = getElementByClassName(this.element, 'simple-html-grid-panel');
        panel.style.height = asPx(config.panelHeight);

        const header = getElementByClassName(this.element, 'simple-html-grid-header');
        header.style.top = asPx(config.panelHeight);
        header.style.height = asPx(config.__rowHeight * 2 + config.selectSizeHeight);

        const body = getElementByClassName(this.element, 'simple-html-grid-body');
        body.style.top = asPx(config.panelHeight + config.__rowHeight * 2 + config.selectSizeHeight);
        body.style.bottom = asPx(config.footerHeight);
        body.style.right = asPx(config.__scrollbarSize);

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
        if (leftWidth === leftGrouping) {
            headerViewPortLeft.classList.add('pinned-left-grouping-only');
        } else {
            headerViewPortLeft.classList.remove('pinned-left-grouping-only');
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
        bodyViewPortGroup.style.right = asPx(0);

        const bodyViewPortSelector = getElementByClassName(this.element, 'simple-html-grid-body-view-selector');
        bodyViewPortSelector.style.width = asPx(config.__selectSizeWidth);

        const bodyViewPortLeft = getElementByClassName(this.element, 'simple-html-grid-body-view-pinned-left');
        bodyViewPortLeft.style.left = asPx(config.__selectSizeWidth);
        bodyViewPortLeft.style.width = asPx(leftWidth);
        if (leftWidth === 0) {
            bodyViewPortLeft.style.display = 'none';
        } else {
            bodyViewPortLeft.style.display = 'block';
        }
        if (leftWidth === leftGrouping) {
            bodyViewPortLeft.classList.add('pinned-left-grouping-only');
        } else {
            bodyViewPortLeft.classList.remove('pinned-left-grouping-only');
        }

        const bodyViewPortMiddle = getElementByClassName(this.element, 'simple-html-grid-body-view-pinned-middle');
        bodyViewPortMiddle.style.left = asPx(config.__selectSizeWidth + leftWidth);
        bodyViewPortMiddle.style.right = asPx(config.__rightWidth + 0);

        const bodyViewPortRight = getElementByClassName(this.element, 'simple-html-grid-body-view-pinned-right');
        bodyViewPortRight.style.width = asPx(config.__rightWidth);
        bodyViewPortRight.style.right = asPx(0);
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
    public rebuildTopPanel() {
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

            this.dragEvent(label as HTMLCellElement, false);

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

    public rebuildFooter() {
        const footer = getElementByClassName(this.element, 'simple-html-grid-footer');
        const totalRows = this.gridInterface.getDatasource().getAllData().length;
        const filteredRows = this.gridInterface.getDatasource().length();
        const filterString = this.gridInterface.getDatasource().getFilterString();
        const scrollbarHeight = this.gridInterface.__getGridConfig().__scrollbarSize;

        const clearButton = filterString
            ? html`<div class="clear-button" @click=${() => this.clearAllColumnFilters()}>Clear filter</div>`
            : null;
        const filterTemplate = html`<div style="display:flex">
            ${clearButton} <span class="footer-query" style="margin:auto">${filterString}</span>
        </div>`;

        render(
            html`<div style="display:flex;flex-direction: column;">
                <div style="flex: 1 1 ${scrollbarHeight}px;"></div>
                <span style="margin:auto">${filteredRows}/${totalRows}</span>
                ${filterString ? filterTemplate : null}
            </div>`,
            footer
        );
    }

    public rebuildRows() {
        const scroller = getElementByClassName(this.element, 'simple-html-grid-body-scroller');

        const rect = scroller.getBoundingClientRect();
        const height = rect.height;
        const config = this.gridInterface.__getGridConfig();
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
                element.style.height = asPx(this.gridInterface.__getScrollState().scrollHeights[i]);

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

    public dragEvent(cell: HTMLCellElement, sortEnabled = true) {
        cell.addEventListener('mousedown', (e) => {
            if (e.button !== 0) {
                return;
            }

            const attribute = (cell as HTMLCellElement).$attribute;
            const cellno = (cell as HTMLCellElement).$celno;
            const coltype = (cell as HTMLCellElement).$coltype;
            const column = (cell as HTMLCellElement).$column;
            const gridConfig = this.gridInterface.__getGridConfig();
            const mainX = e.clientX;
            const mainY = e.clientY;

            let dragElement: HTMLElement;
            let mouseUp = false;

            const gridRect = this.element.getBoundingClientRect();

            // this is helpr to track if user is clicking or planing to use drag/drop
            let isClickEvent = setTimeout(() => {
                if (attribute && !mouseUp) {
                    isClickEvent = null;

                    const width = this.getTextWidth(attribute) + 10;
                    const backgroundColor = getComputedStyle(this.element).getPropertyValue('--simple-html-grid-main-bg-color');
                    const fontSize = getComputedStyle(this.element).getPropertyValue('--simple-html-grid-font-size');
                    const fontWeight = getComputedStyle(this.element).getPropertyValue('--simple-html-grid-font-weight-header');
                    const fontFamily = getComputedStyle(this.element).getPropertyValue('--simple-html-grid-font-family');

                    const color = getComputedStyle(this.element).getPropertyValue('--simple-html-grid-main-font-color');

                    const boxShadowColor = getComputedStyle(this.element).getPropertyValue('--simple-html-grid-boxshadow');

                    const borderColor = getComputedStyle(this.element).getPropertyValue('--simple-html-grid-main-bg-border');

                    dragElement = creatElement(DIV, 'simple-html-draggable-element');
                    dragElement.style.height = asPx(gridConfig.cellHeight);
                    dragElement.style.width = asPx(width < 100 ? 100 : width);
                    dragElement.style.backgroundColor = backgroundColor;
                    dragElement.style.boxShadow = 'inset 1px 1px 3px 0 ' + boxShadowColor;
                    dragElement.style.outline = '1px solid ' + backgroundColor;
                    dragElement.style.border = '1px solid ' + borderColor;
                    dragElement.style.left = asPx(mainX);
                    dragElement.style.top = asPx(mainY);
                    dragElement.style.fontFamily = fontFamily;
                    dragElement.style.fontWeight = fontWeight;
                    dragElement.style.fontSize = fontSize;
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
                    dragElement.style.transform = `translate3d(${event.clientX - mainX}px, ${event.clientY - mainY}px, 0px)`;
                }
                if (event.clientX < gridRect.left) {
                    requestAnimationFrame(() => {
                        const el = getElementByClassName(this.element, 'simple-html-grid-middle-scroller');
                        el.scrollLeft = el.scrollLeft - 10;
                        this.horizontalScrollHandler(el.scrollLeft, 'middle-pinned');
                    });
                }
                if (event.clientX > gridRect.right) {
                    requestAnimationFrame(() => {
                        const el = getElementByClassName(this.element, 'simple-html-grid-middle-scroller');
                        el.scrollLeft = el.scrollLeft + 10;
                        this.horizontalScrollHandler(el.scrollLeft, 'middle-pinned');
                    });
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
                            const columnCenter = this.gridInterface.__getGridConfig().columnsCenter;
                            const columnLeft = this.gridInterface.__getGridConfig().columnsPinnedLeft;
                            const columnRight = this.gridInterface.__getGridConfig().columnsPinnedRight;

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
                                        const x = newColumn + 1;
                                        columnLeft.splice(x, 0, { rows: [attribute], width: 100 });
                                    }

                                    if (newColtype === 'middle-pinned') {
                                        const x = newColumn + 1;
                                        columnCenter.splice(x, 0, { rows: [attribute], width: 100 });
                                    }

                                    if (newColtype === 'right-pinned') {
                                        const x = newColumn + 1;
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
                if (isClickEvent && attribute && sortEnabled) {
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
                            .sort({ ascending: sortOrder[0].ascending ? false : true, attribute }, event.shiftKey);
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
     * this also applies on drag/drop logic and resize column
     */
    public rebuildHeaderColumns() {
        const config = this.gridInterface.__getGridConfig();

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
                        this.dragEvent(cell as HTMLCellElement, true);
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
                            col = this.gridInterface.__getGridConfig().columnsPinnedLeft[columnNumber];
                        }

                        if (coltype === MIDDLE_PINNED_COLTYPE) {
                            column = this.containerMiddleColumnCache.filter((e) => e.refID === refID);
                            columnNumber = column[0].column;
                            col = this.gridInterface.__getGridConfig().columnsCenter[columnNumber];
                        }

                        if (coltype === RIGH_PINNED_COLTYPE) {
                            column = this.containerRightColumnCache.filter((e) => e.refID === refID);
                            columnNumber = column[0].column;
                            col = this.gridInterface.__getGridConfig().columnsPinnedRight[columnNumber];
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

        /**
         * for slection in top left cornor
         */
        const selectorTopLeft = getElementByClassName(this.element, 'simple-html-grid-header-row-container-selector');
        selectorTopLeft.onclick = (e: MouseEvent) => {
            if (e.ctrlKey) {
                this.gridInterface.getDatasource().deSelectAll(true);
            } else {
                this.gridInterface.getDatasource().selectAll();
            }
        };
    }

    public getGroupingWidth(coltype: ColType) {
        if (coltype !== LEFT_PINNED_COLTYPE) {
            return 0;
        }

        const grouping = this.gridInterface.getDatasource().getGrouping();
        const groupingWidth = grouping?.length * 15 || 0;

        return groupingWidth;
    }

    public rebuildRowColumns() {
        const config = this.gridInterface.__getGridConfig();

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
     * resizes columns
     * @param onlyResizeAttribute null = all
     */
    public autoResizeColumns(onlyResizeAttribute?: string) {
        const attributes = this.gridInterface.__getGridConfig().__attributes;
        const attributeKeys = onlyResizeAttribute ? [onlyResizeAttribute] : Object.keys(attributes);

        let widths: number[] = attributeKeys.map((key) => {
            const attribute = attributes[key];
            const length = attribute?.label?.length || attribute.attribute?.length;
            return length + 4;
        });

        const text: string[] = attributeKeys.map((key) => {
            const attribute = attributes[key];
            if (attribute.type === 'date' && attribute?.label?.length < 5) {
                return '19.19.2000 A';
            }
            return (attribute?.label || attribute.attribute) + '< > < <';
        });

        const data = this.gridInterface.getDatasource().getAllData();
        data.forEach((row: any) => {
            attributeKeys.forEach((key, i) => {
                const att = attributes[key];

                if (row && typeof row[att.attribute] === 'string') {
                    if (widths[i] < row[att.attribute].length) {
                        widths[i] = row[att.attribute].length;
                        text[i] = row[att.attribute];
                    }
                }
                if (row && typeof row[att.attribute] === 'number') {
                    if (widths[i] < (row[att.attribute] + '').length) {
                        widths[i] = (row[att.attribute] + '').length;
                        text[i] = row[att.attribute];
                    }
                }
            });
        });

        widths = widths.map((e: number) => (e ? e * 8 : 100));

        const left = this.gridInterface.__getGridConfig().columnsPinnedLeft || [];
        const right = this.gridInterface.__getGridConfig().columnsPinnedRight || [];
        const center = this.gridInterface.__getGridConfig().columnsCenter || [];

        center
            .concat(left)
            .concat(right)
            .forEach((g) => {
                let x = 0;
                g?.rows.forEach((rowAttribute) => {
                    if (x < 750) {
                        if (attributeKeys.indexOf(rowAttribute) !== -1) {
                            const xx = widths[attributeKeys.indexOf(rowAttribute)];
                            if (xx > x) {
                                x = this.getTextWidth(text[attributeKeys.indexOf(rowAttribute)]) + 20;
                            }
                        }
                    }
                });
                if (x) {
                    g.width = x > 750 ? 750 : x;
                }
            });

        this.rebuild();
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

    public addScrollEventListeners() {
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
                if (event.shiftKey && event.ctrlKey) {
                    event.preventDefault();
                    const el = getElementByClassName(this.element, 'simple-html-grid-middle-scroller');
                    const movement = el.scrollLeft - (event as any).wheelDeltaY;
                    console.log(movement);
                    setScrollLeft(getElementByClassName(this.element, ' simple-html-grid-middle-scroller'), movement);
                } else {
                    const el = getElementByClassName(this.element, 'simple-html-grid-body-scroller');
                    this.focusElement.focus();
                    const movement = el.scrollTop - (event as any).wheelDeltaY;
                    setScrollTop(getElementByClassName(this.element, 'simple-html-grid-body-scroller'), movement);
                }
            },
            { passive: false }
        );

        let lastY = 0;
        let lastX = 0;
        this.element.addEventListener(
            'touchstart',
            (event) => {
                lastY = event.touches[0].clientY;
                lastX = event.touches[0].clientX;
            },
            { passive: false }
        );

        /**
         *wheel event, only way to get it unless we disable pointer events
         */
        this.element.addEventListener(
            'touchmove',
            (event) => {
                const x = getElementByClassName(this.element, 'simple-html-grid-body-view-pinned-middle');
                this.focusElement.focus();

                const currentY = event.touches[0].clientY;
                const deltaY = currentY - lastY;
                lastY = currentY;
                const movementY = x.scrollTop - deltaY;
                setScrollTop(getElementByClassName(this.element, 'simple-html-grid-body-scroller'), movementY);

                const currentX = event.touches[0].clientX;
                const deltaX = currentX - lastX;
                lastX = currentX;
                const movementX = x.scrollLeft - deltaX;
                setScrollLeft(getElementByClassName(this.element, ' simple-html-grid-middle-scroller'), movementX);

                /* 
                an idea...
                
                if(!event.target?.classList.contains('simple-html-grid-panel') && !event.target?.classList.contains('simple-html-grid-footer')){
                    let currentY = event.touches[0].clientY;             
                    const deltaY = currentY - lastY;
                    lastY = currentY;
                    const movementY = x.scrollTop - deltaY * 5;
                    setScrollTop(getElementByClassName(this.element, 'simple-html-grid-body-scroller'), movementY);
                } else{
                    const currentX = event.touches[0].clientX;
                    const deltaX = currentX - lastX;
                    lastX = currentX;
                    const movementX = x.scrollLeft - deltaX*5;
                    setScrollLeft(getElementByClassName(this.element, ' simple-html-grid-middle-scroller'), movementX)
                } */
            },
            { passive: false }
        );
    }

    public verticalScrollHandler(scrollTop: number) {
        this.removeContextMenu();

        if (this.largeScrollTopTimer) {
            return;
        }

        const lastScrollTop = this.lastScrollTop;
        const config = this.gridInterface.__getGridConfig();
        const rowTops = this.gridInterface.__getScrollState().scrollTops;
        const heights = this.gridInterface.__getScrollState().scrollHeights;

        const getTopRow = (fromtop = 0, findTop: number) => {
            let result = 0;
            const tops = this.gridInterface.__getScrollState().scrollTops;
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
            const config = this.gridInterface.__getGridConfig();
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

    public horizontalScrollHandler(scrollLeft: number, type: ColType = MIDDLE_PINNED_COLTYPE) {
        this.removeContextMenu();

        const config = this.gridInterface.__getGridConfig();

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
        this.rebuildHeaderColumns();
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
        if (this.gridInterface.__selectedColumns()) {
            allAttributes.forEach((name, i) => {
                if (this.gridInterface.__isColumnSelected(i + 1) && filterSelectedColumns) {
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
