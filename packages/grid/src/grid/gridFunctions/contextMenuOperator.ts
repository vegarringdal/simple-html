import { render, html } from 'lit-html';
import { asPx } from './asPx';
import { creatElement } from './createElement';
import { Grid } from '../grid';
import { prettyPrintString } from './prettyPrintString';

/**
 * ctx is part of filter editor
 * @param cell
 * @param callback
 */
export function contextMenuOperator(ctx: Grid, event: MouseEvent, cell: HTMLElement, callback: (operator: string) => void) {
    ctx.removeContextMenu();

    const contextMenu = creatElement('div', 'simple-html-grid');
    contextMenu.classList.add('simple-html-grid-reset');
    const rect = cell.getBoundingClientRect();

    contextMenu.style.position = 'absolute';
    contextMenu.style.top = asPx(rect.bottom + 2);
    contextMenu.style.left = asPx(event.clientX - 65);
    contextMenu.style.minWidth = asPx(130);

    if (event.clientX + 70 > window.innerWidth) {
        contextMenu.style.left = asPx(window.innerWidth - 150);
    }
    if (event.clientX - 65 < 0) {
        contextMenu.style.left = asPx(5);
    }

    const operators = [
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
            <div class="simple-html-grid-menu-section">Operator:</div>
            <hr class="hr-solid" />
            <div class="simple-html-grid-menu-sub simple-html-dialog-scroller">
                ${operators.map((operator) => {
                    const prettytext = prettyPrintString(operator);

                    return html`<div
                        class="simple-html-grid-menu-item"
                        @click=${() => {
                            callback(prettytext);
                        }}
                    >
                        ${prettytext}
                    </div>`;
                })}
            </div>
        </div>`,
        contextMenu
    );

    document.body.appendChild(contextMenu);
    ctx.contextMenu = contextMenu;
}
