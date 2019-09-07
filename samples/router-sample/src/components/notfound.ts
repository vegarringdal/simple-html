import { html } from 'lit-html';
import { customElement } from '@simple-html/core';

@customElement('notfound-component')
export default class extends HTMLElement {
    public render() {
        return html`
            notfound
        `;
    }
}
