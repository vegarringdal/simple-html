import { customElement, property } from '@simple-html/core';
import { html } from 'lit-html';
import { SimpleHtmlDate } from '../simple-html-date';

@customElement('simple-html-date-month-header')
export default class extends HTMLElement {
    @property() month: number;
    @property() year: number;
    ref: SimpleHtmlDate;

    render() {
        return html`<span>${this.ref.config.monthHeader[this.month]}-${this.year}</span>`;
    }
}
