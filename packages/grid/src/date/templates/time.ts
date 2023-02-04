import { IDateConfig } from '../interfaces';
import { html } from 'lit-html';
import { DateInterface } from '../dateInterface';
import { live } from 'lit-html/directives/live.js';

export function time(context: DateInterface, config: IDateConfig, _year: number, _month: number) {
    const width = config.monthWidth;

    return html` <div class="simple-html-date-time" style="width:${width}">
        <!-- hour -->
        <div class="date-flex">
            <div class="side">
                <label>HH </label>
                <div class="date-flex">
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
                            config.datepickerHour = config.datepickerHour - 1;
                            if (config.datepickerHour > 23) {
                                config.datepickerHour = 0;
                            }
                            if (config.datepickerHour < 0) {
                                config.datepickerHour = 23;
                            }
                            context.config.datepickerDate.setHours(config.datepickerHour);
                            context.config = structuredClone(context.config);
                            context.checkDatePicker();
                            context.render();
                        }}
                    >
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                    <input
                        .valueAsNumber=${live(config.datepickerHour || 0)}
                        type="number"
                        min="0"
                        max="23"
                        @click=${(e: any) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                        @change=${(e: any) => {
                            e.preventDefault();
                            e.stopPropagation();
                            config.datepickerHour = e.target.valueAsNumber;
                            if (config.datepickerHour > 23) {
                                config.datepickerHour = 0;
                            }
                            if (config.datepickerHour < 0) {
                                config.datepickerHour = 23;
                            }
                            context.config.datepickerDate.setHours(config.datepickerHour);
                            context.config = structuredClone(context.config);
                            context.checkDatePicker();
                            context.render();
                        }}
                    />
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
                            config.datepickerHour = config.datepickerHour + 1;
                            if (config.datepickerHour > 23) {
                                config.datepickerHour = 0;
                            }
                            if (config.datepickerHour < 0) {
                                config.datepickerHour = 23;
                            }
                            context.config.datepickerDate.setHours(config.datepickerHour);
                            context.config = structuredClone(context.config);
                            context.checkDatePicker();
                            context.render();
                        }}
                    >
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                    </svg>
                </div>
            </div>

            <!-- minute -->
            <div class="side">
                <label>MM</label>
                <div class="date-flex">
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
                            config.datepickerMinute = config.datepickerMinute - 1;
                            if (config.datepickerMinute > 23) {
                                config.datepickerMinute = 0;
                            }
                            if (config.datepickerMinute < 0) {
                                config.datepickerMinute = 23;
                            }
                            context.config.datepickerDate.setMinutes(config.datepickerMinute);
                            context.config = structuredClone(context.config);
                            context.checkDatePicker();
                            context.render();
                        }}
                    >
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                    <input
                        .valueAsNumber=${live(config.datepickerMinute || 0)}
                        type="number"
                        min="0"
                        max="59"
                        @click=${(e: any) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                        @change=${(e: any) => {
                            e.preventDefault();
                            e.stopPropagation();
                            config.datepickerMinute = e.target.valueAsNumber;
                            if (config.datepickerMinute > 59) {
                                config.datepickerMinute = 0;
                            }
                            if (config.datepickerMinute < 0) {
                                config.datepickerMinute = 59;
                            }
                            context.config.datepickerDate.setMinutes(config.datepickerMinute);
                            context.config = structuredClone(context.config);
                            context.checkDatePicker();
                            context.render();
                        }}
                    />

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
                            config.datepickerMinute = config.datepickerMinute + 1;
                            if (config.datepickerMinute > 59) {
                                config.datepickerMinute = 0;
                            }
                            if (config.datepickerMinute < 0) {
                                config.datepickerMinute = 59;
                            }
                            context.config.datepickerDate.setMinutes(config.datepickerMinute);
                            context.config = structuredClone(context.config);
                            context.checkDatePicker();
                            context.render();
                        }}
                    >
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                    </svg>
                </div>
            </div>
        </div>
        <div class="date-flex-col">
            <div class="side"></div>
            <button
                @click=${(e: any) => {
                    e.preventDefault();
                    e.stopPropagation();
                    context.gotoNow();
                }}
            >
                Now
            </button>
            <button
                @click=${() => {
                    context.callSubscribers('date-select', config.datepickerDate);
                }}
            >
                Use
            </button>
        </div>
    </div>`;
}
