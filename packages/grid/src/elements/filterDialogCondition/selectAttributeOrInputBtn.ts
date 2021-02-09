import { FilterArgument } from '../../types';

/**
 * sets if value is input or btn to select attibutes
 */
export function selectAttributeOrInputBtn(operatorObject: FilterArgument, ctx: any) {
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
        'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
    );
    svgEl.appendChild(svgElpath);

    const el = document.createElement('button');
    el.classList.add('dialog-item-x', 'dialog-condition-type');
    el.onclick = () => {
        operatorObject.valueType = operatorObject.valueType === 'VALUE' ? 'ATTRIBUTE' : 'VALUE';
        ctx.render();
    };
    el.appendChild(svgEl)
    return el;
}
