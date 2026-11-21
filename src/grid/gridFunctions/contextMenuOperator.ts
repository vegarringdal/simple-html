import { html, render } from 'lit-html';
import type { FilterOperator } from '../../datasource/filterExpression';
import type { Grid } from '../grid';
import { createElement } from './createElement';
import { gridText } from './gridText';
import { openMenuElement, placeMenu, placeUnderCell } from './showMenu';

/**
 * the operator picker of the filter editor, the grid's menu (one at a time, closed as the others)
 * @param cell
 * @param callback gets the picked operator
 */
export function contextMenuOperator(
    ctx: Grid,
    event: MouseEvent,
    cell: HTMLElement,
    callback: (operator: FilterOperator) => void
) {
    const contextMenu = createElement('div', 'simple-html-grid');
    contextMenu.classList.add('simple-html-grid-reset');

    const operators: FilterOperator[] = [
        'EQUAL',
        'LESS_THAN_OR_EQUAL_TO',
        'GREATER_THAN_OR_EQUAL_TO',
        'LESS_THAN',
        'GREATER_THAN',
        'CONTAINS',
        'NOT_EQUAL_TO',
        'DOES_NOT_CONTAIN',
        'BEGIN_WITH',
        'END_WITH',
        'IN',
        'NOT_IN',
        'IS_BLANK',
        'IS_NOT_BLANK'
    ];

    render(
        html`<div class="simple-html-grid-menu">
            <div class="simple-html-grid-menu-section">${gridText(ctx, 'filterEditor.operatorMenu')}</div>
            <hr class="hr-solid" />
            <div class="simple-html-grid-menu-sub simple-html-dialog-scroller">
                ${operators.map((operator) => {
                    return html`<div
                        class="simple-html-grid-menu-item"
                        @click=${() => {
                            callback(operator);
                        }}
                    >
                        ${gridText(ctx, `filterEditor.operator.${operator}`)}
                    </div>`;
                })}
            </div>
        </div>`,
        contextMenu
    );

    // in the editor's dialog: a menu outside a modal dialog can not be clicked, see popoverParent
    openMenuElement(ctx, contextMenu, cell);
    placeMenu(contextMenu, placeUnderCell(event, cell));
}
