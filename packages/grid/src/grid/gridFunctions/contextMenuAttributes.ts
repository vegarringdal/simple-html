import { render, html } from 'lit-html';
import { asPx } from './asPx';
import { creatElement } from './createElement';
import { Grid } from '../grid';
import { prettyPrintString } from './prettyPrintString';
import { removeContextMenu } from './removeContextMenu';

/**
 * ctx is part of filter editor
 * @param cell
 * @param callback
 */
export function contextMenuAttributes(ctx: Grid, event: MouseEvent, cell: HTMLElement, callback: (attribute: string) => void) {
    removeContextMenu(ctx);

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

    const attributes = Object.keys(ctx.gridInterface.__getGridConfig().__attributes) || [];

    render(
        html`<div class="simple-html-grid-menu ">
            <div class="simple-html-grid-menu-section">Available Fields:</div>
            <hr class="hr-solid" />
            <div class="simple-html-grid-menu-sub simple-html-dialog-scroller">
                ${attributes.sort().map((attribute) => {
                    const label = ctx.gridInterface.__getGridConfig().__attributes[attribute].label;
                    return html`<div
                        class="simple-html-grid-menu-item"
                        @click=${() => {
                            callback(attribute);
                        }}
                    >
                        ${label || prettyPrintString(attribute)}
                    </div>`;
                })}
            </div>
        </div>`,
        contextMenu
    );

    document.body.appendChild(contextMenu);
    ctx.contextMenu = contextMenu;
}
