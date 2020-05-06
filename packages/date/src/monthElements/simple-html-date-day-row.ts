import { customElement, property } from '@simple-html/core';
import { html } from 'lit-html';
import { SimpleHtmlDate } from '../simple-html-date';

@customElement('simple-html-date-day-row')
export default class extends HTMLElement {
    ref: SimpleHtmlDate;
    @property() row: number;
    @property() month: number;
    @property() year: number;
    connectedCallback() {
        this.ref.addEventListener('update', this);
    }

    disconnectedCallback() {
        this.ref.removeEventListener('update', this);
    }

    handleEvent(e: Event) {
        if (e.type === 'update') {
            this.render();
        }
    }

    render() {
        const rows = new Array(8).fill('x');
        this.style.height = this.ref.config.rowHeight;

        return html`<!---->

            <!-- rows to hold the days -->
            ${rows.map((_x, i) => {
                if (i === 0) {
                    if (this.ref.config.showWeek) {
                        return html`<simple-html-date-week
                            .ref=${this.ref}
                            .monthBlock=${i + this.row * 7}
                            .month=${this.month}
                            .year=${this.year}
                            .row=${i}
                        ></simple-html-date-week>`;
                    }
                    return '';
                } else {
                    return html`<simple-html-date-day
                        .ref=${this.ref}
                        .month=${this.month}
                        .year=${this.year}
                        .monthBlock=${i + this.row * 7}
                    ></simple-html-date-day>`;
                }
            })} `;
    }
}
