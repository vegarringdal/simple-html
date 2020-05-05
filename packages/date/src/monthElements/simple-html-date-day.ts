import { customElement, property } from '@simple-html/core';
import { html } from 'lit-html';
import { IDateConfig } from '../interfaces';

@customElement('simple-html-date-day')
export default class extends HTMLElement {
    monthBlock: number; // starts with 1
    config: IDateConfig;
    @property() month: number;
    @property() year: number;

    render() {
        // lets just add silly datecalc so we get correct days
        const FirstDateOfMonth = new Date(this.year, this.month, 1);
        const lastDayOfMonth = new Date(this.year, this.month === 11 ? 1 : this.month + 1, 0);
        const dayOfWeek = FirstDateOfMonth.getDay();
        let day = this.monthBlock - dayOfWeek;

        // if more then last day of month
        if (day > lastDayOfMonth.getDate()) {
            day = day - lastDayOfMonth.getDate();
        }

        // if less that first we need to cound downwards
        if (day < 1) {
            day = lastDayOfMonth.getDate() - (dayOfWeek - this.monthBlock - 1); //+ -1 since eery block starts at 1
        }

        return html`<span>${day}</span>`;
    }
}
