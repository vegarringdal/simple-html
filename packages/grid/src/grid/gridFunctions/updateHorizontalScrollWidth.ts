import { asPx } from './asPx';
import { getElementByClassName } from './getElementByClassName';
import { Grid } from '../grid';

/**
 * ctx adjust middle viewport, so scrolling width is correct compared to total columns and their width
 * @param height
 */
export function updateHorizontalScrollWidth(ctx: Grid) {
    const middlec = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller-body');
    middlec.style.width = asPx(
        ctx.gridInterface
            .__getGridConfig()
            .columnsCenter.map((e) => e.width)
            .reduce((prev, cur) => prev + cur, 0)
    );

    const middlex = getElementByClassName(ctx.element, 'simple-html-grid-body-row-container-pinned-middle');
    middlex.style.width = asPx(
        ctx.gridInterface
            .__getGridConfig()
            .columnsCenter.map((e) => e.width)
            .reduce((prev, cur) => prev + cur, 0)
    );
    const middleh = getElementByClassName(ctx.element, 'simple-html-grid-header-row-container-pinned-middle');
    middleh.style.width = asPx(
        ctx.gridInterface
            .__getGridConfig()
            .columnsCenter.map((e) => e.width)
            .reduce((prev, cur) => prev + cur, 0)
    );
}
