import { html, render } from 'lit-html';
import { getElementByClassName } from './getElementByClassName';
import { Grid } from '../grid';

export function rebuildFooter(ctx: Grid) {
    const footer = getElementByClassName(ctx.element, 'simple-html-grid-footer');
    const totalRows = ctx.gridInterface.getDatasource().getAllData().length;
    const filteredRows = ctx.gridInterface.getDatasource().length();
    const filterString = ctx.gridInterface.getDatasource().getFilterString();
    const scrollbarHeight = ctx.gridInterface.__getGridConfig().__scrollbarSize;

    const clearButton = filterString
        ? html`<div class="clear-button" @click=${() => ctx.clearAllColumnFilters()}>Clear filter</div>`
        : null;
    const filterTemplate = html`<div style="display:flex">
        ${clearButton} <span class="footer-query" style="margin:auto">${filterString}</span>
    </div>`;

    render(
        html`<div style="display:flex;flex-direction: column;">
            <div style="flex: 1 1 ${scrollbarHeight}px;"></div>
            <span style="margin:auto">${filteredRows}/${totalRows}</span>
            ${filterString ? filterTemplate : null}
        </div>`,
        footer
    );
}
