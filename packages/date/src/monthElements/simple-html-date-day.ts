import { customElement, property } from '@simple-html/core';
import { html } from 'lit-html';
import { SimpleHtmlDate } from '../simple-html-date';

@customElement('simple-html-date-day')
export default class extends HTMLElement {
    monthBlock: number; // starts with 1
    ref: SimpleHtmlDate;
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
        // lets just add silly datecalc so we get correct days
        const FirstDateOfMonth = new Date(this.year, this.month, 1);
        const lastDayOfMonth = new Date(this.year, this.month === 11 ? 0 : this.month + 1, 0);
        let dayOfWeek = FirstDateOfMonth.getDay() - this.ref.config.weekStart;
        if (dayOfWeek < 0) {
            // if less than 0, we need to push it out 1 week. so we always show entire month
            dayOfWeek = dayOfWeek + 7;
        }

        let day = this.monthBlock - dayOfWeek;

        let dimmedCell = false;
        // if more then last day of month
        if (day > lastDayOfMonth.getDate()) {
            day = day - lastDayOfMonth.getDate();
            dimmedCell = true;
        }

        // if less that first we need to count downwards
        if (day < 1) {
            FirstDateOfMonth.setDate(
                FirstDateOfMonth.getDate() - Math.abs(day) - this.ref.config.weekStart
            );
            day = FirstDateOfMonth.getDate();
            dimmedCell = true;
        }

        if (dimmedCell) {
            if (!this.classList.contains('simple-html-date-day-dimmed')) {
                this.classList.add('simple-html-date-day-dimmed');
            }
        } else {
            if (this.classList.contains('simple-html-date-day-dimmed')) {
                this.classList.remove('simple-html-date-day-dimmed');
            }
        }

        return html`<span>${day}</span>`;
    }
}
