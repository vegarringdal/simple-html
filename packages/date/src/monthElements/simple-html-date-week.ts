import { customElement, property } from '@simple-html/core';
import { html } from 'lit-html';
import { IDateConfig } from '../interfaces';

@customElement('simple-html-date-week')
export default class extends HTMLElement {
    monthBlock: number;
    config: IDateConfig;
    @property() month: number;
    @property() year: number;

    render() {
        return html`<span>${this.monthBlock}</span>`;
    }
}
