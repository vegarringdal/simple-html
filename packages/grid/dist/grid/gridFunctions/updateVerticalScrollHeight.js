import { asPx } from './asPx';
import { getElementByClassName } from './getElementByClassName';
/**
 * ctx adjust viewports, so scrolling height is correct, compared to all rows and its height
 * @param height
 */
export function updateVerticalScrollHeight(ctx, height = 0) {
    // helper
    function setHeigth(element, height) {
        if (!element?.style) {
            return;
        }
        element.style.height = asPx(height);
    }
    setHeigth(getElementByClassName(ctx.element, 'simple-html-grid-body-scroller-rows'), height);
    setHeigth(getElementByClassName(ctx.element, 'simple-html-grid-body-row-container-group'), height);
    setHeigth(getElementByClassName(ctx.element, 'simple-html-grid-body-row-container-selector'), height);
    setHeigth(getElementByClassName(ctx.element, 'simple-html-grid-body-row-container-pinned-left'), height);
    setHeigth(getElementByClassName(ctx.element, 'simple-html-grid-body-row-container-pinned-middle'), height);
    setHeigth(getElementByClassName(ctx.element, 'simple-html-grid-body-row-container-pinned-right'), height);
    setHeigth(getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller-body'), height);
}
//# sourceMappingURL=updateVerticalScrollHeight.js.map