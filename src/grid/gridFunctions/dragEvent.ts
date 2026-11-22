import type { Grid } from '../grid';
import { asPx } from './asPx';
import type { ColType } from './colType';
import { createElement } from './createElement';
import { DIV } from './DIV';
import { followPointer, isPrimaryPress } from './followPointer';
import { getColumnLabel } from './getColumnLabel';
import { getElementByClassName } from './getElementByClassName';
import { getTextWidth } from './getTextWidth';
import type { HTMLCellElement } from './HTMLCellElement';
import { horizontalScrollHandler } from './horizontalScrollHandler';
import { popoverParent } from './showMenu';

/**
 * a mouse or pen press that moves this many px is a drag, less is a click
 */
export const DRAG_DISTANCE = 5;

/**
 * a finger is held still this long (ms) before it drags. A finger that moves sooner is a swipe:
 * the grid scrolls, nothing is dragged or sorted
 */
export const TOUCH_HOLD = 200;

/**
 * the drop zones of a label cell (rebuildHeaderColumns.ts) and of a group chip (rebuildTopPanel.ts).
 * They only have a size while a drag is on: the header and the panel have the `dragdrop-state` class
 */
const DROP_ZONES = [
    'simple-html-grid-drop-zone-left',
    'simple-html-grid-drop-zone-right',
    'simple-html-grid-drop-zone-top',
    'simple-html-grid-drop-zone-bottom',
    'simple-html-grid-drop-zone-center',
    'simple-html-grid-drop-zone-left-panel'
];

/**
 * css class of the drop target under the pointer
 */
const HOVER = 'simple-html-grid-col-resize-hover';

/**
 * where the dragged field came from. The cell is reused while the grid scrolls (and a drag near the
 * edge scrolls it), so this is read when the press starts
 */
type DragSource = {
    attribute: string;
    cellno: number;
    coltype: ColType;
    column: number;
    /** a group chip in the panel */
    isChip: boolean;
};

/**
 * Drag/drop of a field, and a click on it to sort. `cell` is a header label cell, a group chip in the
 * panel (rebuildTopPanel.ts) or a field in the column chooser (contextMenuColumnChooser.ts).
 *
 * Pointer events, so it works with a mouse, a pen and a finger:
 * - a press let go before it is a drag is a click: it sorts on the field when `sortEnabled`, shift
 *   adds the field to the sort
 * - mouse and pen: the press is a drag once it has moved DRAG_DISTANCE px
 * - finger: held still for TOUCH_HOLD ms it is a drag. A finger that moves sooner is a swipe
 * - only the primary pointer with its main button starts anything (`isPrimaryPress`)
 * - the drop target is what is under the pointer when it is let go (`dropTargetAt`), see `dropColumn`
 * - pointercancel ends the drag without a drop
 * - a long press of a finger (longPress.ts) opens the header menu: the `contextmenu` event on the field
 *   ends the drag the hold started, without a drop
 *
 * `cell` gets `touch-action: none` (`touchAction`): the browser would scroll or zoom the page under a
 * finger that drags, and send pointercancel. The grid scrolls on a swipe itself (touchScroll.ts). The
 * column chooser's fields are in a list a finger scrolls: `pan-y`, the browser pans the list on a swipe
 * up or down (the drag stops, as on a swipe). Once a hold made it a drag, the finger's touchmove events
 * are canceled: the list does not pan under the drag.
 */
