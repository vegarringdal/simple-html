import { customElement } from '@simple-html/core';
import { html } from 'lit-html';

@customElement('sample-no1')
export default class extends HTMLElement {
    render() {
        return html`<simple-html-date></simple-html-date>`;
    }
}
