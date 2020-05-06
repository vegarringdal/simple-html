import { customElement, property } from '@simple-html/core';
import { html } from 'lit-html';
import { IDateConfig } from '../interfaces';

@customElement('simple-html-date-week')
export default class extends HTMLElement {
    monthBlock: number;
    config: IDateConfig;
    @property() month: number;
    @property() year: number;

    getWeek(date: Date) {
        /*getWeek() was developed by Nick Baicoianu at MeanFreePath: http://www.epoch-calendar.com */

        const dowOffset = this.config.isoWeek ? 1 : 0;
        const newYear = new Date(date.getFullYear(), 0, 1);
        let day = newYear.getDay() - dowOffset; //the day of week the year begins on
        day = day >= 0 ? day : day + 7;
        const daynum =
            Math.floor(
                (date.getTime() -
                    newYear.getTime() -
                    (date.getTimezoneOffset() - newYear.getTimezoneOffset()) * 60000) /
                    86400000
            ) + 1;
        let weeknum;
        //if the year starts before the middle of a week
        if (day < 4) {
            weeknum = Math.floor((daynum + day - 1) / 7) + 1;
            if (weeknum > 52) {
                const nYear = new Date(date.getFullYear() + 1, 0, 1);
                let nday = nYear.getDay() - dowOffset;
                nday = nday >= 0 ? nday : nday + 7;
                /*if the next year starts before the middle of
                       the week, it is week #1 of that year*/
                weeknum = nday < 4 ? 1 : 53;
            }
        } else {
            weeknum = Math.floor((daynum + day - 1) / 7);
        }
        return weeknum;
    }

    render() {
        let year = this.year;
        let month = this.month;
        const config = this.config;
        const FirstDateOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month === 11 ? 0 : month + 1, 0);

        let dayOfWeek = FirstDateOfMonth.getDay() - (config.isoWeek ? 1 : 0);
        if (dayOfWeek < 0) {
            // if less than 0, we need to push it out 1 week. so we always show entire month
            dayOfWeek = dayOfWeek + 7;
        }

        let day = this.monthBlock - dayOfWeek + 1;

        // if more then last day of month
        if (day > lastDayOfMonth.getDate()) {
            day = day - lastDayOfMonth.getDate();
            if (month === 11) {
                month = 0;
                year++;
            } else {
                month++;
            }
        }

        // if less that first we need to count downwards
        if (day < 1) {
            FirstDateOfMonth.setDate(FirstDateOfMonth.getDate() - Math.abs(day) - config.weekStart);
            day = FirstDateOfMonth.getDate();
            if (month === 0) {
                month = 11;
                year--;
            } else {
                month--;
            }
        }

        return html`${this.getWeek(new Date(year, month, day))}`;
    }
}
