import { FilterArgument } from '../../types';
import { SimpleHtmlGridFilterDialog } from '../simple-html-grid-filter-dialog';

/**
 * delete btn, removes condition
 */
export function deleteBtn(
    ctx: SimpleHtmlGridFilterDialog,
    operatorObjectArr: FilterArgument[],
    i: number
) {
    const xmlns = 'http://www.w3.org/2000/svg';
    const svgElDelete = document.createElementNS(xmlns, 'svg');

    svgElDelete.setAttributeNS(null, 'viewBox', '0 0 24 24');
    svgElDelete.setAttributeNS(null, 'fill', 'none');
    svgElDelete.setAttributeNS(null, 'stroke-linecap', 'round');
    svgElDelete.setAttributeNS(null, 'stroke-linejoin', 'round');
    svgElDelete.setAttributeNS(null, 'stroke-width', '2');
    svgElDelete.setAttributeNS(null, 'stroke', 'currentColor');
    const svgElpath = document.createElementNS(xmlns, 'path');
    svgElpath.setAttributeNS(
        null,
        'd',
        'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
    );
    svgElDelete.appendChild(svgElpath);

    const el = document.createElement('button');
    el.classList.add('dialog-item-x', 'dialog-condition-trash');
    el.onclick = () => {
        operatorObjectArr && operatorObjectArr.splice(i, 1);
        ctx.generate();
    };
    el.appendChild(svgElDelete);
    return el;
}
