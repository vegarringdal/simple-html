import { html } from 'lit-html';
import { CallbackEvent, rowCache } from '../interfaces';
import { rowElement } from './rowElement';
import { GridInterface } from '../gridInterface';

export function bodyElement(
    scroll: (e: CallbackEvent) => void,
    connector: GridInterface,
    rowPositionCache: rowCache[]
) {
    const styleBody = `
            top:${connector.config.panelHeight + connector.config.headerHeight}px;
            bottom:${connector.config.footerHeight}px`;

    const styleBodyContent = `
            height:${(connector.displayedDataset.length || 0) * connector.config.rowHeight}px;
            width:${connector.config.columns
                .map(col => col.width || 100)
                .reduce((total, num) => total + num)}px`;

    return html`
        <free-grid-body @scroll=${scroll} style=${styleBody} class="free-grid-body">
            <free-grid-body-content style=${styleBodyContent} class="free-grid-content">
                ${rowPositionCache.map(rowPosition => {
                    return rowElement(connector, connector.displayedDataset[rowPosition.i], rowPosition);
                })}
            </free-grid-body-content>
        </free-grid-body>
    `;
}
