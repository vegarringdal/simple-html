import { html, render } from 'lit-html';
import { clearAllColumnFilters } from './clearAllColumnFilters';
import { getElementByClassName } from './getElementByClassName';
export function rebuildFooter(ctx) {
    const footer = getElementByClassName(ctx.element, 'simple-html-grid-footer');
    const totalRows = ctx.gridInterface.getDatasource().getAllData().length;
    const filteredRows = ctx.gridInterface.getDatasource().length();
    const filterString = ctx.gridInterface.getDatasource().getFilterString(ctx);
    const scrollbarHeight = ctx.gridInterface.__getGridConfig().__scrollbarSize;
    const clearButton = filterString
        ? html `<div class="clear-button" @click=${() => clearAllColumnFilters(ctx)}>Clear filter</div>`
        : null;
    const filterTemplate = html `<div style="display:flex">
        ${clearButton} <span class="footer-query" style="margin:auto">${filterString}</span>
    </div>`;
    render(html `<div style="display:flex;flex-direction: column;">
            <div style="flex: 1 1 ${scrollbarHeight}px;"></div>
            <span style="margin:auto">${filteredRows}/${totalRows}</span>
            ${filterString ? filterTemplate : null}
        </div>`, footer);
}
//# sourceMappingURL=rebuildFooter.js.map