export function dragEvent(
    ctx: Grid,
    cell: HTMLCellElement,
    sortEnabled = true,
    abortSignal?: AbortSignal,
    touchAction: 'none' | 'pan-y' = 'none'
) {
    cell.style.touchAction = touchAction;

    cell.addEventListener(
        'pointerdown',
        (down) => {
            if (!isPrimaryPress(down)) {
                return;
            }

            // a column with fewer rows than the tallest one has empty label cells, nothing to drag
            const attribute = cell.$attribute;
            if (!attribute) {
                return;
            }

            const source: DragSource = {
                attribute,
                cellno: cell.$celno,
                coltype: cell.$coltype,
                column: cell.$column,
                isChip: cell.classList.contains('simple-html-grid-panel-label')
            };
            const gridRect = ctx.element.getBoundingClientRect();
            const isTouch = down.pointerType === 'touch';

            // the element that follows the pointer, set while it is a drag
            let ghost: HTMLElement | null = null;
            let hovered: HTMLElement | null = null;
            let holdTimer: ReturnType<typeof setTimeout> | undefined;
            // the listeners of this press on the cell, removed when it ends
            const press = new AbortController();

            const hover = (target: HTMLElement | null) => {
                if (target !== hovered) {
                    hovered?.classList.remove(HOVER);
                    target?.classList.add(HOVER);
                    hovered = target;
                }
            };

            const startDrag = () => {
                // from now on the events of this pointer go to the cell, wherever it is (see followPointer).
                // A rebuild since the press can have removed the cell, capturing would throw
                if (cell.isConnected) {
                    cell.setPointerCapture(down.pointerId);
                }
                if (isTouch) {
                    // the finger drags: nothing pans under it (a chooser field is pan-y). The touch events go
                    // to the element the finger went down on, in the cell
                    cell.addEventListener('touchmove', (event) => event.preventDefault(), {
                        passive: false,
                        signal: press.signal
                    });
                }
                setDragState(ctx, true);
                return createGhost(ctx, cell, attribute, down.clientX, down.clientY);
            };

            // the press is over: no hold to wait for, no listeners of it left on the cell
            const endPress = () => {
                clearTimeout(holdTimer);
                press.abort();
            };

            const endDrag = () => {
                endPress();
                if (ghost) {
                    ghost.remove();
                    ghost = null;
                    hover(null);
                    setDragState(ctx, false);
                }
            };

            const stop = followPointer(cell, down, {
                move: (event) => {
                    if (!ghost) {
                        const distance = Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY);
                        if (distance < DRAG_DISTANCE) {
                            return;
                        }
                        if (isTouch) {
                            // moved before the hold: a swipe, the grid scrolls (touchScroll.ts)
                            endPress();
                            stop();
                            return;
                        }
                        ghost = startDrag();
                    }

                    ghost.style.transform = `translate3d(${event.clientX - down.clientX}px, ${event.clientY - down.clientY}px, 0px)`;
                    hover(dropTargetAt(ctx, event.clientX, event.clientY));
                    autoScroll(ctx, gridRect, event.clientX);
                },
                up: (event) => {
                    if (ghost) {
                        const target = dropTargetAt(ctx, event.clientX, event.clientY);
                        endDrag();
                        if (target) {
                            dropColumn(ctx, source, target);
                        }
                    } else {
                        endPress();
                        if (sortEnabled) {
                            sortOn(ctx, attribute, event.shiftKey);
                        }
                    }
                },
                cancel: endDrag
            });

            // the header menu opened on the field (a long press, a right click while the mouse drags): no
            // drag, no drop and no sort when the pointer is let go
            cell.addEventListener(
                'contextmenu',
                () => {
                    endDrag();
                    stop();
                },
                { signal: press.signal }
            );

            if (isTouch) {
                holdTimer = setTimeout(() => {
                    ghost = startDrag();
                }, TOUCH_HOLD);
            }
        },
        { signal: abortSignal }
    );
}

/**
 * the drop target under the pointer: the grouping panel, or a drop zone of a label cell or group chip
 * that shows a field. null for anything else, also for another grid on the page.
 *
 * The pointer is captured during a drag, so the target of its events is the dragged cell: the
 * browser's hit test says what is under it. The ghost has `pointer-events: none`, it is not hit.
 */
