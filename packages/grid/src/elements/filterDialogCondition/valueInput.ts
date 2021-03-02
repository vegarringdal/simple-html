import { FilterArgument } from '../../types';
import { dateToString, getPlaceHolderDate, stringToDate } from '../../dateHelper';

/**
 * returns input based on type
 */
export function valueInput(operatorObject: FilterArgument) {
    if (operatorObject.operator === 'IN' || operatorObject.operator === 'NOT_IN') {
        const el = document.createElement('textarea');
        el.classList.add('dialog-item-y');
        el.style.textAlign = 'center';
        el.oninput = (e: any) => {
            const x: any[] = e.target.value.toUpperCase().split('\n');
            if (x[x.length - 1] === '') {
                x.pop();
            }
            operatorObject.value = x as any;
        };

        el.textContent = Array.isArray(operatorObject.value)
            ? operatorObject.value.join('\n')
            : operatorObject.value.toString();

        return el;
    }

    const el = document.createElement('input');
    el.classList.add('dialog-item-y');
    el.style.textAlign = 'center';

    switch (operatorObject.attributeType) {
        case 'boolean':
            el.type = 'checkbox';
            el.checked = (operatorObject.value as unknown) as boolean;
            el.onchange = (e: any) => {
                operatorObject.value = e.target.checked;
            };
            el.oninput = (e: any) => {
                operatorObject.value = e.target.checked;
            };
            return el;
        case 'image':
        // nothing
        case 'empty':
        // nothing
        case 'date':
            el.type = 'text';
            el.placeholder = getPlaceHolderDate();
            el.value = dateToString(operatorObject.value);
            el.onchange = (e: any) => {
                operatorObject.value = stringToDate(e.target.value);
            };
            el.oninput = (e: any) => {
                operatorObject.value = e.target.value;
            };
            return el;
        case 'number':
            el.type = 'text';
            el.value = isNaN(operatorObject.value as any) ? '' : (operatorObject.value as string);
            el.oninput = (e: any) => {
                operatorObject.value = e.target.value;
            };
            return el;
        default:
            el.type = 'text';
            el.value = operatorObject.value as any;
            el.oninput = (e: any) => {
                operatorObject.value = e.target.value;
            };
            return el;
    }
}
