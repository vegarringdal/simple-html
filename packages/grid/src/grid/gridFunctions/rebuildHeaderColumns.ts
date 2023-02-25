import { asPx } from './asPx';
import { creatElement } from './createElement';
import { dragEvent } from './dragEvent';
import { getElementByClassName } from './getElementByClassName';
import { Grid } from '../grid';
import { DIV } from './DIV';
import { HTMLCellElement } from './HTMLCellElement';
import { ColType, ColumnCache } from './colType';
import { LEFT_PINNED_COLTYPE, MIDDLE_PINNED_COLTYPE, RIGH_PINNED_COLTYPE, SELECTOR_COLTYPE } from './GROUP_COLTYPE';
import { Columns } from '../gridConfig';
import { horizontalScrollHandler } from './horizontalScrollHandler';
import { renderCell } from './renderCell';
import { updateHorizontalScrollWidth } from './updateHorizontalScrollWidth';
import { updateMainElementSizes } from './updateMainElementSizes';
import { verticalScrollHandler } from './verticalScrollHandler';
import { getGroupingWidth } from './getGroupingWidth';

/**
 * ctx also applies on drag/drop logic and resize column
 */
export function rebuildHeaderColumns(ctx: Grid) {
    const config = ctx.gridInterface.__getGridConfig();

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
            let left = getGroupingWidth(ctx, coltype);

            while (parent.firstChild) {
                parent.removeChild(parent.firstChild);
            }
            if (coltype === 'left-pinned') {
                const columnElement = creatElement(DIV, 'simple-html-grid-grouping-row-group');
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
                ctx.columnsHeaders.set(id, columnElement);

                left = left + columns[i].width;

                /**
                 * generate cells
                 */

                let top = 0;

                /**
                 * label cells
                 */
                if (!config.hideLabels) {
                    for (let y = 0; y < config.__columnCells; y++) {
                        const cell = creatElement(DIV, 'simple-html-grid-col-cell');
                        cell.classList.add('simple-html-label');
                        cell.style.top = asPx(top);
                        cell.style.height = asPx(config.cellHeight);
                        cell.setAttribute('type', 'label');
                        cell.setAttribute('cellNo', y.toString());

                        columnElement.appendChild(cell);

                        renderCell(ctx, cell, 0, i, y, coltype);
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
                        dragEvent(ctx, cell as HTMLCellElement, true);
                    }
                }

                /**
                 * input cells
                 */
                if (!config.hideFilter) {
                    for (let y = 0; y < config.__columnCells; y++) {
                        const cell = creatElement(DIV, 'simple-html-grid-col-cell');
                        cell.style.top = asPx(top);
                        cell.style.height = asPx(config.cellHeight);
                        cell.setAttribute('type', 'filter');
                        cell.setAttribute('cellNo', y.toString());
                        columnElement.appendChild(cell);
                        renderCell(ctx, cell, 0, i, y, coltype);
                        top = top + config.cellHeight;
                    }
                }

                /**
                 * column selector
                 */
                if (config.selectSizeHeight) {
                    const cell = creatElement(DIV, 'simple-html-grid-col-cell');
                    cell.classList.add('simple-html-label');
                    cell.style.top = asPx(top);
                    cell.style.height = asPx(config.cellHeight);
                    cell.setAttribute('type', SELECTOR_COLTYPE);
                    cell.setAttribute('cellNo', '0');

                    columnElement.appendChild(cell);
                    renderCell(ctx, cell, 0, i, 0, coltype);
                }

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

                    const scrollLeft = getElementByClassName(ctx.element, 'simple-html-grid-body-view-pinned-middle').scrollLeft;

                    if (coltype === LEFT_PINNED_COLTYPE) {
                        column = ctx.containerLeftColumnCache.filter((e) => e.refID === refID);
                        columnNumber = column[0].column;
                        col = ctx.gridInterface.__getGridConfig().columnsPinnedLeft[columnNumber];
                    }

                    if (coltype === MIDDLE_PINNED_COLTYPE) {
                        column = ctx.containerMiddleColumnCache.filter((e) => e.refID === refID);
                        columnNumber = column[0].column;
                        col = ctx.gridInterface.__getGridConfig().columnsCenter[columnNumber];
                    }

                    if (coltype === RIGH_PINNED_COLTYPE) {
                        column = ctx.containerRightColumnCache.filter((e) => e.refID === refID);
                        columnNumber = column[0].column;
                        col = ctx.gridInterface.__getGridConfig().columnsPinnedRight[columnNumber];
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
                            ctx.gridInterface.__parseConfig();
                            updateMainElementSizes(ctx);

                            if (coltype === LEFT_PINNED_COLTYPE) {
                                horizontalScrollHandler(ctx, 0, coltype);
                                horizontalScrollHandler(ctx, scrollLeft, MIDDLE_PINNED_COLTYPE);
                            }

                            if (coltype === RIGH_PINNED_COLTYPE) {
                                horizontalScrollHandler(ctx, 0, coltype);
                                horizontalScrollHandler(ctx, scrollLeft, MIDDLE_PINNED_COLTYPE);
                            }

                            if (coltype === MIDDLE_PINNED_COLTYPE) {
                                horizontalScrollHandler(ctx, scrollLeft, coltype);
                            }

                            verticalScrollHandler(
                                ctx,
                                getElementByClassName(ctx.element, 'simple-html-grid-body-view-pinned-middle').scrollTop
                            );

                            updateHorizontalScrollWidth(ctx);
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
    ctx.columnsHeaders.clear();

    addColumns(
        getElementByClassName(ctx.element, 'simple-html-grid-header-row-container-pinned-left'),
        config.columnsPinnedLeft,
        0,
        LEFT_PINNED_COLTYPE
    );

    // get params we will use to apply max columns
    const bodyWidth = getElementByClassName(ctx.element, 'simple-html-grid-body').clientWidth;
    const middleWidth = bodyWidth - (config.__leftWidth + config.__scrollbarSize + config.__rightWidth + config.selectSizeHeight);

    addColumns(
        getElementByClassName(ctx.element, 'simple-html-grid-header-row-container-pinned-middle'),
        config.columnsCenter,
        middleWidth / 50,
        MIDDLE_PINNED_COLTYPE
    );

    addColumns(
        getElementByClassName(ctx.element, 'simple-html-grid-header-row-container-pinned-right'),
        config.columnsPinnedRight,
        0,
        RIGH_PINNED_COLTYPE
    );

    /**
     * for slection in top left cornor
     */
    const selectorTopLeft = getElementByClassName(ctx.element, 'simple-html-grid-header-row-container-selector');
    selectorTopLeft.onclick = (e: MouseEvent) => {
        if (e.ctrlKey) {
            ctx.gridInterface.getDatasource().deSelectAll(true);
        } else {
            ctx.gridInterface.getDatasource().selectAll();
        }
    };
}
