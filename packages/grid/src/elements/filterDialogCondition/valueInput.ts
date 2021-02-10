import { FilterArgument } from '../../types';

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
            el.type = 'date';
            el.valueAsDate =
                typeof operatorObject.value === 'string' || typeof operatorObject.value === 'number'
                    ? new Date(operatorObject.value)
                    : operatorObject.value || null;
            el.onchange = (e: any) => {
                operatorObject.value = e.target.checked;
            };
            el.oninput = (e: any) => {
                operatorObject.value = e.target.valueAsDate;
            };
            return el;
        case 'number':
            el.type = 'number';
            el.valueAsNumber = operatorObject.value as number;
            el.oninput = (e: any) => {
                operatorObject.value = e.target.valueAsNumber;
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
