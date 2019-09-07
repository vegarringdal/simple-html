import { html } from 'lit-html';
import { CallbackEvent, rowCache } from '../interfaces';
import { FreeGrid } from '..';
import { rowElement } from './rowElement';

export function bodyElement(
    scroll: (e: CallbackEvent) => void,
    freeGrid: FreeGrid,
    rowPositionCache: rowCache[]
) {
    const styleBody = `
            top:${freeGrid.config.panelHeight + freeGrid.config.headerHeight}px;
            bottom:${freeGrid.config.footerHeight}px`;

    const styleBodyContent = `
            height:${(freeGrid.viewRows.length || 0) * freeGrid.config.rowHeight}px;
            width:${freeGrid.config.columns
                .map(col => col.width || 100)
                .reduce((total, num) => total + num)}px`;

    return html`
        <free-grid-body @scroll=${scroll} style=${styleBody} class="free-grid-body">
            <free-grid-body-content style=${styleBodyContent} class="free-grid-content">
                ${rowPositionCache.map(rowPosition => {
                    return rowElement(freeGrid, freeGrid.viewRows[rowPosition.i], rowPosition);
                })}
            </free-grid-body-content>
        </free-grid-body>
    `;
}
