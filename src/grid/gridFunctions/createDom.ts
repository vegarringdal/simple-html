import type { Grid } from '../grid';
import { addBodyClickListener } from './addBodyClickListener';
import { addScrollEventListeners } from './addScrollEventListeners';
import { createElement } from './createElement';
import { DIV } from './DIV';
import { horizontalScrollHandler } from './horizontalScrollHandler';
import { rebuildFooter } from './rebuildFooter';
import { rebuildHeaderColumns } from './rebuildHeaderColumns';
import { rebuildRowColumns } from './rebuildRowColumns';
import { rebuildRows } from './rebuildRows';
import { rebuildTopPanel } from './rebuildTopPanel';
import { updateHorizontalScrollWidth } from './updateHorizontalScrollWidth';
import { updateMainElementSizes } from './updateMainElementSizes';
import { updateVerticalScrollHeight } from './updateVerticalScrollHeight';
import { verticalScrollHandler } from './verticalScrollHandler';

export function createDom(ctx: Grid) {
    const panel = createElement(DIV, 'simple-html-grid-panel');
    const header = createElement(DIV, 'simple-html-grid-header');
    const body = createElement(DIV, 'simple-html-grid-body');

    // focus helper
    const tmp = document.createElement('input');
    tmp.style.opacity = '0';
    tmp.setAttribute('aria-label', 'dummy cell, helper to set focus');

    body.appendChild(tmp);
    ctx.focusElement = tmp;

    // will be used for scrollbar on right
    const bodyScroller = createElement(DIV, 'simple-html-grid-body-scroller');
    const bodyScrollerRows = createElement(DIV, 'simple-html-grid-body-scroller-rows');
    bodyScroller.appendChild(bodyScrollerRows);

    // will be used for scrollbar on middle bottom
    const middleScroller = createElement(DIV, 'simple-html-grid-middle-scroller');
    const middleScrollerBody = createElement(DIV, 'simple-html-grid-middle-scroller-body');
    middleScroller.appendChild(middleScrollerBody);

    const footer = createElement(DIV, 'simple-html-grid-footer');

    ctx.element.appendChild(panel);
    ctx.element.appendChild(header);
    ctx.element.appendChild(body);
    ctx.element.appendChild(footer);
    ctx.element.appendChild(bodyScroller);
    ctx.element.appendChild(middleScroller);

    const headerViewSelector = createElement(DIV, 'simple-html-grid-header-view-selector');
    const headerViewPinnedLeft = createElement(DIV, 'simple-html-grid-header-view-pinned-left');
    const headerViewPinnedMiddle = createElement(DIV, 'simple-html-grid-header-view-pinned-middle');
    const headerViewPinnedRight = createElement(DIV, 'simple-html-grid-header-view-pinned-right');

    header.appendChild(headerViewSelector);
    header.appendChild(headerViewPinnedLeft);
    header.appendChild(headerViewPinnedMiddle);
    header.appendChild(headerViewPinnedRight);

    const bodyViewGroup = createElement(DIV, 'simple-html-grid-body-view-group');
    const bodyViewSelector = createElement(DIV, 'simple-html-grid-body-view-selector');
    const bodyViewPinnedLeft = createElement(DIV, 'simple-html-grid-body-view-pinned-left');
    const bodyViewPinnedMiddle = createElement(DIV, 'simple-html-grid-body-view-pinned-middle');
    const bodyViewPinnedRight = createElement(DIV, 'simple-html-grid-body-view-pinned-right');

    body.appendChild(bodyViewGroup);
    body.appendChild(bodyViewSelector);
    body.appendChild(bodyViewPinnedLeft);
    body.appendChild(bodyViewPinnedMiddle);
    body.appendChild(bodyViewPinnedRight);

    const bodyRowConainerGroup = createElement(DIV, 'simple-html-grid-body-row-container-group');
    const bodyRowConainerSelector = createElement(DIV, 'simple-html-grid-body-row-container-selector');
    const bodyRowConainerPinnedLeft = createElement(DIV, 'simple-html-grid-body-row-container-pinned-left');
    const bodyRowConainerPinnedMiddle = createElement(DIV, 'simple-html-grid-body-row-container-pinned-middle');
    const bodyRowConainerPinnedRight = createElement(DIV, 'simple-html-grid-body-row-container-pinned-right');

    bodyViewGroup.appendChild(bodyRowConainerGroup);
    bodyViewSelector.appendChild(bodyRowConainerSelector);
    bodyViewPinnedLeft.appendChild(bodyRowConainerPinnedLeft);
    bodyViewPinnedMiddle.appendChild(bodyRowConainerPinnedMiddle);
    bodyViewPinnedRight.appendChild(bodyRowConainerPinnedRight);

    const headerRowConainerSelector = createElement(DIV, 'simple-html-grid-header-row-container-selector');
    const headerRowConainerPinnedLeft = createElement(DIV, 'simple-html-grid-header-row-container-pinned-left');
    const headerRowConainerPinnedMiddle = createElement(DIV, 'simple-html-grid-header-row-container-pinned-middle');
    const headerRowConainerPinnedRight = createElement(DIV, 'simple-html-grid-header-row-container-pinned-right');

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
    addBodyClickListener(ctx);

    updateVerticalScrollHeight(ctx, ctx.gridInterface.__getScrollState().scrollHeight);
    updateHorizontalScrollWidth(ctx);

    // a new dom starts at the top/left. A last position far away would make the handler hide all rows
    ctx.lastScrollTop = 0;
    ctx.lastScrollLeft = 0;
    horizontalScrollHandler(ctx, 0);
    verticalScrollHandler(ctx, 0);
    ctx.element.appendChild(body);

    ctx.oldHeight = ctx.element.clientHeight;
    ctx.oldWidth = ctx.element.clientWidth;
}