function dropTargetAt(ctx: Grid, x: number, y: number): HTMLElement | null {
    const element = document.elementFromPoint(x, y);
    if (!(element instanceof HTMLElement) || !ctx.element.contains(element)) {
        return null;
    }
    if (element.classList.contains('simple-html-grid-panel')) {
        return element;
    }
    const isZone = DROP_ZONES.some((zone) => element.classList.contains(zone));
    const cell = element.parentElement as HTMLCellElement | null;
    return isZone && cell?.$attribute ? element : null;
}

/**
 * the header and the panel show their drop zones while a drag is on
 */
function setDragState(ctx: Grid, on: boolean) {
    getElementByClassName(ctx.element, 'simple-html-grid-header').classList.toggle('dragdrop-state', on);
    getElementByClassName(ctx.element, 'simple-html-grid-panel').classList.toggle('dragdrop-state', on);
}

/**
 * the element that follows the pointer while dragging: the label of the field, in the grid's colors.
 * Placed with its top left corner at (x, y), the pointer moves it with a transform.
 *
 * A `popover="manual"`, shown: in the top layer, over the column chooser it can be dragged from (a
 * popover itself) and over a dialog the grid is in - on the body it was under both. Shown last, it is
 * the top of the top layer. Put where the grid's menus go (popoverParent), removed when the drag ends
 * (removing a popover hides it)
 */
function createGhost(ctx: Grid, cell: HTMLElement, attribute: string, x: number, y: number) {
    const gridConfig = ctx.gridInterface.__getGridConfig();
    const attributeLabel = getColumnLabel(ctx, attribute);

    // the cell is created inside its column/panel/menu element (a rebuild can have taken a chip out of the panel)
    const rect = (cell.parentElement ?? cell).getBoundingClientRect();
    let width = getTextWidth(ctx, attributeLabel) + 10;
    if (gridConfig.cellHeaderLabelHeight !== gridConfig.cellHeight) {
        width = rect.width;
    }

    if (width < 100) {
        width = 100;
    }

    const style = getComputedStyle(ctx.element);
    const backgroundColor = style.getPropertyValue('--simple-html-grid-main-bg-color');
    const fontSize = style.getPropertyValue('--simple-html-grid-font-size');
    const fontWeight = style.getPropertyValue('--simple-html-grid-font-weight-header');
    const fontFamily = style.getPropertyValue('--simple-html-grid-font-family');
    const color = style.getPropertyValue('--simple-html-grid-main-font-color');
    const boxShadowColor = style.getPropertyValue('--simple-html-grid-boxshadow');
    const borderColor = style.getPropertyValue('--simple-html-grid-main-bg-border');

    const dragElement = createElement(DIV, 'simple-html-draggable-element');
    // x and y are client (viewport) coordinates
    dragElement.style.position = 'fixed';
    // not hit by elementFromPoint, see dropTargetAt
    dragElement.style.pointerEvents = 'none';
    dragElement.style.height = asPx(gridConfig.cellHeaderLabelHeight);
    dragElement.style.minWidth = asPx(width);
    dragElement.style.maxWidth = asPx(width);
    dragElement.style.backgroundColor = backgroundColor;
    dragElement.style.boxShadow = `inset 1px 1px 3px 0 ${boxShadowColor}`;
    dragElement.style.outline = `1px solid ${backgroundColor}`;
    dragElement.style.border = `1px solid ${borderColor}`;
    dragElement.style.left = asPx(x);
    dragElement.style.top = asPx(y);
    dragElement.style.fontFamily = fontFamily;
    dragElement.style.fontWeight = fontWeight;
    dragElement.style.fontSize = fontSize;
    dragElement.style.color = color;

    const label = createElement('DIV', 'simple-html-draggable-element-label');
    label.innerText = attributeLabel;
    label.style.fontFamily = fontFamily;
    label.style.fontWeight = fontWeight;
    label.style.fontSize = fontSize;
    dragElement.appendChild(label);

    dragElement.popover = 'manual';
    popoverParent(cell).appendChild(dragElement);
    dragElement.showPopover();
    return dragElement;
}

/**
 * dragged left or right of the grid: scroll the center columns that way
 */
