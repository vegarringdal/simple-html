import { customElement } from '@simple-html/core';
import { html } from 'lit-html';
import { IDateConfig } from '@simple-html/date/src/interfaces';

@customElement('sample-default')
export default class extends HTMLElement {
    dateconfig: IDateConfig = {
        monthsToShow: 4,
        startMonth: 0, //0-11
        startYear: 2020,
        showWeek: false,
        weekHeader: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
        monthHeader: [
            'January',
            'February',
            'March',
            'April',
            'May',
            'June',
            'July',
            'August',
            'September',
            'October',
            'November',
            'December'
        ],
        weekStart: 1 // not in use
    };

    render() {
        return html`<simple-html-date .config=${this.dateconfig}></simple-html-date>`;
    }
}
