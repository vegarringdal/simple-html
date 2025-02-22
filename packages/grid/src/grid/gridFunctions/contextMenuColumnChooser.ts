import { render, html } from 'lit-html';
import { asPx } from './asPx';
import { creatElement } from './createElement';
import { dragEvent } from './dragEvent';
import { Grid } from '../grid';
import { HTMLCellElement } from './HTMLCellElement';
import { prettyPrintString } from './prettyPrintString';
import { removeContextMenu } from './removeContextMenu';
import { live } from 'lit-html/directives/live.js';

// might want to add this as part of context, so I can share it?
let currentColumnSearchvalue = '';

/**
 * ctx is part of filter editor
 * @param cell
 * @param callback
 */
export function contextMenuColumnChooser(ctx: Grid, event: MouseEvent, cell: HTMLElement) {
    removeContextMenu(ctx);

    const contextMenu = creatElement('div', 'simple-html-grid');
    contextMenu.classList.add('simple-html-grid-reset');
    if (ctx.columnChooserMenu && ctx.columnChooserMenu.parentElement) {
        document.body.removeChild(ctx.columnChooserMenu);
    }

    let controller = new AbortController();

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

    const reRender = () => {
        const attributes = Object.keys(ctx.gridInterface.__getGridConfig().__attributes) || [];

        const list = () => {
            return html` <div class="simple-html-grid-menu-sub simple-html-dialog-scroller">
                ${attributes
                    .filter((e) => e.toLowerCase().includes(currentColumnSearchvalue.toLowerCase()))
                    .sort()
                    .map((attribute) => {
                        const label = ctx.gridInterface.__getGridConfig().__attributes[attribute].label;
                        return html`<div class="simple-html-grid-menu-item" .$attribute=${attribute}>
                            ${label || prettyPrintString(attribute)}
                        </div>`;
                    })}
            </div>`;
        };

        const searchInput = () => {
            return html`
                <input
                    class="simple-html-grid-menu-item-input"
                    .value=${live(currentColumnSearchvalue)}
                    placeholder="search"
                    @input=${(e: any) => {
                        currentColumnSearchvalue = e.target.value;
                        controller.abort();
                        controller = new AbortController();
                        reRender();
                    }}
                />
            `;
        };

        render(
            html`<div class="simple-html-grid-menu ">
                <div class="simple-html-grid-menu-section">All Fields:</div>
                <hr class="hr-solid" />
                ${searchInput()} ${list()}
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
            dragEvent(ctx, cells[i] as HTMLCellElement, false, controller.signal);
        }
    };
    ctx.columnChooserMenu = contextMenu;
    document.body.appendChild(contextMenu);

    reRender();
}
