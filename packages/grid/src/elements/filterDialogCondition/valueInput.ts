import { html } from 'lit-html';
import { FilterArgument } from '../../types';

/**
 * returns input based on type
 */
export function valueInput(operatorObject: FilterArgument) {
    if (operatorObject.operator === 'IN' || operatorObject.operator === 'NOT_IN') {
        return html`<textarea
            class="dialog-item-y"
            style="text-align: center;"
            @input=${(e: any) => {
                const x: any[] = e.target.value.split('\n');
                if (x[x.length - 1] === '') {
                    x.pop();
                }
                operatorObject.value = x as any;
            }}
        >
${Array.isArray(operatorObject.value)
                ? operatorObject.value.join('\n')
                : operatorObject.value}</textarea
        >`;
    }

    switch (operatorObject.attributeType) {
        case 'boolean':
            return html`<input
                class="dialog-item-y"
                style="text-align: center;"
                type="checkbox"
                .checked=${operatorObject.value}
                @change=${(e: any) => {
                    operatorObject.value = e.target.checked;
                }}
                @input=${(e: any) => {
                    operatorObject.value = e.target.checked;
                }}
            />`;
        case 'image':
        // nothing
        case 'empty':
        // nothing
        case 'date':
            return html`<input
                class="dialog-item-y"
                style="text-align: center;"
                type="date"
                .valueAsDate=${operatorObject.value || null}
                @input=${(e: any) => {
                    operatorObject.value = e.target.valueAsDate;
                }}
            />`;
        case 'number':
            return html`<input
                class="dialog-item-y"
                style="text-align: center;"
                type="number"
                .valueAsNumber=${operatorObject.value}
                @input=${(e: any) => {
                    operatorObject.value = e.target.valueAsNumber;
                }}
            />`;
        default:
            return html`<input
                class="dialog-item-y"
                style="text-align: center;"
                value=${operatorObject.value}
                @input=${(e: any) => {
                    operatorObject.value = e.target.value;
                }}
            />`;
    }
}
