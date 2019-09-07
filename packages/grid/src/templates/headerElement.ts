import { html } from 'lit-html';
import { FreeGrid } from '..';
import { headerColumnElements } from './headerColumnElements';

export function headerElement(freeGrid: FreeGrid) {
    const style = `left:${
        freeGrid.config.scrollLeft !== undefined ? -freeGrid.config.scrollLeft : 0
    }px;
                   top:${freeGrid.config.panelHeight}px;
                   height:${freeGrid.config.headerHeight}px;
                   width:${freeGrid.config.columns
                       .map(col => col.width || 100)
                       .reduce((total, num) => total + num) + 25}px`;
    const config = freeGrid.config;

    return config.headerRenderCallBackFn
        ? html`
              <free-grid-header style=${style} class="free-grid-header">
                  ${config.headerRenderCallBackFn(html, null, null, null, freeGrid)}
              </free-grid-header>
          `
        : html`
              <free-grid-header style=${style} class="free-grid-header">
                  ${headerColumnElements(freeGrid)}
              </free-grid-header>
          `;
}
