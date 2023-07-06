import { asPx } from './asPx';
import { creatElement } from './createElement';
import { getElementByClassName } from './getElementByClassName';
import { Grid } from '../grid';
import { DIV } from './DIV';
import { HTMLCellElement } from './HTMLCellElement';
import { horizontalScrollHandler } from './horizontalScrollHandler';
import { getTextWidth } from './getTextWidth';

export function dragEvent(ctx: Grid, cell: HTMLCellElement, sortEnabled = true) {
    cell.addEventListener('mousedown', (e) => {
        if (e.button !== 0) {
            return;
        }

        const attributes = ctx.gridInterface.__getGridConfig().__attributes;
        const attribute = (cell as HTMLCellElement).$attribute;
        const attributeLabel = attributes[attribute].label || attribute;
        const cellno = (cell as HTMLCellElement).$celno;
        const coltype = (cell as HTMLCellElement).$coltype;
        const column = (cell as HTMLCellElement).$column;
        const gridConfig = ctx.gridInterface.__getGridConfig();
        const mainX = e.clientX;
        const mainY = e.clientY;

        let dragElement: HTMLElement;
        let mouseUp = false;

        const gridRect = ctx.element.getBoundingClientRect();

        // ctx is helpr to track if user is clicking or planing to use drag/drop
        let isClickEvent = setTimeout(() => {
            if (attribute && !mouseUp) {
                isClickEvent = null;

                const width = getTextWidth(ctx, attributeLabel) + 10;
                const backgroundColor = getComputedStyle(ctx.element).getPropertyValue('--simple-html-grid-main-bg-color');
                const fontSize = getComputedStyle(ctx.element).getPropertyValue('--simple-html-grid-font-size');
                const fontWeight = getComputedStyle(ctx.element).getPropertyValue('--simple-html-grid-font-weight-header');
                const fontFamily = getComputedStyle(ctx.element).getPropertyValue('--simple-html-grid-font-family');

                const color = getComputedStyle(ctx.element).getPropertyValue('--simple-html-grid-main-font-color');

                const boxShadowColor = getComputedStyle(ctx.element).getPropertyValue('--simple-html-grid-boxshadow');

                const borderColor = getComputedStyle(ctx.element).getPropertyValue('--simple-html-grid-main-bg-border');

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
                label.innerText = attributeLabel;
                label.style.fontFamily = fontFamily;
                label.style.fontWeight = fontWeight;
                label.style.fontSize = fontSize;
                dragElement.appendChild(label);
                const header = getElementByClassName(ctx.element, 'simple-html-grid-header');
                header.classList.toggle('dragdrop-state');

                const panel = getElementByClassName(ctx.element, 'simple-html-grid-panel');
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
                    const el = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller');
                    el.scrollLeft = el.scrollLeft - 10;
                    horizontalScrollHandler(ctx, el.scrollLeft, 'middle-pinned');
                });
            }
            if (event.clientX > gridRect.right) {
                requestAnimationFrame(() => {
                    const el = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller');
                    el.scrollLeft = el.scrollLeft + 10;
                    horizontalScrollHandler(ctx, el.scrollLeft, 'middle-pinned');
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
                const header = getElementByClassName(ctx.element, 'simple-html-grid-header');
                header.classList.toggle('dragdrop-state');
                const panel = getElementByClassName(ctx.element, 'simple-html-grid-panel');
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
                        const columnCenter = ctx.gridInterface.__getGridConfig().columnsCenter;
                        const columnLeft = ctx.gridInterface.__getGridConfig().columnsPinnedLeft;
                        const columnRight = ctx.gridInterface.__getGridConfig().columnsPinnedRight;

                        switch (true) {
                            case classList?.contains('simple-html-grid-panel'):
                                const newGrouping = ctx.gridInterface.getDatasource().getGrouping();

                                const attributes = ctx.gridInterface.__getGridConfig().__attributes;
                                const attributeLabel = attributes[attribute].label || attribute;

                                newGrouping.push({ attribute: attribute, title: attributeLabel });
                                ctx.gridInterface.getDatasource().group(newGrouping);

                                break;
                            case classList?.contains('simple-html-grid-drop-zone-left-panel'):
                                const updateGrouping = ctx.gridInterface
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

                                ctx.gridInterface.getDatasource().group(updateGrouping);

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

                                ctx.rebuild();

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

                                ctx.rebuild();

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

                                ctx.rebuild();
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

                                ctx.rebuild();

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

                                ctx.rebuild();

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
                const sortOrder = ctx.gridInterface
                    .getDatasource()
                    .getLastSorting()
                    ?.filter((e) => e.attribute === attribute);
                if (sortOrder.length) {
                    ctx.gridInterface
                        .getDatasource()
                        .sort({ ascending: sortOrder[0].ascending ? false : true, attribute }, event.shiftKey);
                } else {
                    ctx.gridInterface.getDatasource().sort({ ascending: true, attribute }, event.shiftKey);
                }
            }
        };

        document.addEventListener('mousemove', mousemove);
        document.addEventListener('mouseup', mouseup);
    });
}
