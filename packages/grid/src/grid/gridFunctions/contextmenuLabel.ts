import { html, render } from 'lit-html';
import { Entity } from '../../datasource/entity';
import { asPx } from './asPx';
import { autoResizeColumns } from './autoResizeColumns';
import { contextMenuColumnChooser } from './contextMenuColumnChooser';
import { creatElement } from './createElement';
import { Grid } from '../grid';
import { HTMLCellElement } from './HTMLCellElement';
import { ColType } from './colType';
import { removeContextMenu } from './removeContextMenu';

export function contextmenuLabel(
    ctx: Grid,
    event: MouseEvent,
    cell: HTMLCellElement,
    _row: number,
    column: number,
    celno: number,
    colType: ColType,
    _cellType: string,
    attribute: string,
    _rowData: Entity
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

    /**
     * pin left depends on what ctx column it is
     */
    let pinLeftTemplate = html`
        <div
            class="simple-html-grid-menu-item"
            @click=${() => {
                let width = 100;
                if (colType === 'middle-pinned') {
                    ctx.gridInterface.__getGridConfig().columnsCenter[column].rows.splice(celno, 1);
                    width = ctx.gridInterface.__getGridConfig().columnsCenter[column].width;
                }
                if (colType === 'right-pinned') {
                    ctx.gridInterface.__getGridConfig().columnsPinnedRight[column].rows.splice(celno, 1);
                    width = ctx.gridInterface.__getGridConfig().columnsPinnedRight[column].width;
                }

                ctx.gridInterface.__getGridConfig().columnsPinnedLeft.push({
                    rows: [attribute],
                    width
                });
                ctx.rebuild(true);
            }}
        >
            Pin left
        </div>
        <div
            class="simple-html-grid-menu-item"
            @click=${() => {
                let width = 100;
                if (colType === 'middle-pinned') {
                    width = ctx.gridInterface.__getGridConfig().columnsCenter[column].width;
                }
                if (colType === 'right-pinned') {
                    width = ctx.gridInterface.__getGridConfig().columnsPinnedRight[column].width;
                }

                ctx.gridInterface.__getGridConfig().columnsPinnedLeft.push({
                    rows: [attribute],
                    width
                });
                ctx.rebuild(true);
            }}
        >
            Pin left (copy)
        </div>
    `;

    if (colType === 'left-pinned') {
        pinLeftTemplate = '' as any;
    }

    /**
     * pin right depends on what ctx column it is
     */
    let pinRightTemplate = html`
        <div
            class="simple-html-grid-menu-item"
            @click=${() => {
                let width = 100;
                if (colType === 'middle-pinned') {
                    ctx.gridInterface.__getGridConfig().columnsCenter[column].rows.splice(celno, 1);
                    width = ctx.gridInterface.__getGridConfig().columnsCenter[column].width;
                }
                if (colType === 'left-pinned') {
                    ctx.gridInterface.__getGridConfig().columnsPinnedLeft[column].rows.splice(celno, 1);
                    width = ctx.gridInterface.__getGridConfig().columnsPinnedLeft[column].width;
                }

                ctx.gridInterface.__getGridConfig().columnsPinnedRight.push({
                    rows: [attribute],
                    width
                });
                ctx.rebuild(true);
            }}
        >
            Pin right
        </div>
        <div
            class="simple-html-grid-menu-item"
            @click=${() => {
                let width = 100;
                if (colType === 'middle-pinned') {
                    width = ctx.gridInterface.__getGridConfig().columnsCenter[column].width;
                }
                if (colType === 'left-pinned') {
                    width = ctx.gridInterface.__getGridConfig().columnsPinnedLeft[column].width;
                }

                ctx.gridInterface.__getGridConfig().columnsPinnedRight.push({
                    rows: [attribute],
                    width
                });
                ctx.rebuild(true);
            }}
        >
            Pin right (copy)
        </div>
    `;

    if (colType === 'right-pinned') {
        pinRightTemplate = '' as any;
    }

    /**
     * unpins
     */
    let unPinTemplate = html`
        <div
            class="simple-html-grid-menu-item"
            @click=${() => {
                let width = 100;
                if (colType === 'right-pinned') {
                    ctx.gridInterface.__getGridConfig().columnsPinnedRight[column].rows.splice(celno, 1);
                    width = ctx.gridInterface.__getGridConfig().columnsPinnedRight[column].width;
                    ctx.gridInterface.__getGridConfig().columnsCenter.push({
                        rows: [attribute],
                        width
                    });
                }
                if (colType === 'left-pinned') {
                    ctx.gridInterface.__getGridConfig().columnsPinnedLeft[column].rows.splice(celno, 1);
                    width = ctx.gridInterface.__getGridConfig().columnsPinnedLeft[column].width;
                    ctx.gridInterface.__getGridConfig().columnsCenter.unshift({
                        rows: [attribute],
                        width
                    });
                }

                ctx.rebuild(true);
            }}
        >
            Unpin
        </div>
    `;

    if (colType !== 'right-pinned' && colType !== 'left-pinned') {
        unPinTemplate = '' as any;
    }

    render(
        html`<div class="simple-html-grid-menu">
            <div class="simple-html-grid-menu-section">Column:</div>
            <hr class="hr-solid" />

            ${pinLeftTemplate} ${pinRightTemplate}${unPinTemplate}
            <div
                class="simple-html-grid-menu-item"
                @click=${() => {
                    if (colType === 'middle-pinned') {
                        ctx.gridInterface.__getGridConfig().columnsCenter[column].rows.splice(celno, 1);
                    }
                    if (colType === 'right-pinned') {
                        ctx.gridInterface.__getGridConfig().columnsPinnedRight[column].rows.splice(celno, 1);
                    }
                    if (colType === 'left-pinned') {
                        ctx.gridInterface.__getGridConfig().columnsPinnedLeft[column].rows.splice(celno, 1);
                    }
                    ctx.rebuild(true);
                }}
            >
                Hide
            </div>
            <hr class="hr-dashed" />
            <div
                class="simple-html-grid-menu-item"
                @click=${(e: MouseEvent) => {
                    contextMenuColumnChooser(ctx, e, cell);
                }}
            >
                Column chooser
            </div>
            <div class="simple-html-grid-menu-section">Size:</div>
            <hr class="hr-solid" />
            <div
                class="simple-html-grid-menu-item"
                @click=${() => {
                    autoResizeColumns(ctx, attribute);
                }}
            >
                Resize Column
            </div>
            <div
                class="simple-html-grid-menu-item"
                @click=${() => {
                    autoResizeColumns(ctx);
                }}
            >
                Resize all columns
            </div>
            <div class="simple-html-grid-menu-section">Grouping:</div>
            <hr class="hr-solid" />
            <div
                class="simple-html-grid-menu-item"
                @click=${() => {
                    ctx.gridInterface.getDatasource().expandGroup();
                }}
            >
                Expand all
            </div>
            <div
                class="simple-html-grid-menu-item"
                @click=${() => {
                    ctx.gridInterface.getDatasource().collapseGroup();
                }}
            >
                Collapse all
            </div>
            <div
                class="simple-html-grid-menu-item"
                @click=${() => {
                    ctx.gridInterface.getDatasource().removeGroup();
                }}
            >
                Clear all
            </div>
        </div>`,
        contextMenu
    );

    document.body.appendChild(contextMenu);
    ctx.contextMenu = contextMenu;
}
