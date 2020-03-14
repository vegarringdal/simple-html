import { html, TemplateResult } from 'lit-html';
import { GridInterface } from '..';


export function footerElement(connector: GridInterface): TemplateResult {
    if (connector.config.footerHeight < 1) {
        connector.config.footerHeight = 1; // always have 1 px
    }

    if (connector.config.footerRenderCallBackFn) {
        return html`
            <free-grid-footer
                style="height:${connector.config.footerHeight}px"
                class="free-grid-footer"
                >${connector.config.footerRenderCallBackFn(
                    connector,
                    null,
                    null,
                    null,
                    null
                )}</free-grid-footer
            >
        `;
    } else {
        return html`
            <free-grid-footer
                style="height:${connector.config.footerHeight}px"
                class="free-grid-footer"
            ></free-grid-footer>
        `;
    }
}
