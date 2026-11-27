import type { Grid } from '../grid';
import { TOTALS_CLASS } from './aggregates';
import { asPx } from './asPx';
import { detailFormSpace, placeDetailForm } from './detailForm';
import { LEFT_PINNED_COLTYPE } from './GROUP_COLTYPE';
import { getElementByClassName } from './getElementByClassName';
import { getGroupingWidth } from './getGroupingWidth';

/**
 * the class of the block at the right end of the header, over the rows' vertical scrollbar (createDom):
 * `__scrollbarSize` wide, the header's columns end where the rows' end
 */
export const HEADER_GUTTER_CLASS = 'simple-html-grid-header-gutter';

export function updateMainElementSizes(ctx: Grid) {
    const config = ctx.gridInterface.__getGridConfig();

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
        // only filter cells left, they are cellHeight tall
        headerHeight = config.__rowHeight * 1;
    }
    if (!config.hideLabels && config.hideFilter) {
        // only label cells left, they are cellHeaderLabelHeight tall (can be taller than cellHeight)
        headerHeight = config.__columnCells * config.cellHeaderLabelHeight;
    }
    if (config.hideLabels && config.hideFilter) {
        headerHeight = 0;
    }

    header.style.height = asPx(headerHeight + config.selectSizeHeight);

    // the detail form (GridConfig.detailForm, detailForm.ts) takes its room at the right of the header,
    // the rows, their scrollbars and the totals row - or under the totals row, over the footer, in a
    // narrow grid. The grouping panel and the footer stay as wide as the grid
    const form = detailFormSpace(ctx);
    header.style.right = asPx(form.right);

    // the totals row (GridConfig.totalsRow) is over the footer, the rows end above it. The horizontal
    // scrollbar is at the bottom of the rows: the totals row's top is the band it is painted over, as
    // the footer's top is without a totals row
    const totalsHeight = config.__totalsRowHeight ? config.__totalsRowHeight + config.__scrollbarSize : 0;
    const bottom = config.footerHeight + form.below + totalsHeight;

    const body = getElementByClassName(ctx.element, 'simple-html-grid-body');
    body.style.top = asPx(config.panelHeight + headerHeight + config.selectSizeHeight);
    body.style.bottom = asPx(bottom);
    body.style.right = asPx(config.__scrollbarSize + form.right);

    const scrollerBody = getElementByClassName(ctx.element, 'simple-html-grid-body-scroller');
    scrollerBody.style.top = asPx(config.panelHeight + headerHeight + config.selectSizeHeight);
    scrollerBody.style.bottom = asPx(bottom);
    scrollerBody.style.right = asPx(form.right);

    const scrollerMiddle = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller');
    scrollerMiddle.style.top = asPx(config.panelHeight + headerHeight + config.selectSizeHeight);
    scrollerMiddle.style.bottom = asPx(bottom - config.__scrollbarSize);
    scrollerMiddle.style.left = asPx(config.__selectSizeWidth + leftWidth);
    scrollerMiddle.style.right = asPx(config.__rightWidth + config.__scrollbarSize + form.right);

    const footer = getElementByClassName(ctx.element, 'simple-html-grid-footer');
    footer.style.height = asPx(config.footerHeight);

    // made by createDom: a grid built before it had a totals row has none
    const totals = getElementByClassName(ctx.element, TOTALS_CLASS);
    if (totals) {
        totals.style.display = totalsHeight ? 'block' : 'none';
        totals.style.bottom = asPx(config.footerHeight + form.below);
        totals.style.height = asPx(totalsHeight);
        totals.style.right = asPx(config.__scrollbarSize + form.right);
    }

    placeDetailForm(ctx, form);

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

    // the header's middle and right columns end where the rows' do: before the rows' vertical scrollbar
    // (the body's right). The same room, so the two scroll as far and stay over each other - also on a
    // phone, whose scrollbars take no room. The gutter fills the corner over the scrollbar
    const headerViewPortMiddle = getElementByClassName(ctx.element, 'simple-html-grid-header-view-pinned-middle');
    headerViewPortMiddle.style.left = asPx(config.__selectSizeWidth + leftWidth);
    headerViewPortMiddle.style.right = asPx(config.__rightWidth + config.__scrollbarSize);

    const headerViewPortRight = getElementByClassName(ctx.element, 'simple-html-grid-header-view-pinned-right');
    headerViewPortRight.style.width = asPx(config.__rightWidth);
    headerViewPortRight.style.right = asPx(config.__scrollbarSize);

    // made by createDom: a grid built before it has none
    const gutter = ctx.element.getElementsByClassName(HEADER_GUTTER_CLASS)[0] as HTMLElement | undefined;
    if (gutter) {
        gutter.style.width = asPx(config.__scrollbarSize);
    }
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
