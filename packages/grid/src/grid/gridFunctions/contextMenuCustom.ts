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
export function contextMenuCustom(
    ctx: Grid,
    event: MouseEvent,
    cell: HTMLElement,
    callback: (attribute: string) => boolean | void,
    options: { label: string; value: string; isHeader?: boolean }[]
) {
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

    render(
        html`<div class="simple-html-grid-menu ">
            ${options.map((data) => {
                if (data.isHeader) {
                    return html`<div class="simple-html-grid-menu-section">${prettyPrintString(data.label)}:</div>`;
                }

                return html`<div
                    class="simple-html-grid-menu-item"
                    @click=${() => {
                        const close = callback(data.value);
                        if (close) {
                            removeContextMenu(ctx);
                        }
                    }}
                >
                    ${prettyPrintString(data.label)}
                </div>`;
            })}
        </div>`,
        contextMenu
    );

    document.body.appendChild(contextMenu);
    const menuRect = contextMenu.getBoundingClientRect();
    if (menuRect.bottom > window.innerHeight) {
        contextMenu.style.top = asPx(rect.top - menuRect.height);
    }
    ctx.contextMenu = contextMenu;
}
