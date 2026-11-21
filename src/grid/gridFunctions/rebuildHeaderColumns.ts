import type { Grid } from '../grid';
import type { LayoutColumn } from '../gridConfig';
import { headerCellId, headerRowCount } from './ariaGrid';
import { asPx } from './asPx';
import type { ColType, ColumnCache } from './colType';
import { createElement } from './createElement';
import { DIV } from './DIV';
import { dragEvent } from './dragEvent';
import { followPointer, isPrimaryPress } from './followPointer';
import { LEFT_PINNED_COLTYPE, MIDDLE_PINNED_COLTYPE, RIGHT_PINNED_COLTYPE, SELECTOR_COLTYPE } from './GROUP_COLTYPE';
import { getElementByClassName } from './getElementByClassName';
import { getGroupingWidth } from './getGroupingWidth';
import { gridText } from './gridText';
import type { HTMLCellElement } from './HTMLCellElement';
import { headerLabelKeydown } from './headerLabelKeydown';
import { horizontalScrollHandler } from './horizontalScrollHandler';
import { getMiddleColumnsNeeded } from './rebuildRowColumns';
import { renderCell } from './renderCell';
import { updateHorizontalScrollWidth } from './updateHorizontalScrollWidth';
import { updateMainElementSizes } from './updateMainElementSizes';
import { verticalScrollHandler } from './verticalScrollHandler';

/**
 * ctx also applies on drag/drop logic and resize column
 */
