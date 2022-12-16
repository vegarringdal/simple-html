import { addScrollEventListeners } from './addScrollEventListeners';
import { creatElement } from './createElement';
import { DIV, Grid } from './grid';
import { horizontalScrollHandler } from './horizontalScrollHandler';
import { rebuildFooter } from './rebuildFooter';
import { rebuildHeaderColumns } from './rebuildHeaderColumns';
import { rebuildRowColumns } from './rebuildRowColumns';
import { rebuildRows } from './rebuildRows';
import { rebuildTopPanel } from './rebuildTopPanel';
import { updateMainElementSizes } from './updateMainElementSizes';
import { verticalScrollHandler } from './verticalScrollHandler';

export function createDom(ctx: Grid) {
    const panel = creatElement(DIV, 'simple-html-grid-panel');
    const header = creatElement(DIV, 'simple-html-grid-header');
    const body = creatElement(DIV, 'simple-html-grid-body');

    // focus helper
    const tmp = document.createElement('input');
    tmp.style.opacity = '0';

    body.appendChild(tmp);
    ctx.focusElement = tmp;

    // will be used for scrollbar on right
    const bodyScroller = creatElement(DIV, 'simple-html-grid-body-scroller');
    const bodyScrollerRows = creatElement(DIV, 'simple-html-grid-body-scroller-rows');
    bodyScroller.appendChild(bodyScrollerRows);

    // will be used for scrollbar on middle bottom
    const middleScroller = creatElement(DIV, 'simple-html-grid-middle-scroller');
    const middleScrollerBody = creatElement(DIV, 'simple-html-grid-middle-scroller-body');
    middleScroller.appendChild(middleScrollerBody);

    const footer = creatElement(DIV, 'simple-html-grid-footer');

    ctx.element.appendChild(panel);
    ctx.element.appendChild(header);
    ctx.element.appendChild(body);
    ctx.element.appendChild(footer);
    ctx.element.appendChild(bodyScroller);
    ctx.element.appendChild(middleScroller);

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

    ctx.body = body;
    updateMainElementSizes(ctx);
    rebuildRows(ctx);
    rebuildRowColumns(ctx);
    rebuildHeaderColumns(ctx);
    rebuildTopPanel(ctx);
    rebuildFooter(ctx);
    addScrollEventListeners(ctx);
    ctx.addClickEventListener();

    ctx.updateVerticalScrollHeight(ctx.gridInterface.__getScrollState().scrollHeight);
    ctx.updateHorizontalScrollWidth();
    horizontalScrollHandler(ctx, 0);
    verticalScrollHandler(ctx, 0);
    ctx.element.appendChild(body);

    ctx.oldHeight = ctx.element.clientHeight;
    ctx.oldWidth = ctx.element.clientWidth;
}
