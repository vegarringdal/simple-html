import { customElement } from '@simple-html/core';
import { html } from 'lit-html';
import { SimpleHtmlDate } from '../simple-html-date';

@customElement('simple-html-date-header-row')
export default class extends HTMLElement {
    ref: SimpleHtmlDate;
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
                        return html`<simple-html-date-week-header
                            .ref=${this.ref}
                            .row=${i}
                        ></simple-html-date-week-header>`;
                    }
                    return '';
                } else {
                    return html`<simple-html-date-day-header
                        .ref=${this.ref}
                        .blockDay=${i - 1}
                    ></simple-html-date-day-header>`;
                }
            })} `;
    }
}
