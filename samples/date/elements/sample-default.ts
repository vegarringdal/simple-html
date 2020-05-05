import { customElement } from '@simple-html/core';
import { html } from 'lit-html';
import { IDateConfig } from '@simple-html/date/src/interfaces';

@customElement('sample-default')
export default class extends HTMLElement {
    dateconfig: IDateConfig = {
        months: 2,
        showWeek: true,
        weekHeader: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
        weekStart: 1
    };

    render() {
        return html`<simple-html-date .config=${this.dateconfig}></simple-html-date>`;
    }
}
