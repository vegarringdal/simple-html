import { customElement } from '@simple-html/core';
import { html } from 'lit-html';

@customElement('simple-html-date-day-header')
export default class extends HTMLElement {
    blockDay: number;
    render() {
        return html`${this.blockDay}`;
    }
}
