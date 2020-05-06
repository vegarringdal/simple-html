import { customElement, property } from '@simple-html/core';
import { html } from 'lit-html';
import { SimpleHtmlDate } from '../simple-html-date';

// lets keep it simple while we test
const selected = new Set();
let lastSelected: Date = null;

@customElement('simple-html-date-day')
export default class extends HTMLElement {
    monthBlock: number; // starts with 1
    ref: SimpleHtmlDate;
    @property() month: number;
    @property() year: number;
    currentDate: Date;
    dimmed: boolean;

    connectedCallback() {
        this.ref.addEventListener('update', this);
        this.addEventListener('click', this);
    }

    disconnectedCallback() {
        this.ref.removeEventListener('update', this);
        this.removeEventListener('click', this);
    }

    handleEvent(e: MouseEvent) {
        if (e.type === 'update') {
            this.render();
        }
        let added = false;
        if (e.type === 'click') {
            if (selected.has(this.currentDate.getTime())) {
                added = false;
                selected.delete(this.currentDate.getTime());
            } else {
                added = true;
                selected.add(this.currentDate.getTime());
            }

            if (e.shiftKey && lastSelected) {
                if (lastSelected < this.currentDate) {
                    selected.clear();
                    selected.add(lastSelected.getTime());
                    while (lastSelected < this.currentDate) {
                        lastSelected.setDate(lastSelected.getDate() + 1);
                        if (!selected.has(lastSelected.getTime())) {
                            selected.add(lastSelected.getTime());
                        }
                    }
                }

                if (lastSelected > this.currentDate) {
                    selected.clear();
                    selected.add(lastSelected.getTime());
                    while (lastSelected > this.currentDate) {
                        lastSelected.setDate(lastSelected.getDate() - 1);
                        if (!selected.has(lastSelected.getTime())) {
                            selected.add(lastSelected.getTime());
                        }
                    }
                }
            }

            if (added) {
                lastSelected = this.currentDate;
            } else {
                lastSelected = null;
            }

            this.ref.triggerEvent('update');
        }
    }

    render() {
        // lets just add silly datecalc so we get correct days
        let year = this.year;
        let month = this.month;
        const FirstDateOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month === 11 ? 0 : month + 1, 0);
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
            if (month === 11) {
                month = 0;
                year++;
            } else {
                month++;
            }
        }

        // if less that first we need to count downwards
        if (day < 1) {
            FirstDateOfMonth.setDate(
                FirstDateOfMonth.getDate() - Math.abs(day) - this.ref.config.weekStart
            );
            day = FirstDateOfMonth.getDate();
            dimmedCell = true;
            if (month === 0) {
                month = 11;
                year--;
            } else {
                month--;
            }
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

        this.currentDate = new Date(year, month, day);
        this.dimmed = dimmedCell;
        if (selected.has(this.currentDate.getTime())) {
            if (!this.classList.contains('simple-html-date-day-selected') && !dimmedCell) {
                this.classList.add('simple-html-date-day-selected');
            }
        } else {
            if (this.classList.contains('simple-html-date-day-selected')) {
                this.classList.remove('simple-html-date-day-selected');
            }
        }

        if (this.classList.contains('simple-html-date-day-selected') && dimmedCell) {
            this.classList.remove('simple-html-date-day-selected');
        }

        return html`<span>${day}</span>`;
    }
}