export function rebuildHeaderColumns(ctx: Grid) {
    const config = ctx.gridInterface.__getGridConfig();

    /**
     * helper to generate cols and rows elements
     */
    const addColumns = (parent: HTMLElement, columns: LayoutColumn[], maxColumns: number, coltype: ColType) => {
        let columnsNeeded = maxColumns === 0 ? columns.length : maxColumns;
        if (columns.length < columnsNeeded) {
            columnsNeeded = columns.length;
        }

        // always there: the row and header containers are made before the columns
        if (parent) {
            let left = getGroupingWidth(ctx, coltype);

            while (parent.firstChild) {
                parent.removeChild(parent.firstChild);
            }
            if (coltype === 'left-pinned') {
                const columnElement = createElement(DIV, 'simple-html-grid-grouping-row-group');
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

                const columnElement = createElement(DIV, 'simple-html-grid-col');
                // its label and filter cells are owned by the header rows, see ariaGrid.ts
                columnElement.setAttribute('role', 'none');

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
                        const cell = createElement(DIV, 'simple-html-grid-col-cell');
                        cell.classList.add('simple-html-label');
                        cell.style.top = asPx(top);
                        cell.style.height = asPx(config.cellHeaderLabelHeight);
                        cell.setAttribute('type', 'label');
                        cell.setAttribute('cellNo', y.toString());
                        cell.id = headerCellId(ctx, coltype, i, 'label', y);

                        columnElement.appendChild(cell);

                        renderCell(ctx, cell, 0, i, y, coltype);
                        top = top + config.cellHeaderLabelHeight;

                        /**
                         * drop zones, they only have a size while a column is dragged. dragEvent
                         * highlights the one under the pointer
                         */
                        cell.appendChild(createElement(DIV, 'simple-html-grid-drop-zone-left'));
                        cell.appendChild(createElement(DIV, 'simple-html-grid-drop-zone-right'));
                        cell.appendChild(createElement(DIV, 'simple-html-grid-drop-zone-top'));
                        cell.appendChild(createElement(DIV, 'simple-html-grid-drop-zone-bottom'));
                        cell.appendChild(createElement(DIV, 'simple-html-grid-drop-zone-center'));

                        /**
                         * logic for dragdrop and sort event, and the keys of a label (Enter sorts)
                         */
                        dragEvent(ctx, cell as HTMLCellElement, true);
                        cell.addEventListener('keydown', (event) => headerLabelKeydown(ctx, cell as HTMLCellElement, event));
                    }
                }

                /**
                 * input cells
                 */
                if (!config.hideFilter) {
                    for (let y = 0; y < config.__columnCells; y++) {
                        const cell = createElement(DIV, 'simple-html-grid-col-cell');
                        cell.style.top = asPx(top);
                        cell.style.height = asPx(config.cellHeight);
                        cell.setAttribute('type', 'filter');
                        cell.setAttribute('cellNo', y.toString());
                        cell.id = headerCellId(ctx, coltype, i, 'filter', y);
                        columnElement.appendChild(cell);
                        renderCell(ctx, cell, 0, i, y, coltype);
                        top = top + config.cellHeight;
                    }
                }

                /**
                 * column selector
                 */
                if (config.selectSizeHeight) {
                    const cell = createElement(DIV, 'simple-html-grid-col-cell');
                    cell.classList.add('simple-html-label');
                    cell.style.top = asPx(top);
                    cell.style.height = asPx(config.cellHeight);
                    cell.setAttribute('type', SELECTOR_COLTYPE);
                    cell.setAttribute('cellNo', '0');
                    // the column numbers are for the mouse (a click selects the column), a keyboard can
                    // not reach them: a screen reader would only hear a row of numbers
                    cell.setAttribute('aria-hidden', 'true');

                    columnElement.appendChild(cell);
                    renderCell(ctx, cell, 0, i, 0, coltype);
                }

                /**
                 * logic for reszing column
                 */

                // create element we use for resizing, right pinned needs own class
                let resizeElement: HTMLElement;
                if (coltype === RIGHT_PINNED_COLTYPE) {
                    resizeElement = createElement(DIV, 'simple-html-grid-col-resize-right');
                } else {
                    resizeElement = createElement(DIV, 'simple-html-grid-col-resize');
                }
                // for the mouse, nothing for a screen reader
                resizeElement.setAttribute('aria-hidden', 'true');
                columnElement.appendChild(resizeElement);

                /**
                 * the column of the layout the handle is the edge of now: the column element is slot i
                 * (its refID), the column cache says which column of the layout the slot shows now
                 */
                const layoutColumn = (): LayoutColumn => {
                    const refID = i;
                    let column: ColumnCache[];
                    // addColumns is only called with the 3 pinned types, so one of the ifs below sets it
                    let col!: LayoutColumn;

                    if (coltype === LEFT_PINNED_COLTYPE) {
                        column = ctx.containerLeftColumnCache.filter((e) => e.refID === refID);
                        col = ctx.gridInterface.__getGridConfig().layout.left[column[0].column];
                    }

                    if (coltype === MIDDLE_PINNED_COLTYPE) {
                        column = ctx.containerMiddleColumnCache.filter((e) => e.refID === refID);
                        col = ctx.gridInterface.__getGridConfig().layout.center[column[0].column];
                    }

                    if (coltype === RIGHT_PINNED_COLTYPE) {
                        column = ctx.containerRightColumnCache.filter((e) => e.refID === refID);
                        col = ctx.gridInterface.__getGridConfig().layout.right[column[0].column];
                    }
                    return col;
                };

                /**
                 * a double click on the handle fits the column to its content, as Excel does
                 * (gridInterface.fitColumns). Its two presses are resizes that did not move: they do
                 * not rebuild the header, so both clicks are on this handle
                 */
                resizeElement.addEventListener('dblclick', () => {
                    ctx.gridInterface.fitColumns(layoutColumn().fields);
                });

                /**
                 * event for resizing: pointer events, so a mouse, a pen or a finger. The handle
                 * captures the pointer, its events come to the handle wherever the pointer goes (see
                 * followPointer). touch-action none: the browser would scroll the page under a finger
                 */
                resizeElement.style.touchAction = 'none';
                resizeElement.addEventListener('pointerdown', (event) => {
                    if (!isPrimaryPress(event)) {
                        return;
                    }

                    // first section here is to collect data we need
                    const clientX = event.clientX;
                    const col = layoutColumn();

                    const scrollLeft = getElementByClassName(ctx.element, 'simple-html-grid-body-view-pinned-middle').scrollLeft;

                    const originalWidth = col.width;

                    resizeElement.setPointerCapture(event.pointerId);

                    followPointer(resizeElement, event, {
                        // the edge follows the pointer, the sizes are updated without a rebuild
                        move: (moveEvent) => {
                            if (coltype === RIGHT_PINNED_COLTYPE) {
                                col.width = originalWidth - (moveEvent.clientX - clientX);
                            } else {
                                col.width = originalWidth + (moveEvent.clientX - clientX);
                            }

                            if (col.width < 25) {
                                col.width = 25;
                            }
                            ctx.gridInterface.__parseConfig();
                            updateMainElementSizes(ctx);

                            if (coltype === LEFT_PINNED_COLTYPE) {
                                horizontalScrollHandler(ctx, 0, coltype);
                                horizontalScrollHandler(ctx, scrollLeft, MIDDLE_PINNED_COLTYPE);
                            }

                            if (coltype === RIGHT_PINNED_COLTYPE) {
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
                        },
                        // narrower columns (or a narrower pinned side) can mean more columns on
                        // screen than the middle section has elements for, rebuild recounts them.
                        // Not after a press that did not resize: the header would be made again, and
                        // the second click of a double click be on another handle
                        up: () => {
                            if (col.width !== originalWidth) {
                                ctx.rebuild();
                            }
                        },
                        // the resize did not finish: the column gets its width back
                        cancel: () => {
                            col.width = originalWidth;
                            ctx.gridInterface.__parseConfig();
                            ctx.rebuild();
                        }
                    });
                });
            }
        }
    };

    // clear old config
    ctx.columnsHeaders.clear();

    addColumns(
        getElementByClassName(ctx.element, 'simple-html-grid-header-row-container-pinned-left'),
        config.layout.left,
        0,
        LEFT_PINNED_COLTYPE
    );

    addColumns(
        getElementByClassName(ctx.element, 'simple-html-grid-header-row-container-pinned-middle'),
        config.layout.center,
        getMiddleColumnsNeeded(ctx),
        MIDDLE_PINNED_COLTYPE
    );

    addColumns(
        getElementByClassName(ctx.element, 'simple-html-grid-header-row-container-pinned-right'),
        config.layout.right,
        0,
        RIGHT_PINNED_COLTYPE
    );

    /**
     * for slection in top left cornor
     */
    const selectorTopLeft = getElementByClassName(ctx.element, 'simple-html-grid-header-row-container-selector');
    // the column header of the row numbers, see createDom. A text, it can have changed. In the first
    // header row (ariaGrid.ts): with the labels and the filters hidden there is none, and a column
    // header outside a row is not allowed
    selectorTopLeft.setAttribute('aria-label', gridText(ctx, 'grid.rowSelector'));
    if (headerRowCount(config)) {
        selectorTopLeft.removeAttribute('aria-hidden');
    } else {
        selectorTopLeft.setAttribute('aria-hidden', 'true');
    }
    selectorTopLeft.onclick = (e: MouseEvent) => {
        if (e.ctrlKey) {
            ctx.gridInterface.getDatasource().deselectAll({ notify: true });
        } else {
            ctx.gridInterface.getDatasource().selectAll();
        }
    };
}
