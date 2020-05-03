import { html } from 'lit-html';
import { OperatorObject } from '../../interfaces';

/**
 * sets if value is input or btn to select attibutes
 */
export function selectAttributeOrInputBtn(operatorObject: OperatorObject, ctx: any) {
    return html` <button
        class="dialog-item-x"
        @click=${() => {
            operatorObject.valueType = operatorObject.valueType === 'VALUE' ? 'ATTRIBUTE' : 'VALUE';
            ctx.render();
        }}
    >
        <svg
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            ></path>
        </svg>
    </button>`;
}
