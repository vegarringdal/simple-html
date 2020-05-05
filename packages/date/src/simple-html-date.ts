import { customElement } from '@simple-html/core';
import { html } from 'lit-html';

@customElement('simple-html-date')
export default class extends HTMLElement {
    render() {
        return html`simple.html.date`;
    }
}