function autoScroll(ctx: Grid, gridRect: DOMRect, x: number) {
    if (x < gridRect.left) {
        requestAnimationFrame(() => {
            const el = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller');
            el.scrollLeft = el.scrollLeft - 10;
            horizontalScrollHandler(ctx, el.scrollLeft, 'middle-pinned');
        });
    }
    if (x > gridRect.right) {
        requestAnimationFrame(() => {
            const el = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller');
            el.scrollLeft = el.scrollLeft + 10;
            horizontalScrollHandler(ctx, el.scrollLeft, 'middle-pinned');
        });
    }
}

/**
 * a click on a label: sort on its field, a second click turns the direction. `add` (shift) adds the
 * field to the sort instead of replacing it
 */
export function sortOn(ctx: Grid, attribute: string, add: boolean) {
    const datasource = ctx.gridInterface.getDatasource();
    const sortOrder = datasource.getLastSorting()?.filter((e) => e.attribute === attribute);
    if (sortOrder.length) {
        datasource.sort({ ascending: !sortOrder[0].ascending, attribute }, { add });
    } else {
        datasource.sort({ ascending: true, attribute }, { add });
    }
}

/**
 * drops the dragged field on `target` (from dropTargetAt):
 * - the panel: group on it, unless already grouped on it
 * - the left zone of a group chip: group on it at that place in the grouping (a chip changes its place)
 * - left / right zone of a label cell: the field becomes a column of its own, left / right of that column
 * - top / bottom zone: the field is stacked above / below that cell, in its column
 * - center zone: the two fields swap places
 *
 * The field leaves its old place (a field from the column chooser has none). A group chip can only be
 * moved within the panel.
 */
