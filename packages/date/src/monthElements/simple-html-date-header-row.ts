import { customElement } from '@simple-html/core';
import { html } from 'lit-html';
import { IDateConfig } from '../interfaces';

@customElement('simple-html-date-header-row')
export default class extends HTMLElement {
    config: IDateConfig;

    render() {
        const rows = new Array(8).fill('x');

        return html`<!---->

            <!-- rows to hold the days -->
            ${rows.map((_x, i) => {
                if (i === 0) {
                    if (this.config.showWeek) {
                        return html`<simple-html-date-week-header
                            .row=${i}
                            .config=${this.config}
                        ></simple-html-date-week-header>`;
                    }
                    return '';
                } else {
                    return html`<simple-html-date-day-header
                        .blockDay=${i - 1}
                        .config=${this.config}
                    ></simple-html-date-day-header>`;
                }
            })} `;
    }
}
