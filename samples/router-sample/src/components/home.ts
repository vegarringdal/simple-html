import { html } from 'lit-html';
import { customElement } from '@simple-html/core';

@customElement('home-component')
export default class extends HTMLElement {
    public render() {
        return html`
            home cool
        `;
    }
}
