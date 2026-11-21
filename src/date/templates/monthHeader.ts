import { html } from 'lit-html';
import { getText, type TextId } from '../../texts';
import type { DateInterface } from '../dateInterface';
import type { IDateConfig } from '../interfaces';

/**
 * the text ids of the names of the months, January first
 */
const MONTHS: TextId[] = [
    'datePicker.month.january',
    'datePicker.month.february',
    'datePicker.month.march',
    'datePicker.month.april',
    'datePicker.month.may',
    'datePicker.month.june',
    'datePicker.month.july',
    'datePicker.month.august',
    'datePicker.month.september',
    'datePicker.month.october',
    'datePicker.month.november',
    'datePicker.month.december'
];

export function monthHeader(context: DateInterface, config: IDateConfig, year: number, month: number) {
    const name = getText(MONTHS[month], config.texts);
    if (config.datepicker) {
        return html`<!-- function:monthHeader -->
            <div class="simple-html-date-month-header">
                <div class="year">${year}</div>
                <div class="month">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="icon"
                        @click=${(e: any) => {
                            e.preventDefault();
                            e.stopPropagation();
                            context.prevMonth();
                        }}
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5"
                        />
                    </svg>

                    <span class="main"> ${name} </span>

                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="icon"
                        @click=${(e: any) => {
                            e.preventDefault();
                            e.stopPropagation();
                            context.nextMonth();
                        }}
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5"
                        />
                    </svg>
                </div>
            </div>`;
    }

    return html`<!-- function:monthHeader -->
        <div class="simple-html-date-month-header">
            <span class="main"> ${name}${config.showYearInMonth ? `-${year}` : ''} </span>
        </div>`;
}
