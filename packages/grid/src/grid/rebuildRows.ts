import { asPx } from './asPx';
import { creatElement } from './createElement';
import { getElementByClassName } from './getElementByClassName';
import {
    DIV,
    Grid,
    GROUP_COLTYPE,
    LEFT_PINNED_COLTYPE,
    MIDDLE_PINNED_COLTYPE,
    RIGH_PINNED_COLTYPE,
    RowCache,
    SELECTOR_COLTYPE
} from './grid';

export function rebuildRows(ctx: Grid) {
    const scroller = getElementByClassName(ctx.element, 'simple-html-grid-body-scroller');

    const rect = scroller.getBoundingClientRect();
    const height = rect.height;
    const config = ctx.gridInterface.__getGridConfig();
    const rowsNeeded = Math.floor(height / config.cellHeight) + 5;

    /**
     * helper to generate row elements
     * @param parent
     * @param prefix
     * @returns
     */
    const addRows = (parent: HTMLElement, prefix: string) => {
        const rowCache: RowCache[] = [];

        while (parent.firstChild) {
            parent.removeChild(parent.firstChild);
        }

        for (let i = 0; i < rowsNeeded; i++) {
            const element = creatElement(DIV, 'simple-html-grid-row');
            const top = i * config.__rowHeight;
            const id = prefix + i.toString();
            element.setAttribute('row-id', id);
            element.style.transform = `translate3d(0px, ${top}px, 0px)`;
            element.style.height = asPx(ctx.gridInterface.__getScrollState().scrollHeights[i]);

            if (i % 2 === 0) {
                element.classList.add('simple-html-grid-row-even');
            } else {
                element.classList.add('simple-html-grid-row-odd');
            }

            parent.appendChild(element);
            rowCache.push({ id, row: i, top });

            ctx.rows.set(id, element);
        }
        return rowCache;
    };

    ctx.rows.clear();

    const containerGroup = getElementByClassName(ctx.element, 'simple-html-grid-body-row-container-group');
    ctx.containerGroupRowCache = addRows(containerGroup, GROUP_COLTYPE);

    const containerSelector = getElementByClassName(ctx.element, 'simple-html-grid-body-row-container-selector');
    ctx.containerSelectorRowCache = addRows(containerSelector, SELECTOR_COLTYPE);

    const containerLeft = getElementByClassName(ctx.element, 'simple-html-grid-body-row-container-pinned-left');
    ctx.containerLeftRowCache = addRows(containerLeft, LEFT_PINNED_COLTYPE);

    const containerMiddle = getElementByClassName(ctx.element, 'simple-html-grid-body-row-container-pinned-middle');
    ctx.containerMiddleRowCache = addRows(containerMiddle, MIDDLE_PINNED_COLTYPE);

    const containerRight = getElementByClassName(ctx.element, 'simple-html-grid-body-row-container-pinned-right');
    ctx.containerRightRowCache = addRows(containerRight, RIGH_PINNED_COLTYPE);
}