function dropColumn(ctx: Grid, source: DragSource, target: HTMLElement) {
    const { attribute, cellno, coltype, column } = source;
    const classList = target.classList;
    // a drop zone is a child of its label cell or group chip
    const parent = target.parentElement as HTMLCellElement;
    const newAttribute = parent.$attribute;
    const newCellno = parent.$celno;
    const newColtype = parent.$coltype;
    const newColumn = parent.$column;
    const isPanel = classList.contains('simple-html-grid-panel');

    // a group chip from the top panel can only be moved within the panel. It has no column of its own,
    // so dropped on a column it would insert a duplicate column or overwrite the one it landed on
    const chipOnColumn = source.isChip && !isPanel && !classList.contains('simple-html-grid-drop-zone-left-panel');

    if (!((newAttribute && newAttribute !== attribute) || isPanel) || chipOnColumn) {
        return;
    }

    const columnCenter = ctx.gridInterface.__getGridConfig().layout.center;
    const columnLeft = ctx.gridInterface.__getGridConfig().layout.left;
    const columnRight = ctx.gridInterface.__getGridConfig().layout.right;

    const attributeLabel = getColumnLabel(ctx, attribute);

    switch (true) {
        case classList.contains('simple-html-grid-panel'): {
            const newGrouping = ctx.gridInterface.getDatasource().getGrouping();

            // already grouped on this column - grouping on it twice only nests
            // every group inside an identical one
            if (!newGrouping.some((e) => e.attribute === attribute)) {
                newGrouping.push({ attribute: attribute, title: attributeLabel });
                ctx.gridInterface.getDatasource().group(newGrouping);
            }

            break;
        }
        case classList.contains('simple-html-grid-drop-zone-left-panel'): {
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

            updateGrouping.splice(index, 0, { attribute: attribute, title: attributeLabel });

            ctx.gridInterface.getDatasource().group(updateGrouping);

            break;
        }
        case classList.contains('simple-html-grid-drop-zone-left'):
            /**
             * old
             */
            if (coltype === 'left-pinned') {
                columnLeft[column].fields.splice(cellno, 1);
            }

            if (coltype === 'middle-pinned') {
                columnCenter[column].fields.splice(cellno, 1);
            }

            if (coltype === 'right-pinned') {
                columnRight[column].fields.splice(cellno, 1);
            }

            /**
             * new
             */
            if (newColtype === 'left-pinned') {
                columnLeft.splice(newColumn, 0, { fields: [attribute], width: 100 });
            }

            if (newColtype === 'middle-pinned') {
                columnCenter.splice(newColumn, 0, { fields: [attribute], width: 100 });
            }

            if (newColtype === 'right-pinned') {
                columnRight.splice(newColumn, 0, { fields: [attribute], width: 100 });
            }

            ctx.rebuild();

            break;
        case classList.contains('simple-html-grid-drop-zone-top'):
        case classList.contains('simple-html-grid-drop-zone-bottom'): {
            // above or below the cell it was dropped on
            let insertAt = classList.contains('simple-html-grid-drop-zone-top') ? newCellno : newCellno + 1;

            // the old cell is taken out first. Moving within the same column, a
            // cell that sat above the drop point moves everything below it up one.
            // (inserting first shifted the old cell, and the removal then hit the
            // wrong row - one attribute lost, the dragged one duplicated)
            if (coltype === newColtype && column === newColumn && cellno < insertAt) {
                insertAt = insertAt - 1;
            }

            /**
             * old
             */
            if (coltype === 'left-pinned') {
                columnLeft[column].fields.splice(cellno, 1);
            }

            if (coltype === 'middle-pinned') {
                columnCenter[column].fields.splice(cellno, 1);
            }

            if (coltype === 'right-pinned') {
                columnRight[column].fields.splice(cellno, 1);
            }

            /**
             * new
             */
            if (newColtype === 'left-pinned') {
                columnLeft[newColumn].fields.splice(insertAt, 0, attribute);
            }

            if (newColtype === 'middle-pinned') {
                columnCenter[newColumn].fields.splice(insertAt, 0, attribute);
            }

            if (newColtype === 'right-pinned') {
                columnRight[newColumn].fields.splice(insertAt, 0, attribute);
            }

            ctx.rebuild();
            break;
        }
        case classList.contains('simple-html-grid-drop-zone-right'):
            /**
             * old
             */
            if (coltype === 'left-pinned') {
                columnLeft[column].fields.splice(cellno, 1);
            }

            if (coltype === 'middle-pinned') {
                columnCenter[column].fields.splice(cellno, 1);
            }

            if (coltype === 'right-pinned') {
                columnRight[column].fields.splice(cellno, 1);
            }
            /**
             * new
             */
            if (newColtype === 'left-pinned') {
                const x = newColumn + 1;
                columnLeft.splice(x, 0, { fields: [attribute], width: 100 });
            }

            if (newColtype === 'middle-pinned') {
                const x = newColumn + 1;
                columnCenter.splice(x, 0, { fields: [attribute], width: 100 });
            }

            if (newColtype === 'right-pinned') {
                const x = newColumn + 1;
                columnRight.splice(x, 0, { fields: [attribute], width: 100 });
            }

            ctx.rebuild();

            break;
        case classList.contains('simple-html-grid-drop-zone-center'):
            /**
             * new
             */
            if (newColtype === 'left-pinned') {
                columnLeft[newColumn].fields[newCellno] = attribute;
            }

            if (newColtype === 'middle-pinned') {
                columnCenter[newColumn].fields[newCellno] = attribute;
            }

            if (newColtype === 'right-pinned') {
                columnRight[newColumn].fields[newCellno] = attribute;
            }
            /**
             * old - just replace
             * a drop zone is not the panel, so the if above made sure newAttribute is set
             */
            if (coltype === 'left-pinned') {
                columnLeft[column].fields[cellno] = newAttribute!;
            }

            if (coltype === 'middle-pinned') {
                columnCenter[column].fields[cellno] = newAttribute!;
            }

            if (coltype === 'right-pinned') {
                columnRight[column].fields[cellno] = newAttribute!;
            }

            ctx.rebuild();

            break;
    }
}
