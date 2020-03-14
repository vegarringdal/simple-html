import { html } from 'lit-html';
import { headerColumnElements } from './headerColumnElements';
import { GridInterface } from '../gridInterface';

export function headerElement(connector: GridInterface) {
    const style = `left:${
        connector.config.scrollLeft !== undefined ? -connector.config.scrollLeft : 0
    }px;
                   top:${connector.config.panelHeight}px;
                   height:${connector.config.headerHeight}px;
                   width:${connector.config.columns
                       .map(col => col.width || 100)
                       .reduce((total, num) => total + num) + 25}px`;
    const config = connector.config;

    return config.headerRenderCallBackFn
        ? html`
              <free-grid-header style=${style} class="free-grid-header">
                  ${config.headerRenderCallBackFn(html, null, null, null, connector)}
              </free-grid-header>
          `
        : html`
              <free-grid-header style=${style} class="free-grid-header">
                  ${headerColumnElements(connector)}
              </free-grid-header>
          `;
}
