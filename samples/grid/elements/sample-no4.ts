import { customElement } from '@simple-html/core';
import { html } from 'lit-html';

@customElement('sample-no4')
export default class extends HTMLElement {
    render() {
        return html`<simple-html-grid-filter-dialog
            style="margin:25px"
        ></simple-html-grid-filter-dialog>`;
    }
}
