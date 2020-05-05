import { customElement, property } from '@simple-html/core';
import { html } from 'lit-html';
import { IDateConfig } from '../interfaces';

@customElement('simple-html-date-month-header')
export default class extends HTMLElement {
    @property() month: number;
    @property() year: number;
    config: IDateConfig;

    render() {
        return html`<span>${this.config.monthHeader[this.month]}-${this.year}</span>`;
    }
}
