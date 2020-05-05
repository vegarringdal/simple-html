import { customElement } from '@simple-html/core';
import { html } from 'lit-html';
import { IDateConfig } from '@simple-html/date/src/interfaces';

@customElement('sample-default')
export default class extends HTMLElement {
    dateconfig: IDateConfig = {
        monthsToShow: 4,
        startMonth: 9, //0-11
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
        return html`<!-- x -->
            <button
                class="p-2 m-2 bg-gray-200"
                @click=${() => {
                    if (this.dateconfig.startMonth === 11) {
                        this.dateconfig.startMonth = 0;
                        this.dateconfig.startYear++;
                    } else {
                        this.dateconfig.startMonth++;
                    }
                    this.dateconfig = Object.assign({}, this.dateconfig); //reassign so lit-html knows its a new value... will add methods for this..
                    this.render();
                }}
            >
                next
            </button>
            <button
                class="p-2 m-2 bg-gray-200"
                @click=${() => {
                    if (this.dateconfig.startMonth === 0) {
                        this.dateconfig.startMonth = 11;
                        this.dateconfig.startYear--;
                    } else {
                        this.dateconfig.startMonth--;
                    }
                    this.dateconfig = Object.assign({}, this.dateconfig); //reassign so lit-html knows its a new value... will add methods for this..
                    this.render();
                }}
            >
                prev
            </button>
            <simple-html-date .config=${this.dateconfig}></simple-html-date>`;
    }
}
