import { customElement } from '@simple-html/core';
import { html } from 'lit-html';

@customElement('simple-html-date-month-header')
export default class extends HTMLElement {
    render() {
        return html`<span>MONTH HEADER</span>`;
    }
}
