import { html, render } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import type { Grid } from '../grid';
import { asPx } from './asPx';
import { createElement } from './createElement';
import { dragEvent } from './dragEvent';
import { getColumnLabel } from './getColumnLabel';
import { gridText } from './gridText';
import type { HTMLCellElement } from './HTMLCellElement';
import { closePopover, removeContextMenu } from './removeContextMenu';
import { moveMenu, popoverParent } from './showMenu';

// might want to add this as part of context, so I can share it?
let currentColumnSearchvalue = '';

/**
 * The column chooser, from the header menu: the fields the grid knows, to drag into the header.
 *
 * A `popover="manual"` of its own, apart from the grid's menu (ctx.contextMenu): it stays open while
 * columns are dragged from it and the grid is used, a click outside or another menu does not close
 * it. Its Close button does, Esc while the focus is in it (its search field), and the grid leaving
 * the page.
 */
export function contextMenuColumnChooser(ctx: Grid, event: MouseEvent, cell: HTMLElement) {
    removeContextMenu(ctx);
    // one at a time
    ctx.columnChooserMenu?.remove();

    const contextMenu = createElement('div', 'simple-html-grid');
    contextMenu.classList.add('simple-html-grid-reset', 'simple-html-grid-popover');
    contextMenu.popover = 'manual';
    contextMenu.style.minWidth = asPx(130);

    // the focus goes back here when the chooser closes with the focus in it, see closePopover
    const returnFocus = document.activeElement;
    const close = () => {
        // or disconnectElement tries to remove it again
        if (ctx.columnChooserMenu === contextMenu) {
            ctx.columnChooserMenu = null;
        }
        closePopover(contextMenu, returnFocus);
    };
    contextMenu.addEventListener('keydown', (keyEvent) => {
        if (keyEvent.key === 'Escape' && !keyEvent.defaultPrevented) {
            // not the grid's menu, not a dialog the chooser is in
            keyEvent.preventDefault();
            close();
        }
    });

    let controller = new AbortController();

    const reRender = () => {
        const attributes = Object.keys(ctx.gridInterface.__getGridConfig().columns) || [];

        const list = () => {
            return html` <div class="simple-html-grid-menu-sub simple-html-dialog-scroller">
                ${attributes
                    .filter((e) => e.toLowerCase().includes(currentColumnSearchvalue.toLowerCase()))
                    .sort()
                    .map((attribute) => {
                        return html`<div class="simple-html-grid-menu-item" .$attribute=${attribute}>
                            ${getColumnLabel(ctx, attribute, true)}
                        </div>`;
                    })}
            </div>`;
        };

        const searchInput = () => {
            return html`
                <input
                    class="simple-html-grid-menu-item-input"
                    .value=${live(currentColumnSearchvalue)}
                    placeholder=${gridText(ctx, 'columnChooser.search')}
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
                <div class="simple-html-grid-menu-section">${gridText(ctx, 'columnChooser.title')}</div>
                <hr class="hr-solid" />
                ${searchInput()} ${list()}
                <div class="simple-html-label-button-menu-bottom" @click=${() => close()}>
                    ${gridText(ctx, 'columnChooser.close')}
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
    popoverParent(cell).appendChild(contextMenu);
    contextMenu.showPopover();

    // under the header, around the mouse
    const rect = cell.getBoundingClientRect();
    let left = event.clientX - 65;
    if (event.clientX + 70 > window.innerWidth) {
        left = window.innerWidth - 150;
    }
    if (event.clientX - 65 < 0) {
        left = 5;
    }
    moveMenu(contextMenu, left, rect.bottom + 50);

    reRender();
}
