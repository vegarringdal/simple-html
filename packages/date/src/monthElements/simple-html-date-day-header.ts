import { customElement } from '@simple-html/core';
import { html } from 'lit-html';
import { IDateConfig } from '../interfaces';

@customElement('simple-html-date-day-header')
export default class extends HTMLElement {
    config: IDateConfig;
    blockDay: number;
    render() {
        return html`${this.config.weekHeader[this.blockDay]}`;
    }
}
