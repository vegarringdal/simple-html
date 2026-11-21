import { html, render } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import type { Grid } from '../grid';
import { createElement } from './createElement';
import { getColumnLabel } from './getColumnLabel';
import { gridText } from './gridText';
import { openMenuElement, placeMenu, placeUnderCell } from './showMenu';

// might want to add this as part of context, so I can share it?
let currentColumnSearchvalue = '';

/**
 * the field picker of the filter editor, the grid's menu (one at a time, closed as the others)
 * @param cell
 * @param callback
 */
export function contextMenuAttributes(ctx: Grid, event: MouseEvent, cell: HTMLElement, callback: (attribute: string) => void) {
    const contextMenu = createElement('div', 'simple-html-grid');
    contextMenu.classList.add('simple-html-grid-reset');

    // the search renders the list again, the menu stays where it opened
    const reRender = () => {
        const attributes = Object.keys(ctx.gridInterface.__getGridConfig().columns) || [];

        const searchInput = () => {
            return html`
                <input
                    class="simple-html-grid-menu-item-input"
                    .value=${live(currentColumnSearchvalue)}
                    placeholder=${gridText(ctx, 'filterEditor.fieldMenu.search')}
                    @input=${(e: any) => {
                        currentColumnSearchvalue = e.target.value;
                        reRender();
                    }}
                />
            `;
        };

        render(
            html`<div class="simple-html-grid-menu ">
                <div class="simple-html-grid-menu-section">${gridText(ctx, 'filterEditor.fieldMenu')}</div>
                <hr class="hr-solid" />
                ${searchInput()}
                <div class="simple-html-grid-menu-sub simple-html-dialog-scroller">
                    ${attributes
                        .filter((e) => e.toLowerCase().includes(currentColumnSearchvalue.toLowerCase()))
                        .sort()
                        .map((attribute) => {
                            return html`<div
                                class="simple-html-grid-menu-item"
                                @click=${() => {
                                    callback(attribute);
                                }}
                            >
                                ${getColumnLabel(ctx, attribute, true)}
                            </div>`;
                        })}
                </div>
            </div>`,
            contextMenu
        );
    };

    reRender();

    // in the editor's dialog: a menu outside a modal dialog can not be clicked, see popoverParent
    openMenuElement(ctx, contextMenu, cell);
    placeMenu(contextMenu, placeUnderCell(event, cell));
}
