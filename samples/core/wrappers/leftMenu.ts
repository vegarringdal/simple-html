import { html, TemplateResult } from 'lit-html';
import { mainUIState } from '../state/mainUI';

export function leftMenu(children: TemplateResult) {
    const [UiState] = mainUIState();
    if (UiState.showDialog) {
        return html`
            <style>
                .outer-dialog {
                    top: 0;
                    background-color: rgba(117, 117, 117, 0.89);
                    z-index: 1000;
                }
                .inner-dialog {
                    opacity: 1;
                    top: 0;
                    bottom: 0;
                    left: 0;
                    z-index: 1010;
                }
            </style>
            <div class="fixed w-full h-full outer-dialog ">
                <div class="fixed inner-dialog">
                    ${children}
                </div>
            </div>
        `;
    }
    return '';
}
