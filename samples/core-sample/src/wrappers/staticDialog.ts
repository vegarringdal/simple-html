import { html, TemplateResult } from "lit-html";
import { mainUIState } from "../state/mainUI";

export function staticDialog(children: TemplateResult) {
  const [UiState] = mainUIState();
  if (UiState.show_dialog) {
    return html`
      <style>
        .outer-dialog {
          top: 0;
          background-color: rgba(117, 117, 117, 0.89);
          z-index: 1000;
        }
        .inner-dialog {
          opacity: 1;
          top: 50%;
          margin: auto;
          margin: 10%;
          z-index: 1010;
        }
      </style>
      <div class="fixed w-full h-full outer-dialog fadeIn">
        <div class="inner-dialog bounceInDown">
          ${children}
        </div>
      </div>
    `;
  }
  return "";
}
