import { asPx } from './asPx';
import { getElementByClassName } from './getElementByClassName';
import { Grid } from '../grid';
import { LEFT_PINNED_COLTYPE } from './GROUP_COLTYPE';
import { getGroupingWidth } from './getGroupingWidth';

export function updateMainElementSizes(ctx: Grid) {
    const config = ctx.gridInterface.__getGridConfig();

    ctx.element.setAttribute('role', 'table');

    /**
     * main elements
     */

    const leftGrouping = getGroupingWidth(ctx, LEFT_PINNED_COLTYPE);
    const leftWidth = config.__leftWidth + leftGrouping;

    const panel = getElementByClassName(ctx.element, 'simple-html-grid-panel');
    panel.style.height = asPx(config.panelHeight);

    const header = getElementByClassName(ctx.element, 'simple-html-grid-header');
    header.style.top = asPx(config.panelHeight);

    let headerHeight = config.__rowHeaderHeight;
    if (config.hideLabels && !config.hideFilter) {
        headerHeight = config.__rowHeight * 1;
    }
    if (!config.hideLabels && config.hideFilter) {
        headerHeight = config.__rowHeight * 1;
    }
    if (config.hideLabels && config.hideFilter) {
        headerHeight = 0;
    }

    header.style.height = asPx(headerHeight + config.selectSizeHeight);

    const body = getElementByClassName(ctx.element, 'simple-html-grid-body');
    body.style.top = asPx(config.panelHeight + headerHeight + config.selectSizeHeight);
    body.style.bottom = asPx(config.footerHeight);
    body.style.right = asPx(config.__scrollbarSize);

    const scrollerBody = getElementByClassName(ctx.element, 'simple-html-grid-body-scroller');
    scrollerBody.style.top = asPx(config.panelHeight + headerHeight + config.selectSizeHeight);
    scrollerBody.style.bottom = asPx(config.footerHeight);

    const scrollerMiddle = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller');
    scrollerMiddle.style.top = asPx(config.panelHeight + headerHeight + config.selectSizeHeight);
    scrollerMiddle.style.bottom = asPx(config.footerHeight - config.__scrollbarSize);
    scrollerMiddle.style.left = asPx(config.__selectSizeWidth + leftWidth);
    scrollerMiddle.style.right = asPx(config.__rightWidth + config.__scrollbarSize);

    const footer = getElementByClassName(ctx.element, 'simple-html-grid-footer');
    footer.style.height = asPx(config.footerHeight);

    /**
     * header viewports
     */

    const headerViewPortSelector = getElementByClassName(ctx.element, 'simple-html-grid-header-view-selector');
    headerViewPortSelector.style.width = asPx(config.__selectSizeWidth);

    const headerViewPortLeft = getElementByClassName(ctx.element, 'simple-html-grid-header-view-pinned-left');
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

    const headerViewPortMiddle = getElementByClassName(ctx.element, 'simple-html-grid-header-view-pinned-middle');
    headerViewPortMiddle.style.left = asPx(config.__selectSizeWidth + leftWidth);
    headerViewPortMiddle.style.right = asPx(config.__rightWidth);

    const headerViewPortRight = getElementByClassName(ctx.element, 'simple-html-grid-header-view-pinned-right');
    headerViewPortRight.style.width = asPx(config.__rightWidth);
    if (config.__rightWidth === 0) {
        headerViewPortRight.style.display = 'none';
    } else {
        headerViewPortRight.style.display = 'block';
    }

    /**
     * body viewports
     */

    const bodyViewPortGroup = getElementByClassName(ctx.element, 'simple-html-grid-body-view-group');
    bodyViewPortGroup.style.left = asPx(config.__selectSizeWidth);
    bodyViewPortGroup.style.right = asPx(0);

    const bodyViewPortSelector = getElementByClassName(ctx.element, 'simple-html-grid-body-view-selector');
    bodyViewPortSelector.style.width = asPx(config.__selectSizeWidth);

    const bodyViewPortLeft = getElementByClassName(ctx.element, 'simple-html-grid-body-view-pinned-left');
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

    const bodyViewPortMiddle = getElementByClassName(ctx.element, 'simple-html-grid-body-view-pinned-middle');
    bodyViewPortMiddle.style.left = asPx(config.__selectSizeWidth + leftWidth);
    bodyViewPortMiddle.style.right = asPx(config.__rightWidth + 0);

    const bodyViewPortRight = getElementByClassName(ctx.element, 'simple-html-grid-body-view-pinned-right');
    bodyViewPortRight.style.width = asPx(config.__rightWidth);
    bodyViewPortRight.style.right = asPx(0);
    if (config.__rightWidth === 0) {
        bodyViewPortRight.style.display = 'none';
    } else {
        bodyViewPortRight.style.display = 'block';
    }
}
