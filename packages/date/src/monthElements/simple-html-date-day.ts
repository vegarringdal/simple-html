import { customElement } from '@simple-html/core';
import { html } from 'lit-html';

@customElement('simple-html-date-day')
export default class extends HTMLElement {
    monthBlock: number;
    render() {
        return html`<span>${this.monthBlock}</span>`;
    }
}
