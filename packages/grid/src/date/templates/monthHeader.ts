import { IDateConfig } from '../interfaces';
import { html } from 'lit-html';
import { DateInterface } from '../dateInterface';

export function monthHeader(context: DateInterface, config: IDateConfig, year: number, month: number) {
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
                        @click=${()=> context.prevMonth()}
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5"
                        />
                    </svg>

                    <span class="main"> ${config.monthHeader[month]} </span>

                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="icon"
                        @click=${()=> context.nextMonth()}
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
            <span class="main"> ${config.monthHeader[month]}${config.showYearInMonth ? '-' + year : ''} </span>
        </div>`;
}
