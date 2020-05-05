import { customElement, property } from '@simple-html/core';
import { html } from 'lit-html';
import { IDateConfig } from '../interfaces';

@customElement('simple-html-date-day-row')
export default class extends HTMLElement {
    config: IDateConfig;
    @property() row: number;

    render() {
        const rows = new Array(8).fill('x');

        return html`<!---->

            <!-- rows to hold the days -->
            ${rows.map((_x, i) => {
                if (i === 0) {
                    if (this.config.showWeek) {
                        return html`<simple-html-date-week
                            .monthBlock=${i + this.row * 7}
                            .row=${i}
                            .config=${this.config}
                        ></simple-html-date-week>`;
                    }
                    return '';
                } else {
                    return html`<simple-html-date-day
                        .monthBlock=${i + this.row * 7}
                        .config=${this.config}
                    ></simple-html-date-day>`;
                }
            })} `;
    }
}
