import { FilterArgument } from '../../types';
import { generateMenu } from '../generateMenu';
import { OPERATORS } from '@simple-html/datasource';

/**
 * returns list of operators user can use
 */
export function selectOperatorBtn(operatorObject: FilterArgument, ctx: any) {
    const el = document.createElement('button');
    el.classList.add('dialog-item-y');
    el.onclick = (e: any) => {
        generateMenu(e, [
            {
                title: 'Starts with',
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
            },
            {
                title: 'IN',
                callback: () => {
                    operatorObject.operator = 'IN';
                    ctx.render();
                }
            },
            {
                title: 'NOT IN',
                callback: () => {
                    operatorObject.operator = 'NOT_IN';
                    ctx.render();
                }
            }
        ]);
    };
    const boldEl = document.createElement('b');
    boldEl.appendChild(document.createTextNode(OPERATORS[operatorObject.operator]));
    el.appendChild(boldEl);
    return el;
}
