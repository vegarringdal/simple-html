import { FilterArgument } from '../../types';

/**
 * delete btn, removes condition
 */
export function deleteBtn(ctx: any, operatorObjectArr: FilterArgument[], i: number) {
    const xmlns = 'http://www.w3.org/2000/svg';
    const svgEl = document.createElementNS(xmlns, 'svg');

    svgEl.setAttributeNS(null, 'viewBox', '0 0 24 24');
    svgEl.setAttributeNS(null, 'fill', 'none');
    svgEl.setAttributeNS(null, 'stroke-linecap', 'round');
    svgEl.setAttributeNS(null, 'stroke-linejoin', 'round');
    svgEl.setAttributeNS(null, 'stroke-width', '2');
    svgEl.setAttributeNS(null, 'stroke', 'currentColor');
    const svgElpath = document.createElementNS(xmlns, 'path');
    svgElpath.setAttributeNS(
        null,
        'd',
        'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
    );
    svgEl.appendChild(svgElpath);

    const el = document.createElement('button');
    el.classList.add('dialog-item-x', 'dialog-condition-trash');
    el.onclick = () => {
        operatorObjectArr && operatorObjectArr.splice(i, 1);
        ctx.render();
    };
    el.appendChild(svgEl);
    return el;
}
