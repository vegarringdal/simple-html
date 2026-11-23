import type { Grid } from '../grid';
import { addMenuListeners } from './addMenuListeners';
import { addScrollEventListeners } from './addScrollEventListeners';
import { TOTALS_CLASS } from './aggregates';
import { ariaId, createAriaGrid } from './ariaGrid';
import { createElement } from './createElement';
import { DIV } from './DIV';
import { createDetailForm, renderDetailForm } from './detailForm';
import { findKeydown } from './findBar';
import { horizontalScrollHandler } from './horizontalScrollHandler';
import { trackPresses } from './lastPress';
import { addLongPress } from './longPress';
import { addClipboardListeners } from './rangeClipboard';
import { addRangeListeners } from './rangeSelection';
import { rebuildFooter } from './rebuildFooter';
import { rebuildHeaderColumns } from './rebuildHeaderColumns';
import { rebuildRowColumns } from './rebuildRowColumns';
import { rebuildRows } from './rebuildRows';
import { rebuildTopPanel } from './rebuildTopPanel';
import { onGridFocusOut } from './renderChangedRows';
import { shortcutHelpKeydown } from './shortcutHelp';
import { addFooterKeys, createTabExits } from './tabExit';
import { attachTooltips, tooltipsEnabled } from './tooltip';
import { updateHorizontalScrollWidth } from './updateHorizontalScrollWidth';
import { updateMainElementSizes } from './updateMainElementSizes';
import { updateVerticalScrollHeight } from './updateVerticalScrollHeight';
import { verticalScrollHandler } from './verticalScrollHandler';

export function createDom(ctx: Grid) {
    const panel = createElement(DIV, 'simple-html-grid-panel');
    const header = createElement(DIV, 'simple-html-grid-header');
    const body = createElement(DIV, 'simple-html-grid-body');

    // focus helper: the wheel focuses it and blurs it again, to take the focus from the cell being
    // edited (its row element is reused for another row while scrolling). A swipe blurs the cell
    // itself (touchScroll.ts): focusing an input could show a phone's keyboard. Not a cell, so not in
    // the tab order and hidden from a screen reader
    const tmp = document.createElement('input');
    tmp.style.opacity = '0';
    tmp.tabIndex = -1;
    tmp.setAttribute('aria-hidden', 'true');

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
    // the totals row (GridConfig.totalsRow): between the rows and the footer, see aggregates.ts. The
    // scrollbars are put after it, the horizontal one is painted over its top
    const totals = createElement(DIV, TOTALS_CLASS);

    ctx.element.appendChild(panel);
    // the grid a screen reader gets, see ariaGrid.ts
    ctx.element.appendChild(createAriaGrid(ctx));
    // Shift+Tab from the first header filter leaves the grid from here, see tabExit.ts
    createTabExits(ctx);
    ctx.element.appendChild(ctx.tabExitStart);
    ctx.element.appendChild(header);
    ctx.element.appendChild(body);
    ctx.element.appendChild(footer);
    ctx.element.appendChild(totals);
    ctx.element.appendChild(bodyScroller);
    ctx.element.appendChild(middleScroller);
    // the detail form (GridConfig.detailForm): at the right of the rows, see detailForm.ts. Moved to the
    // end below
    ctx.element.appendChild(createDetailForm(ctx));

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
    // the top left corner, above the row numbers: their column header (click selects all rows)
    headerRowConainerSelector.id = ariaId(ctx, 'corner');
    headerRowConainerSelector.setAttribute('role', 'columnheader');
    headerRowConainerSelector.setAttribute('aria-colindex', '1');
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
    // a cell left out of a render while it was typed in is rendered once the focus leaves it
    ctx.element.addEventListener('focusout', () => onGridFocusOut(ctx), { signal: ctx.scrollListenersAbort?.signal });
    addMenuListeners(ctx);
    // a long press of a finger opens the context menu of what it is on, as a right click does
    addLongPress(ctx.element, ctx.scrollListenersAbort?.signal);
    // a tap on a row or column number toggles it, as Ctrl+click; the active cell of a menu: the last
    // press, see lastPress.ts
    trackPresses(ctx);
    // Find: Ctrl+F (Cmd+F) and F3 anywhere in the grid, see findBar.ts
    ctx.element.addEventListener('keydown', (event) => findKeydown(ctx, event), { signal: ctx.scrollListenersAbort?.signal });
    // the keyboard shortcuts help: `?` where it types nothing, Ctrl+/ (Cmd+/) anywhere in the grid, see shortcutHelp.ts
    ctx.element.addEventListener('keydown', (event) => shortcutHelpKeydown(ctx, event), {
        signal: ctx.scrollListenersAbort?.signal
    });
    // Tab in the footer: out of the grid after its last button, back to the rows before its first, see tabExit.ts
    addFooterKeys(ctx, footer);
    // the cell ranges: the mouse on the cells, copy and paste
    addRangeListeners(ctx);
    addClipboardListeners(ctx);
    // the validation messages of the cells and the row selectors. The body is made once, the
    // `tooltips` option is read on every hover: updateConfig() can change it
    attachTooltips(body, () => tooltipsEnabled(ctx));

    updateVerticalScrollHeight(ctx, ctx.gridInterface.__getScrollState().scrollHeight);
    updateHorizontalScrollWidth(ctx);

    // a new dom starts at the top/left. A last position far away would make the handler hide all rows
    ctx.lastScrollTop = 0;
    ctx.lastScrollLeft = 0;
    horizontalScrollHandler(ctx, 0);
    verticalScrollHandler(ctx, 0, true);
    ctx.element.appendChild(body);
    // the detail form after the cells: the browser's Tab goes from its last field out of the grid, see
    // tabExit.ts
    if (ctx.detailForm) {
        ctx.element.appendChild(ctx.detailForm);
    }
    renderDetailForm(ctx);
    // and Tab from the last cell from here, after the cells in the dom
    ctx.element.appendChild(ctx.tabExitEnd);

    ctx.oldHeight = ctx.element.clientHeight;
    ctx.oldWidth = ctx.element.clientWidth;
}
