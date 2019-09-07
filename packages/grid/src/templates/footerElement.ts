import { html, TemplateResult } from 'lit-html';
import { FreeGrid } from '..';

export function footerElement(freeGrid: FreeGrid): TemplateResult {
    if (freeGrid.config.footerHeight < 1) {
        freeGrid.config.footerHeight = 1; // always have 1 px
    }

    if (freeGrid.config.footerRenderCallBackFn) {
        return html`
            <free-grid-footer
                style="height:${freeGrid.config.footerHeight}px"
                class="free-grid-footer"
                >${freeGrid.config.footerRenderCallBackFn(
                    freeGrid,
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
                style="height:${freeGrid.config.footerHeight}px"
                class="free-grid-footer"
            ></free-grid-footer>
        `;
    }
}
