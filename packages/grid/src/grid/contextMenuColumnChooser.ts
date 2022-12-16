import { render, html } from 'lit-html';
import { asPx } from './asPx';
import { creatElement } from './createElement';
import { dragEvent } from './dragEvent';
import { Grid, HTMLCellElement } from './grid';
import { prettyPrintString } from './prettyPrintString';

/**
 * ctx is part of filter editor
 * @param cell
 * @param callback
 */
export function contextMenuColumnChooser(ctx: Grid, event: MouseEvent, cell: HTMLElement) {
    ctx.removeContextMenu();

    if (ctx.columnChooserMenu && ctx.columnChooserMenu.parentElement) {
        document.body.removeChild(ctx.columnChooserMenu);
    }

    const contextMenu = creatElement('div', 'simple-html-grid');
    contextMenu.classList.add('simple-html-grid-reset');
    const rect = cell.getBoundingClientRect();

    contextMenu.style.position = 'absolute';
    contextMenu.style.top = asPx(rect.bottom + 50);
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
            <div class="simple-html-grid-menu-section">All Fields:</div>
            <hr class="hr-solid" />
            <div class="simple-html-grid-menu-sub simple-html-dialog-scroller">
                ${attributes.sort().map((attribute) => {
                    return html`<div class="simple-html-grid-menu-item" .$attribute=${attribute}>
                        ${prettyPrintString(attribute)}
                    </div>`;
                })}
            </div>
            <div
                class="simple-html-label-button-menu-bottom"
                @click=${() => {
                    document.body.removeChild(contextMenu);
                }}
            >
                Close
            </div>
        </div>`,
        contextMenu
    );

    const cells = contextMenu.getElementsByClassName('simple-html-grid-menu-item');

    for (let i = 0; i < cells.length; i++) {
        dragEvent(ctx, cells[i] as HTMLCellElement, false);
    }

    document.body.appendChild(contextMenu);
    ctx.columnChooserMenu = contextMenu;
}
