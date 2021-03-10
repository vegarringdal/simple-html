import { SimpleHtmlGridFilterDialog } from '../simple-html-grid-filter-dialog';
import { FilterArgument } from '../../types';

/**
 * returns input based on type
 */
export function valueInput(operatorObject: FilterArgument, ctx: SimpleHtmlGridFilterDialog) {
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
            el.placeholder = ctx.connector.dateFormater.getPlaceHolderDate();
            el.value = ctx.connector.dateFormater.fromDate(operatorObject.value as any);
            el.onchange = (e: any) => {
                operatorObject.value = ctx.connector.dateFormater.toDate(e.target.value);
            };
            el.oninput = (e: any) => {
                operatorObject.value = e.target.value;
            };
            return el;
        case 'number':
            el.type = 'text';
            el.value = ctx.connector.numberFormater.fromNumber(operatorObject.value as any);
            el.oninput = (e: any) => {
                operatorObject.value = ctx.connector.numberFormater.toNumber(e.target.value);
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
