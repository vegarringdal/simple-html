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
                title: 'Starts with',
                callback: () => {
                    operatorObject.operator = 'BEGIN_WITH';
                    ctx.generate();
                }
            },
            {
                title: 'Equal to',
                callback: () => {
                    operatorObject.operator = 'EQUAL';
                    ctx.generate();
                }
            },
            {
                title: 'Contains',
                callback: () => {
                    operatorObject.operator = 'CONTAINS';
                    ctx.generate();
                }
            },
            {
                title: 'Does not contain',
                callback: () => {
                    operatorObject.operator = 'DOES_NOT_CONTAIN';
                    ctx.generate();
                }
            },
            {
                title: 'End with',
                callback: () => {
                    operatorObject.operator = 'END_WITH';
                    ctx.generate();
                }
            },
            {
                title: 'Greater than',
                callback: () => {
                    operatorObject.operator = 'GREATER_THAN';
                    ctx.generate();
                }
            },
            {
                title: 'Greater than or equal to',
                callback: () => {
                    operatorObject.operator = 'GREATER_THAN_OR_EQUAL_TO';
                    ctx.generate();
                }
            },
            {
                title: 'Less than',
                callback: () => {
                    operatorObject.operator = 'LESS_THAN';
                    ctx.generate();
                }
            },
            {
                title: 'Less then or equal to',
                callback: () => {
                    operatorObject.operator = 'LESS_THAN_OR_EQUAL_TO';
                    ctx.generate();
                }
            },
            {
                title: 'Not Equal to',
                callback: () => {
                    operatorObject.operator = 'NOT_EQUAL_TO';
                    ctx.generate();
                }
            },
            {
                title: 'IN',
                callback: () => {
                    operatorObject.operator = 'IN';
                    ctx.generate();
                }
            },
            {
                title: 'NOT IN',
                callback: () => {
                    operatorObject.operator = 'NOT_IN';
                    ctx.generate();
                }
            },
            {
                title: 'IS BLANK',
                callback: () => {
                    operatorObject.operator = 'IS_BLANK';
                    ctx.generate();
                }
            },
            {
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
