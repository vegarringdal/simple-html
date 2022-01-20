import { FilterArgument } from '../../types';
import { generateMenu } from '../generateMenu';
import { OPERATORS } from '@simple-html/datasource';
import { SimpleHtmlGridFilterDialog } from '../simple-html-grid-filter-dialog';

/**
 * returns list of operators user can use
 */
export function selectOperatorBtn(operatorObject: FilterArgument, ctx: SimpleHtmlGridFilterDialog) {
    const el = document.createElement('button');
    el.style.margin = '1px';
    el.classList.add('dialog-item-y');
    el.onclick = (e: any) => {
        generateMenu(e, [
            {
                operator: 'BEGIN_WITH',
                title: 'Begin with',
                callback: () => {
                    operatorObject.operator = 'BEGIN_WITH';
                    ctx.generate();
                }
            },
            {
                operator: 'EQUAL',
                title: 'Equal to',
                callback: () => {
                    operatorObject.operator = 'EQUAL';
                    ctx.generate();
                }
            },
            {
                operator: 'CONTAINS',
                title: 'Contains',
                callback: () => {
                    operatorObject.operator = 'CONTAINS';
                    ctx.generate();
                }
            },
            {
                operator: 'DOES_NOT_CONTAIN',
                title: 'Does not contain',
                callback: () => {
                    operatorObject.operator = 'DOES_NOT_CONTAIN';
                    ctx.generate();
                }
            },
            {
                operator: 'END_WITH',
                title: 'End with',
                callback: () => {
                    operatorObject.operator = 'END_WITH';
                    ctx.generate();
                }
            },
            {
                operator: 'GREATER_THAN',
                title: 'Greater than',
                callback: () => {
                    operatorObject.operator = 'GREATER_THAN';
                    ctx.generate();
                }
            },
            {
                operator: 'GREATER_THAN_OR_EQUAL_TO',
                title: 'Greater than or equal to',
                callback: () => {
                    operatorObject.operator = 'GREATER_THAN_OR_EQUAL_TO';
                    ctx.generate();
                }
            },
            {
                operator: 'LESS_THAN',
                title: 'Less than',
                callback: () => {
                    operatorObject.operator = 'LESS_THAN';
                    ctx.generate();
                }
            },
            {
                operator: 'LESS_THAN_OR_EQUAL_TO',
                title: 'Less then or equal to',
                callback: () => {
                    operatorObject.operator = 'LESS_THAN_OR_EQUAL_TO';
                    ctx.generate();
                }
            },
            {
                operator: 'NOT_EQUAL_TO',
                title: 'Not Equal to',
                callback: () => {
                    operatorObject.operator = 'NOT_EQUAL_TO';
                    ctx.generate();
                }
            },
            {
                operator: 'IN',
                title: 'IN',
                callback: () => {
                    operatorObject.operator = 'IN';
                    ctx.generate();
                }
            },
            {
                operator: 'NOT_IN',
                title: 'NOT IN',
                callback: () => {
                    operatorObject.operator = 'NOT_IN';
                    ctx.generate();
                }
            },
            {
                operator: 'IS_BLANK',
                title: 'IS BLANK',
                callback: () => {
                    operatorObject.operator = 'IS_BLANK';
                    ctx.generate();
                }
            },
            {
                operator: 'IS_NOT_BLANK',
                title: 'IS NOT BLANK',
                callback: () => {
                    operatorObject.operator = 'IS_NOT_BLANK';
                    ctx.generate();
                }
            }
        ]);
    };
    const boldEl = document.createElement('b');
    boldEl.appendChild(document.createTextNode(OPERATORS[operatorObject.operator]));
    el.appendChild(boldEl);
    return el;
}
