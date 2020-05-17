import { html } from 'lit-html';
import { FilterArgument } from '../../interfaces';
import { generateMenu } from '../generateMenu';

export const OPERATORS = {
    EQUAL: '===',
    LESS_THAN_OR_EQUAL_TO: '<=',
    GREATER_THAN_OR_EQUAL_TO: '>=',
    LESS_THAN: '<',
    GREATER_THAN: '>',
    CONTAINS: '*',
    NOT_EQUAL_TO: '!==',
    DOES_NOT_CONTAIN: '!*',
    BEGIN_WITH: 'x*',
    END_WITH: '*x'
};

/**
 * returns list of operators user can use
 */
export function selectOperatorBtn(operatorObject: FilterArgument, ctx: any) {
    return html` <button
        class="dialog-item-y"
        @click=${(e: any) => {
            generateMenu(e, [
                {
                    title: 'Begin with',
                    callback: () => {
                        operatorObject.operator = 'BEGIN_WITH';
                        ctx.render();
                    }
                },
                {
                    title: 'Equal to',
                    callback: () => {
                        operatorObject.operator = 'EQUAL';
                        ctx.render();
                    }
                },
                {
                    title: 'Contains',
                    callback: () => {
                        operatorObject.operator = 'CONTAINS';
                        ctx.render();
                    }
                },
                {
                    title: 'Does not contain',
                    callback: () => {
                        operatorObject.operator = 'DOES_NOT_CONTAIN';
                        ctx.render();
                    }
                },
                {
                    title: 'End with',
                    callback: () => {
                        operatorObject.operator = 'END_WITH';
                        ctx.render();
                    }
                },
                {
                    title: 'Greater than',
                    callback: () => {
                        operatorObject.operator = 'GREATER_THAN';
                        ctx.render();
                    }
                },
                {
                    title: 'Greater than or equal to',
                    callback: () => {
                        operatorObject.operator = 'GREATER_THAN_OR_EQUAL_TO';
                        ctx.render();
                    }
                },
                {
                    title: 'Less than',
                    callback: () => {
                        operatorObject.operator = 'LESS_THAN';
                        ctx.render();
                    }
                },
                {
                    title: 'Less then or equal to',
                    callback: () => {
                        operatorObject.operator = 'LESS_THAN_OR_EQUAL_TO';
                        ctx.render();
                    }
                },
                {
                    title: 'Not Equal to',
                    callback: () => {
                        operatorObject.operator = 'NOT_EQUAL_TO';
                        ctx.render();
                    }
                }
            ]);
        }}
    >
        <b>${OPERATORS[operatorObject.operator]}</b>
    </button>`;
}
